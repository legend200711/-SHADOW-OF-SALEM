/* ═══════════════════════════════════════════════════════════════
   Shadow of Salem — storage.js
   Cloudflare R2 Media Storage Adapter

   This is the ONLY place in the frontend that knows about R2.
   Everything else calls these functions.

   Architecture:
     Browser → requestUploadAuth() → R2 Worker (/upload-auth)
             ← presigned PUT URL + mediaKey
     Browser → PUT <file> directly to R2 via presigned URL
     Browser → saves mediaKey + permanent public URL to Firestore

   The R2 Secret Access Key NEVER reaches the browser.
   The Worker verifies the Firebase ID token before issuing URLs.

   Public media delivery:
     Configure your R2 bucket with a public custom domain or use
     the r2.dev subdomain.  Set the MEDIA_PUBLIC_BASE_URL constant
     below to that base URL (no trailing slash).
     e.g.  https://media.shadowofsalem.com
     or    https://pub-<hash>.r2.dev

   Worker URL:
     After deploying r2-worker/ set WORKER_URL below to its URL.
     e.g.  https://shadow-of-salem-r2.<account>.workers.dev
═══════════════════════════════════════════════════════════════ */

// ─── Configuration ────────────────────────────────────────────
// Replace these two values after you have deployed the Worker and
// configured public access on your R2 bucket.
//
// WORKER_URL        — the deployed Worker URL (no trailing slash)
//   Find it: Cloudflare Dashboard → Workers & Pages → shadow-of-salem-r2 → the URL shown
//   Format:  https://shadow-of-salem-r2.<YOUR-ACCOUNT>.workers.dev
//
// MEDIA_PUBLIC_BASE — the public base URL for R2 objects (no trailing slash)
//   Find it: Cloudflare Dashboard → R2 → shadow-of-salem-media → Settings → Public Access
//   Format:  https://pub-<hash>.r2.dev  OR  https://media.yourdomain.com
//
// These are NOT secrets — they are just endpoint URLs.
// The actual R2 secret key lives only in the Worker.

export const WORKER_URL        = 'REPLACE_WITH_WORKER_URL';   // e.g. https://shadow-of-salem-r2.abc123.workers.dev
export const MEDIA_PUBLIC_BASE = 'REPLACE_WITH_R2_PUBLIC_URL'; // e.g. https://pub-abc123.r2.dev

// ─── Types / constants ────────────────────────────────────────

/**
 * Supported media kinds and their R2 folder mapping.
 * Matches the FOLDER_MAP in the Worker.
 */
export const MEDIA_KINDS = {
  music:   'music',
  audio:   'audio',
  video:   'video',
  art:     'art',
  image:   'image',
  profile: 'profile',
  cover:   'cover',
};

// ─── Core functions ───────────────────────────────────────────

/**
 * Request a presigned upload URL from the Worker.
 *
 * @param {string}   idToken   — Firebase ID token (from getIdToken())
 * @param {string}   uid       — Firebase UID
 * @param {File}     file      — the File object to upload
 * @param {string}   mediaKind — one of MEDIA_KINDS
 * @returns {Promise<{ uploadUrl: string, mediaKey: string }>}
 */
async function requestUploadAuth(idToken, uid, file, mediaKind) {
  // ── Guard: catch un-replaced placeholder URLs before making a useless request ──
  if (WORKER_URL.startsWith('REPLACE_') || WORKER_URL.includes('REPLACE_WITH')) {
    throw new Error(
      'WORKER_URL has not been set in storage.js. ' +
      'Open Cloudflare Dashboard → Workers & Pages → shadow-of-salem-r2 ' +
      'and copy the Worker URL into WORKER_URL in storage.js.'
    );
  }

  const endpoint = `${WORKER_URL}/upload-auth`;

  console.log('[R2] Requesting upload authorization');
  console.log('[R2] Authorization endpoint:', endpoint);
  console.log('[R2] mediaKind:', mediaKind, '| fileName:', file.name, '| fileSize:', file.size, '| mimeType:', file.type);

  let resp;
  try {
    resp = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        uid,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        mediaKind,
      }),
    });
  } catch (networkErr) {
    console.error('[R2] Network error contacting Worker:', networkErr);
    throw new Error(
      `Network error reaching Worker at ${endpoint}. ` +
      'Check WORKER_URL in storage.js and that the Worker is deployed.'
    );
  }

  console.log('[R2] Authorization response status:', resp.status, resp.statusText);

  if (!resp.ok) {
    let errBody;
    try { errBody = await resp.json(); } catch { errBody = { error: resp.statusText }; }
    console.error('[R2] Authorization response:', errBody);

    const httpLabel = {
      400: '400 Bad Request',
      401: '401 Authentication required',
      403: '403 Upload not authorized',
      404: '404 Worker endpoint not found — check WORKER_URL',
      405: '405 Method not allowed',
      413: '413 File too large',
      500: '500 Worker error',
      503: '503 Storage unavailable',
    }[resp.status] || `HTTP ${resp.status}`;

    throw new Error(`${httpLabel} — ${errBody.error || resp.statusText}`);
  }

  const result = await resp.json();
  console.log('[R2] Authorization succeeded — mediaKey:', result.mediaKey);
  return result; // { uploadUrl, mediaKey, expires }
}

