/* ═══════════════════════════════════════════════════════════════
   Shadow of Salem — Cloudflare R2 Upload Worker
   src/index.js

   Endpoints:
     GET  /health             — liveness check (no auth required)
     POST /upload-auth        — verify Firebase JWT, return authorized upload ticket
     PUT  /upload/:key*       — upload file body directly to R2 (ticket auth)
     DELETE /media/:key*      — verify Firebase JWT, verify ownership, delete object
     OPTIONS /*               — CORS preflight

   Architecture (no S3 HMAC keys required):
     Browser → POST /upload-auth  { uid, fileName, mimeType, fileSize, mediaKind }
                                  Authorization: Bearer <firebase-id-token>
             ← { uploadToken, mediaKey, expires }

     Browser → PUT /upload/<mediaKey>
                                  X-Upload-Token: <uploadToken>
                                  Content-Type: <mimeType>
                                  body: raw file bytes
             ← { ok: true, mediaKey }

   Environment bindings expected:
     MEDIA_BUCKET         R2 bucket binding  (set in wrangler.jsonc)
     ALLOWED_ORIGIN       production origin, e.g. https://legend200711.github.io
     FIREBASE_PROJECT_ID  Firebase project ID (for JWT verification)
     UPLOAD_SECRET        a random secret used to sign upload tokens (wrangler secret)
═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── CORS helpers ─────────────────────────────────────────────

function corsHeaders(origin, env) {
  const allowed = env.ALLOWED_ORIGIN || '';
  const allowedList = allowed.split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowedList.length === 0 || allowedList.includes(origin);
  return {
    'Access-Control-Allow-Origin':  ok ? origin : (allowedList[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Token',
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
// Verifies a Firebase ID token using Google's JWK public-key endpoint.
//
// Google publishes Firebase signing keys as JWKs at:
//   https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
//
// crypto.subtle.importKey('jwk', ...) works natively in Cloudflare Workers.
// We do NOT use the x509 certificate endpoint — importing an X.509 cert as
// 'spki' fails because the cert DER contains the full certificate structure,
// not a bare SubjectPublicKeyInfo blob.

const FIREBASE_JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

async function verifyFirebaseToken(token, projectId) {
  // 1. Split and base64url-decode the three JWT parts
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  function b64urlDecode(s) {
    const padded = s + '=='.slice(0, (4 - (s.length % 4)) % 4);
    return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  }

  const header  = JSON.parse(b64urlDecode(parts[0]));
  const payload = JSON.parse(b64urlDecode(parts[1]));

  // 2. Validate claims before touching the network
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now)        throw new Error('Token expired');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch');
  const validIssuers = [
    `https://securetoken.google.com/${projectId}`,
    'https://accounts.google.com',
  ];
  if (!validIssuers.includes(payload.iss)) throw new Error('Token issuer invalid');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('No subject in token');

  // 3. Fetch Google's JWK set (cached 1 hour by Cloudflare)
  const jwkResp = await fetch(FIREBASE_JWK_URL, { cf: { cacheTtl: 3600 } });
  if (!jwkResp.ok) throw new Error('Could not fetch Firebase public keys');
  const jwkSet = await jwkResp.json();

  // 4. Find the JWK matching the token's key ID
  const jwk = (jwkSet.keys || []).find(k => k.kid === header.kid);
  if (!jwk) throw new Error(`No public key found for kid "${header.kid}"`);

  // 5. Import the JWK — works natively in Cloudflare Workers Web Crypto
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // 6. Verify the signature over header.payload
  const encoder  = new TextEncoder();
  const sigInput = encoder.encode(parts[0] + '.' + parts[1]);

  // base64url → Uint8Array for the signature bytes
  const sigRaw   = b64urlDecode(parts[2]);
  const sigBytes = new Uint8Array(sigRaw.length);
  for (let i = 0; i < sigRaw.length; i++) sigBytes[i] = sigRaw.charCodeAt(i);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, sigInput
  );
  if (!valid) throw new Error('Signature verification failed');

  return payload; // { sub: uid, email, ... }
}

// ─── Upload token (HMAC-SHA-256) ──────────────────────────────
// Signs { key, mimeType, expires } so the PUT endpoint can verify
// the token without calling Firebase again.

async function signUploadToken(secret, key, mimeType, expiresMs) {
  const enc  = new TextEncoder();
  const data = `${key}|${mimeType}|${expiresMs}`;
  const ck   = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', ck, enc.encode(data));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${expiresMs}.${hex}`;
}

async function verifyUploadToken(secret, token, key, mimeType) {
  const [expiresStr, hex] = token.split('.');
  if (!expiresStr || !hex) throw new Error('Malformed upload token');
  const expiresMs = parseInt(expiresStr, 10);
  if (isNaN(expiresMs) || Date.now() > expiresMs) throw new Error('Upload token expired');
  const expected = await signUploadToken(secret, key, mimeType, expiresMs);
  if (expected !== token) throw new Error('Upload token signature invalid');
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
  image: 20  * 1024 * 1024,
  audio: 200 * 1024 * 1024,
  video: 2   * 1024 * 1024 * 1024,
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
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    const path = url.pathname;

    // ── GET /health ───────────────────────────────────────────
    if (method === 'GET' && path === '/health') {
      const bucketOk = !!env.MEDIA_BUCKET;
      const firebaseOk = !!env.FIREBASE_PROJECT_ID;
      const secretOk   = !!env.UPLOAD_SECRET;
      return json({
        ok: bucketOk && firebaseOk && secretOk,
        bucket:   bucketOk   ? 'bound'   : 'MISSING',
        firebase: firebaseOk ? 'set'     : 'MISSING — set FIREBASE_PROJECT_ID secret',
        secret:   secretOk   ? 'set'     : 'MISSING — set UPLOAD_SECRET secret',
      }, 200, origin, env);
    }

    // ── POST /upload-auth ─────────────────────────────────────
    // Body: { uid, fileName, mimeType, fileSize, mediaKind }
    // Returns: { uploadToken, mediaKey, expires }
    if (method === 'POST' && path === '/upload-auth') {
      console.log('[UPLOAD] Request received');

      // 1. Verify Firebase ID token
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return json({ error: 'Missing Authorization header' }, 401, origin, env);

      const projectId = env.FIREBASE_PROJECT_ID;
      if (!projectId) return json({ error: 'Worker misconfigured — missing FIREBASE_PROJECT_ID' }, 500, origin, env);

      let claims;
      try {
        claims = await verifyFirebaseToken(token, projectId);
      } catch (e) {
        console.error('[UPLOAD] Firebase token verification failed:', e.message);
        return json({ error: 'Unauthorized: ' + e.message }, 401, origin, env);
      }
      console.log('[UPLOAD] Authentication verified — uid:', claims.sub);

      const tokenUid = claims.sub;

      // 2. Parse + validate request body
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400, origin, env); }

      const { uid, fileName, mimeType, fileSize, mediaKind } = body;

      if (!uid || uid !== tokenUid) {
        return json({ error: 'UID mismatch' }, 403, origin, env);
      }
      if (!ALLOWED_MIME.has(mimeType)) {
        return json({ error: `Unsupported media type: ${mimeType}` }, 400, origin, env);
      }
      const cat   = mimeCategory(mimeType);
      const maxSz = MAX_SIZES[cat] || MAX_SIZES.image;
      if (fileSize > maxSz) {
        return json({ error: `File too large (max ${maxSz / 1024 / 1024} MB for ${cat})` }, 413, origin, env);
      }
      console.log('[UPLOAD] File validated — kind:', mediaKind, 'mime:', mimeType, 'size:', fileSize);

      // 3. Check R2 binding
      if (!env.MEDIA_BUCKET) {
        console.error('[UPLOAD] R2 binding MEDIA_BUCKET is missing');
        return json({ error: 'R2 bucket not bound — check Worker bindings' }, 500, origin, env);
      }
      console.log('[UPLOAD] R2 binding available');

      // 4. Check upload signing secret
      const uploadSecret = env.UPLOAD_SECRET;
      if (!uploadSecret) {
        console.error('[UPLOAD] UPLOAD_SECRET not set');
        return json({ error: 'Worker misconfigured — missing UPLOAD_SECRET' }, 500, origin, env);
      }

      // 5. Generate upload token (valid 10 minutes)
      const folder  = FOLDER_MAP[mediaKind] || 'creations/other';
      const key     = generateKey(uid, folder, fileName || 'upload');
      const expires = Date.now() + 10 * 60 * 1000;
      const uploadToken = await signUploadToken(uploadSecret, key, mimeType, expires);

      console.log('[UPLOAD] Authorization generated — key:', key);
      return json({ uploadToken, mediaKey: key, expires }, 200, origin, env);
    }

    // ── PUT /upload/:key* ─────────────────────────────────────
    // Headers: X-Upload-Token: <token>  Content-Type: <mimeType>
    // Body: raw file bytes
    if (method === 'PUT' && path.startsWith('/upload/')) {
      const mediaKey = decodeURIComponent(path.slice('/upload/'.length));
      if (!mediaKey) return json({ error: 'Missing media key' }, 400, origin, env);

      const uploadToken = request.headers.get('X-Upload-Token') || '';
      const mimeType    = request.headers.get('Content-Type') || 'application/octet-stream';

      const uploadSecret = env.UPLOAD_SECRET;
      if (!uploadSecret) return json({ error: 'Worker misconfigured — missing UPLOAD_SECRET' }, 500, origin, env);

      try {
        await verifyUploadToken(uploadSecret, uploadToken, mediaKey, mimeType);
      } catch (e) {
        return json({ error: 'Upload not authorized: ' + e.message }, 403, origin, env);
      }

      if (!env.MEDIA_BUCKET) {
        return json({ error: 'R2 bucket not bound' }, 500, origin, env);
      }

      try {
        await env.MEDIA_BUCKET.put(mediaKey, request.body, {
          httpMetadata: { contentType: mimeType },
        });
      } catch (e) {
        console.error('[UPLOAD] R2 put error:', e);
        return json({ error: 'Upload to R2 failed: ' + e.message }, 500, origin, env);
      }

      console.log('[UPLOAD] Response returned — mediaKey:', mediaKey);
      return json({ ok: true, mediaKey }, 200, origin, env);
    }

    // ── DELETE /media/:key* ───────────────────────────────────
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

      const mediaKey = decodeURIComponent(path.slice('/media/'.length));
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
