/* ═══════════════════════════════════════════════════════════════
   Shadow of Salem — storage.js
   Cloudflare R2 Media Storage Adapter

   This is the ONLY place in the frontend that knows about R2.
   Everything else calls these functions.

   Architecture:
     Browser → POST /upload-auth { uid, fileName, mimeType, fileSize, mediaKind }
                                 Authorization: Bearer <firebase-id-token>
             ← { uploadToken, mediaKey, expires }

     Browser → PUT /upload/<mediaKey>
                                 X-Upload-Token: <uploadToken>
                                 Content-Type: <mimeType>
                                 body: raw file bytes
             ← { ok: true, mediaKey }

     Browser → saves mediaKey + permanent public URL to Firestore

   The R2 secret key NEVER reaches the browser.
   The Worker verifies the Firebase ID token before issuing upload tokens.

   Public media delivery:
     Configure your R2 bucket with a public custom domain or use the
     r2.dev subdomain.  Set MEDIA_PUBLIC_BASE below to that base URL
     (no trailing slash).
     e.g.  https://media.shadowofsalem.com
     or    https://pub-<hash>.r2.dev

   Worker URL:
     Deployed at: https://shadow-of-salem-r2.nthntjrn.workers.dev
═══════════════════════════════════════════════════════════════ */

// ─── Configuration ────────────────────────────────────────────

// WORKER_URL — the deployed Worker (no trailing slash)
export const WORKER_URL = 'https://shadow-of-salem-r2.nthntjrn.workers.dev';

// MEDIA_PUBLIC_BASE — public base URL for R2 objects (no trailing slash)
// Set this to your R2 bucket's public URL once you enable public access.
// Find it: Cloudflare Dashboard → R2 → shadow-of-salem-media → Settings → Public Access
// Format:  https://pub-<hash>.r2.dev  OR  https://media.yourdomain.com
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
 * Step 1: Request an upload token from the Worker.
 * The Worker verifies the Firebase ID token and returns a short-lived
 * upload token that authorises the subsequent PUT.
 */
async function requestUploadAuth(idToken, uid, file, mediaKind) {
  const endpoint = `${WORKER_URL}/upload-auth`;

  console.log('[R2] Requesting upload authorization');
  console.log('[R2] Endpoint:', endpoint);
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
      'Check that the Worker is deployed and WORKER_URL is correct.'
    );
  }

  console.log('[R2] Authorization response status:', resp.status, resp.statusText);

  if (!resp.ok) {
    let errBody;
    try { errBody = await resp.json(); } catch { errBody = { error: resp.statusText }; }
    console.error('[R2] Authorization failed — HTTP', resp.status, '—', errBody);

    const httpLabel = {
      400: '400 Bad Request',
      401: '401 Authentication required',
      403: '403 Upload not authorized',
      404: '404 Worker endpoint not found',
      405: '405 Method not allowed',
      413: '413 File too large',
      500: '500 Worker error',
      503: '503 Storage unavailable',
    }[resp.status] || `HTTP ${resp.status}`;

    throw new Error(`${httpLabel} — ${errBody.error || resp.statusText}`);
  }

  const result = await resp.json();
  console.log('[R2] Authorization succeeded — mediaKey:', result.mediaKey);
  return result; // { uploadToken, mediaKey, expires }
}

/**
 * Step 2: Upload a file directly to R2 through the Worker.
 * Sends the raw file as the request body with the upload token for auth.
 * Calls onProgress(percent) periodically during upload.
 */
function putToWorker(uploadToken, mediaKey, file, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `${WORKER_URL}/upload/${mediaKey.split('/').map(encodeURIComponent).join('/')}`;

    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('X-Upload-Token', uploadToken);

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
        let errMsg = `R2 upload failed: HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.error) errMsg += ' — ' + body.error;
        } catch { /* ignore */ }
        console.error('[R2] PUT failed:', errMsg, '| response:', xhr.responseText);
        reject(new Error(errMsg));
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
 *   1. Request upload token from Worker (verifies Firebase auth)
 *   2. PUT file through Worker directly to R2
 *   3. Return { mediaKey, mediaUrl } for saving to Firestore
 *
 * @param {Object}   opts
 * @param {File}     opts.file        — the File to upload
 * @param {string}   opts.mediaKind   — 'music' | 'audio' | 'video' | 'art' | 'profile' | 'cover'
 * @param {Function} [opts.onProgress] — called with { stage: string, percent: number }
 * @param {Object}   opts.auth        — { currentUser } from Firebase Auth
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

  // 2. Request upload token from Worker
  let authResult;
  try {
    authResult = await requestUploadAuth(idToken, user.uid, file, mediaKind);
  } catch (e) {
    console.error('[R2] requestUploadAuth failed:', e.message);
    throw new Error('Could not get upload authorization: ' + e.message);
  }

  const { uploadToken, mediaKey } = authResult;

  progress('Uploading…', 10);

  // 3. Upload to R2 through Worker
  try {
    await putToWorker(uploadToken, mediaKey, file, pct => {
      // Scale to 10–90 range so we have room for pre/post steps
      progress('Uploading…', 10 + Math.round(pct * 0.8));
    });
  } catch (e) {
    console.error('[R2] putToWorker failed:', e.message);
    throw new Error('Upload to R2 failed: ' + e.message);
  }

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