/**
 * Upload a file directly to R2 using the presigned PUT URL.
 * Calls onProgress(percent) periodically during upload.
 *
 * @param {string}   uploadUrl   — presigned PUT URL from the Worker
 * @param {File}     file        — the File to upload
 * @param {Function} onProgress  — called with 0–100
 * @returns {Promise<void>}
 */
async function putToR2(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 PUT failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));

    xhr.timeout = 5 * 60 * 1000; // 5-minute timeout
    xhr.send(file);
  });
}

/**
 * Convert a mediaKey to a permanent public delivery URL.
 * Uses the configured MEDIA_PUBLIC_BASE.
 *
 * @param {string} mediaKey — R2 object key, e.g. users/uid/creations/audio/abc.mp3
 * @returns {string}
 */
export function getMediaUrl(mediaKey) {
  if (!mediaKey) return '';
  return `${MEDIA_PUBLIC_BASE}/${mediaKey}`;
}

/**
 * Upload a media file to R2.
 *
 * Handles the full flow:
 *   1. Request presigned URL from Worker (verifies Firebase auth)
 *   2. PUT file directly to R2
 *   3. Return { mediaKey, mediaUrl } for saving to Firestore
 *
 * @param {Object}   opts
 * @param {File}     opts.file       — the File to upload
 * @param {string}   opts.mediaKind  — 'music' | 'audio' | 'video' | 'art' | 'profile' | 'cover'
 * @param {Function} [opts.onProgress]  — called with { stage: string, percent: number }
 * @param {Object}   opts.auth       — { currentUser } from Firebase Auth
 * @returns {Promise<{ mediaKey: string, mediaUrl: string, mimeType: string, fileSize: number }>}
 */
export async function uploadMedia({ file, mediaKind, onProgress, auth }) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');

  const progress = (stage, percent) => {
    if (onProgress) onProgress({ stage, percent });
  };

  progress('Preparing…', 0);

  // 1. Get fresh ID token
  const idToken = await user.getIdToken(/* forceRefresh= */ false);

  progress('Preparing…', 5);

  // 2. Request presigned PUT URL from Worker
  let authResult;
  try {
    authResult = await requestUploadAuth(idToken, user.uid, file, mediaKind);
  } catch (e) {
    throw new Error('Could not get upload authorization: ' + e.message);
  }

  const { uploadUrl, mediaKey } = authResult;

  progress('Uploading…', 10);

  // 3. Upload to R2 directly
  await putToR2(uploadUrl, file, pct => {
    // Scale to 10–90 range so we have room for pre/post steps
    progress('Uploading…', 10 + Math.round(pct * 0.8));
  });

  progress('Processing…', 95);

  const mediaUrl = getMediaUrl(mediaKey);

  progress('Done', 100);

  return {
    mediaKey,
    mediaUrl,
    mimeType: file.type,
    fileSize: file.size,
  };
}

/**
 * Delete a media object from R2 via the Worker.
 * The Worker verifies the Firebase token and that the key belongs to the user.
 *
 * @param {string}   mediaKey  — R2 object key to delete
 * @param {Object}   auth      — { currentUser } from Firebase Auth
 * @returns {Promise<void>}
 */
export async function deleteMedia(mediaKey, auth) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');
  if (!mediaKey) return; // nothing to delete

  const idToken    = await user.getIdToken(false);
  const encodedKey = mediaKey.split('/').map(encodeURIComponent).join('/');

  const resp = await fetch(`${WORKER_URL}/media/${encodedKey}`, {
    method:  'DELETE',
    headers: { 'Authorization': `Bearer ${idToken}` },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    // 404 means already gone — treat as success
    if (resp.status !== 404) {
      throw new Error(err.error || `Delete failed (${resp.status})`);
    }
  }
}

// ─── File validation helpers ──────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg']);

const MAX_IMAGE_BYTES = 20  * 1024 * 1024;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2   * 1024 * 1024 * 1024;

/**
 * Validate a file before uploading.
 * Returns null if valid, or an error string.
 *
 * @param {File}   file
 * @param {string} mediaKind  — 'music'|'audio'|'video'|'art'|'image'|'profile'|'cover'
 * @returns {string|null}
 */
export function validateMediaFile(file, mediaKind) {
  if (!file) return 'No file selected.';

  const mime = file.type;

  if (mediaKind === 'video') {
    if (!ALLOWED_VIDEO_TYPES.has(mime)) return `Unsupported video format. Use MP4 or WEBM.`;
    if (file.size > MAX_VIDEO_BYTES)   return `Video too large (max 2 GB).`;
  } else if (mediaKind === 'music' || mediaKind === 'audio') {
    if (!ALLOWED_AUDIO_TYPES.has(mime)) return `Unsupported audio format. Use MP3, WAV, M4A, or AAC.`;
    if (file.size > MAX_AUDIO_BYTES)    return `Audio file too large (max 200 MB).`;
  } else {
    // image / art / profile / cover
    if (!ALLOWED_IMAGE_TYPES.has(mime)) return `Unsupported image format. Use JPG, PNG, WEBP, or GIF.`;
    if (file.size > MAX_IMAGE_BYTES)    return `Image too large (max 20 MB).`;
  }

  return null;
}
