# SHADOW OF SALEM
## CREATE · DISCOVER · EXPERIENCE

A **production web application** for digital creators. Upload, publish, and discover music, art, video, and more — powered by Firebase Authentication, Cloud Firestore, and Cloudflare R2 media storage.

---

## What Is Shadow of Salem?

Shadow of Salem is a **digital creation platform** — not a social network.

People use it to:
- Upload and publish **music, audio, beats, and mixes**
- Share **digital art, illustrations, and photography**
- Post **videos and short films**
- Write **text-based posts and creator notes**
- Organise creations into **Collections**
- Discover creations in the **Shadow Stream** and Gallery
- Play audio through the **Omega Player** (persistent, full-featured)
- Build and manage a **Creator Profile**

---

## Architecture

```
shadow-of-salem/
├── index.html      — App shell, startup screen, navigation, persistent player
├── style.css       — Full design system (dark, electric blue, cosmic)
├── app.js          — All pages, state, player, routing, auth, Firestore
├── firebase.js     — Firebase initialisation (single point, no duplicates)
├── storage.js      — Cloudflare R2 storage adapter (upload, delete, getMediaUrl)
├── r2-worker/      — Cloudflare Worker: secure upload auth + R2 delete endpoint
│   ├── wrangler.jsonc
│   └── src/index.js
├── manifest.json   — PWA manifest
└── firestore.rules — Firestore security rules
```

**Single-page application.** All persistent data lives in Cloud Firestore. Media files (audio, video, images) are stored permanently in Cloudflare R2.

---

## Storage Architecture

```
FIREBASE AUTHENTICATION
        ↓
USER IDENTITY

CLOUD FIRESTORE
        ↓
STRUCTURED DATA / METADATA
(creatorId, title, mediaUrl, mediaKey, mimeType, fileSize, …)

CLOUDFLARE R2
        ↓
PERMANENT MEDIA STORAGE
(audio, video, images, profile pictures, cover images)

WEBRTC + SFU  (separate — not handled by R2)
        ↓
LIVE AUDIO/VIDEO
```

### R2 Object Layout

```
users/{uid}/profile/        ← profile pictures
users/{uid}/covers/         ← cover images
users/{uid}/creations/audio/  ← music / audio
users/{uid}/creations/video/  ← video
users/{uid}/creations/artwork/ ← art / images
```

---

## Upload Flow

```
USER SELECTS MEDIA
        ↓
LOCAL PREVIEW (blob: URL — instant, client-side)
        ↓
VALIDATE FILE (type + size)
        ↓
REQUEST SECURE UPLOAD AUTHORIZATION
  → Worker verifies Firebase ID token
  ← Worker returns presigned PUT URL (valid 5 min)
        ↓
UPLOAD FILE DIRECTLY TO R2  (via presigned URL, no proxy)
  (progress: Preparing… → Uploading 10%…90% → Processing…)
        ↓
R2 PERMANENT DELIVERY URL resolved
        ↓
SAVE METADATA TO FIRESTORE
  (mediaUrl, mediaKey, mimeType, fileSize, creatorId, …)
        ↓
NAVIGATE TO VIEWER
```

### Security

- The **R2 Secret Access Key never reaches the browser**
- The **Worker verifies the Firebase ID token** before issuing any presigned URL
- The **Worker verifies ownership** before deleting any R2 object
- `ALLOWED_ORIGIN` restricts CORS to the production domain only
- Presigned PUT URLs expire after 5 minutes

---

## Deploying the R2 Worker

```bash
cd r2-worker
npm install -g wrangler          # if not already installed

# Set secrets (one-time, stored in Cloudflare)
npx wrangler secret put FIREBASE_PROJECT_ID    # e.g. legend-4af26
npx wrangler secret put R2_ACCOUNT_ID          # Cloudflare account ID
npx wrangler secret put R2_ACCESS_KEY_ID       # R2 API token key ID
npx wrangler secret put R2_SECRET_ACCESS_KEY   # R2 API token secret
npx wrangler secret put ALLOWED_ORIGIN         # e.g. https://shadowofsalem.pages.dev
npx wrangler secret put MEDIA_BUCKET_NAME      # e.g. shadow-of-salem-media

npx wrangler deploy
```

