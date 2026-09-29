/* ═══════════════════════════════════════════════════════════════
   Shadow of Salem — Cloudflare R2 Upload Worker
   src/index.js

   Endpoints:
     POST /upload-auth    — verify Firebase JWT, return presigned PUT URL + key
     DELETE /media/:key*  — verify Firebase JWT, verify ownership, delete object
     OPTIONS /*           — CORS preflight

   Environment bindings expected (set via wrangler secret or R2 binding):
     MEDIA_BUCKET         R2 bucket binding
     ALLOWED_ORIGIN       production origin string, e.g. https://shadowofsalem.com
     FIREBASE_PROJECT_ID  Firebase project ID (for JWT verification)
     R2_ACCOUNT_ID        Cloudflare account ID  (for S3-compat presign)
     R2_ACCESS_KEY_ID     R2 S3-compat access key ID
     R2_SECRET_ACCESS_KEY R2 S3-compat secret access key (NEVER sent to browser)
═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── CORS helpers ─────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || '';
  // During development ALLOWED_ORIGIN may contain comma-separated values
  const allowedList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowedList.length === 0 || allowedList.includes(origin);
  return {
    'Access-Control-Allow-Origin':  ok ? origin : allowedList[0] || '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

function json(data, status = 200, origin = '*', env = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
  });
}

// ─── Firebase JWT verification ────────────────────────────────
// We verify the Firebase ID token signature using Google's public JWKs.
// This is a lightweight implementation that checks:
//   - iss (issuer)   — must be accounts.google.com or securetoken.google.com
//   - aud (audience) — must be the Firebase project ID
//   - exp (expiry)   — must not be in the past
//   - sub (subject)  — non-empty string (= Firebase UID)
//
// We verify the signature against the current Firebase public certs
// (fetched from a well-known Google URL; cached per request).

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

async function verifyFirebaseToken(token, projectId) {
  // 1. Decode header + payload (no signature check yet)
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  function b64url(s) {
    const padded = s + '=='.slice(0, (4 - (s.length % 4)) % 4);
    return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  }

  const header  = JSON.parse(b64url(parts[0]));
  const payload = JSON.parse(b64url(parts[1]));

  // 2. Basic claim validation
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now)             throw new Error('Token expired');
  if (payload.aud !== projectId)      throw new Error('Token audience mismatch');
  const validIssuers = [
    `https://securetoken.google.com/${projectId}`,
    'https://accounts.google.com',
  ];
  if (!validIssuers.includes(payload.iss)) throw new Error('Token issuer invalid');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('No subject');

  // 3. Fetch Google public certs and verify signature
  const certsResp = await fetch(FIREBASE_CERTS_URL, { cf: { cacheTtl: 3600 } });
  if (!certsResp.ok) throw new Error('Could not fetch Firebase certs');
  const certs = await certsResp.json();

  const certPem = certs[header.kid];
  if (!certPem) throw new Error(`No cert for kid ${header.kid}`);

  // Convert PEM → CryptoKey
  const pemBody   = certPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const derBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'spki', derBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  // Re-encode header.payload bytes for signature verification
  const encoder  = new TextEncoder();
  const sigInput = encoder.encode(parts[0] + '.' + parts[1]);
  const sigBytes = Uint8Array.from(b64url(parts[2]), c => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, sigInput
  );
  if (!valid) throw new Error('Signature verification failed');

  return payload; // { sub: uid, email, ... }
}

// ─── AWS Signature v4 presigned URL (S3-compatible) ──────────
// Cloudflare R2 supports S3-compatible presigned PUT URLs.
// We compute a presigned PUT URL that the browser can use
// to upload directly to R2 — the secret key never leaves the Worker.

async function presignPut(env, key, mimeType, expiresSeconds = 300) {
  const region    = 'auto';
  const service   = 's3';
  const accountId = env.R2_ACCOUNT_ID;
  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;
  const bucket    = env.MEDIA_BUCKET_NAME || 'shadow-of-salem-media';

  const host      = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint  = `https://${host}/${bucket}/${key}`;

  const now       = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');     // 20240101
  const amzDate   = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; // 20240101T120000Z

  const credential = `${accessKey}/${dateStamp}/${region}/${service}/aws4_request`;

  const params = new URLSearchParams({
    'X-Amz-Algorithm':     'AWS4-HMAC-SHA256',
    'X-Amz-Credential':    credential,
    'X-Amz-Date':          amzDate,
    'X-Amz-Expires':       String(expiresSeconds),
    'X-Amz-SignedHeaders': 'content-type;host',
  });
  params.sort();

  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    params.toString(),
    `content-type:${mimeType}\nhost:${host}\n`,
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign    = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const enc   = new TextEncoder();
  const hmac  = async (key, data) => {
    const k = typeof key === 'string' ? enc.encode(key) : key;
    const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', ck, enc.encode(data)));
  };

  const signingKey = await hmac(
    await hmac(
      await hmac(
        await hmac('AWS4' + secretKey, dateStamp),
        region
      ),
      service
    ),
    'aws4_request'
  );

  const signatureBytes = await hmac(signingKey, stringToSign);
  const signature = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  params.set('X-Amz-Signature', signature);

  return `${endpoint}?${params.toString()}`;
}

async function sha256hex(str) {
  const buf    = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Key generation ───────────────────────────────────────────

function generateKey(uid, folder, originalName) {
  const ext  = (originalName.split('.').pop() || 'bin').toLowerCase().slice(0, 10);
  const rand = crypto.randomUUID().replace(/-/g, '');
  return `users/${uid}/${folder}/${rand}.${ext}`;
}

const FOLDER_MAP = {
  music:   'creations/audio',
  audio:   'creations/audio',
  video:   'creations/video',
  art:     'creations/artwork',
  image:   'creations/images',
  profile: 'profile',
  cover:   'covers',
};

// ─── Allowed MIME types ───────────────────────────────────────

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/ogg', 'audio/webm',
  'video/mp4', 'video/webm', 'video/ogg',
]);

const MAX_SIZES = {
  image:   20 * 1024 * 1024,   // 20 MB
  audio:   200 * 1024 * 1024,  // 200 MB
  video:   2 * 1024 * 1024 * 1024, // 2 GB (presigned upload; actual limit enforced by R2)
};

function mimeCategory(mime) {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

// ─── Main handler ─────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin  = request.headers.get('Origin') || '';
    const url     = new URL(request.url);
    const method  = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    const path = url.pathname;

    // ── POST /upload-auth ─────────────────────────────────────
    // Body: { uid, fileName, mimeType, fileSize, mediaKind }
    // Returns: { uploadUrl, mediaKey, expires }
    if (method === 'POST' && path === '/upload-auth') {
      // 1. Read + verify the Firebase ID token
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return json({ error: 'Missing Authorization' }, 401, origin, env);

      const projectId = env.FIREBASE_PROJECT_ID;
      if (!projectId) return json({ error: 'Worker not configured — missing FIREBASE_PROJECT_ID' }, 500, origin, env);

      let claims;
      try {
        claims = await verifyFirebaseToken(token, projectId);
      } catch (e) {
        return json({ error: 'Unauthorized: ' + e.message }, 401, origin, env);
      }

      const tokenUid = claims.sub;

      // 2. Parse + validate request body
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, origin, env); }

      const { uid, fileName, mimeType, fileSize, mediaKind } = body;

      // UID in body must match the verified token UID
      if (!uid || uid !== tokenUid) {
        return json({ error: 'UID mismatch' }, 403, origin, env);
      }

      if (!ALLOWED_MIME.has(mimeType)) {
        return json({ error: `Unsupported media type: ${mimeType}` }, 400, origin, env);
      }

      const cat    = mimeCategory(mimeType);
      const maxSz  = MAX_SIZES[cat] || MAX_SIZES.image;
      if (fileSize > maxSz) {
        return json({ error: `File too large (max ${maxSz / 1024 / 1024} MB for ${cat})` }, 413, origin, env);
      }

      const folder = FOLDER_MAP[mediaKind] || 'creations/other';
      const key    = generateKey(uid, folder, fileName || 'upload');

      // 3. Generate presigned PUT URL (valid 5 minutes)
      let uploadUrl;
      try {
        uploadUrl = await presignPut(env, key, mimeType, 300);
      } catch (e) {
        console.error('presignPut error:', e);
        return json({ error: 'Could not generate upload URL. Check R2 Worker secrets.' }, 500, origin, env);
      }

      return json({ uploadUrl, mediaKey: key, expires: Date.now() + 300_000 }, 200, origin, env);
    }

    // ── DELETE /media/:key* ───────────────────────────────────
    // URL:  /media/users/{uid}/...
    // Auth: Authorization: Bearer <Firebase ID token>
    if (method === 'DELETE' && path.startsWith('/media/')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return json({ error: 'Missing Authorization' }, 401, origin, env);

      const projectId = env.FIREBASE_PROJECT_ID;
      if (!projectId) return json({ error: 'Worker not configured' }, 500, origin, env);

      let claims;
      try {
        claims = await verifyFirebaseToken(token, projectId);
      } catch (e) {
        return json({ error: 'Unauthorized: ' + e.message }, 401, origin, env);
      }

      // Key is everything after /media/
      const mediaKey = decodeURIComponent(path.slice('/media/'.length));

      // Verify the key belongs to this user: key must start with users/{uid}/
      const expectedPrefix = `users/${claims.sub}/`;
      if (!mediaKey.startsWith(expectedPrefix)) {
        return json({ error: 'Forbidden: you can only delete your own media' }, 403, origin, env);
      }

      try {
        await env.MEDIA_BUCKET.delete(mediaKey);
      } catch (e) {
        console.error('R2 delete error:', e);
        return json({ error: 'Delete failed' }, 500, origin, env);
      }

      return json({ deleted: true, mediaKey }, 200, origin, env);
    }

    return json({ error: 'Not found' }, 404, origin, env);
  },
};