After deploy, copy the Worker URL and set it in [`storage.js`](storage.js):

```js
export const WORKER_URL        = 'https://shadow-of-salem-r2.<account>.workers.dev';
export const MEDIA_PUBLIC_BASE = 'https://pub-<hash>.r2.dev'; // or custom domain
```

### R2 Bucket Setup

1. Go to **Cloudflare Dashboard → R2 → Create bucket** — name it `shadow-of-salem-media`
2. Enable **Public Access** on the bucket (or add a custom domain)
3. Copy the public bucket URL → paste into `MEDIA_PUBLIC_BASE` in `storage.js`
4. Create an **R2 API token** with Object Read & Write on this bucket
5. Use those credentials as `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` secrets

### CORS on the R2 Bucket

Presigned PUT URLs bypass bucket-level CORS, so no additional CORS configuration on the bucket is required. Worker-level CORS is handled in `r2-worker/src/index.js` and restricted to `ALLOWED_ORIGIN`.

---

## Authentication

- Firebase Email/Password Authentication
- Persistent sessions — users stay signed in across browser restarts
- Instant state update after login/logout — **no manual refresh required**
- Single authoritative `onAuthStateChanged` listener
- Signup creates a Firestore profile in `users/{uid}`
- Branded startup screen shown during Firebase Auth initialisation

---

## Navigation

| Route | Description |
|---|---|
| `#/stream` | Shadow Stream — discovery feed of all creations |
| `#/explore` | Gallery — browse by category with search |
| `#/music` | Music-only gallery |
| `#/video` | Video-only gallery |
| `#/art` | Art & image gallery |
| `#/collections` | Organisational groups of creations |
| `#/create` | Creator Space — upload and publish |
| `#/search` | Content-first search |
| `#/profile/my` | Your own profile |
| `#/profile/:id` | Any creator's profile |
| `#/viewer/:id` | Full creation viewer |

---

## Omega Player

Persistent audio player at the bottom of the screen. Supports:
- Play / Pause / Previous / Next
- Seekable progress bar
- Volume control
- Mini-player with artwork, title, creator
- Queue (all audio in current session)
- Keyboard shortcuts: `Space` or `K` to play/pause, `Alt+←/→` for prev/next
- Streams audio from R2 permanent URLs — works cross-device after upload

---

## Creator Space

Upload images, audio, video, and art. Text-only posts also supported.
- File preview before publishing (local blob URL — instant)
- Upload progress bar: Preparing → Uploading N% → Processing → Published
- Publish button disabled during upload; never publishes a broken creation
- Title, description, category, tags, creator note
- Published creations persist in Firestore + R2 and appear across all sessions and devices
- Like, comment, and share creations
- Edit and delete own creations
- Deleting a creation also removes its R2 media (via Worker ownership check)

---

## Profile

- Profile picture upload → stored in R2 (`users/{uid}/profile/`)
- Cover image upload → stored in R2 (`users/{uid}/covers/`)
- Permanent URLs saved to `users/{uid}` in Firestore
- Displayed on the profile page and shared across devices

---

## Supported Media

| Type | Formats |
|---|---|
| Images | JPG/JPEG, PNG, WEBP, GIF |
| Audio | MP3, WAV, M4A/AAC, OGG |
| Video | MP4, WEBM |

---

## Design System

| Token | Value |
|---|---|
| Background | `#000008` (deep space black) |
| Electric Blue | `#00c8ff` |
| Neon Green | `#39ff14` |
| Cosmic Purple | `#a855f7` |
| Brand Font | Orbitron |
| UI Font | Inter |

---

## Firebase

- **Authentication:** Email/Password (enabled)
- **Firestore:** `creations`, `collections`, `likes`, `users` collections
- **Storage:** Disabled — media lives in Cloudflare R2, not Firebase Storage
- **Analytics:** Optional (gracefully disabled if blocked)

---

> **Shadow of Salem is NOT a social network.**
> It is a place where digital creations live.
