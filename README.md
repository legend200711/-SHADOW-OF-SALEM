# SHADOW OF SALEM
## CREATE · DISCOVER · EXPERIENCE

A **production web application** for digital creators. Upload, publish, and discover music, art, video, and more — powered by Firebase Authentication and Cloud Firestore.

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
├── manifest.json   — PWA manifest
└── firestore.rules — Firestore security rules
```

**Single-page application.** All persistent data lives in Cloud Firestore. Local media (audio/video/images) is held in memory as `blob:` URLs during the session — Firebase Storage is intentionally disabled.

---

## Authentication

- Firebase Email/Password Authentication
- Persistent sessions — users stay signed in across browser restarts
- Instant state update after login/logout — **no manual refresh required**
- Single authoritative `onAuthStateChanged` listener
- Signup creates a Firestore profile in `users/{uid}`
- Branded startup screen shown during Firebase Auth initialisation
- Boot states: `booting` → `authenticated` / `guest`
- 8-second safety timeout prevents a blank screen on slow networks

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

---

## Creator Space

Upload images, audio, video, and art. Text-only posts also supported.
- File preview before publishing
- Title, description, category, tags, creator note
- Published creations persist in Firestore and appear across all sessions
- Like, comment, and share creations
- Edit and delete own creations

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
- **Storage:** Disabled — all media is local `blob:` URLs
- **Analytics:** Optional (gracefully disabled if blocked)

---

> **Shadow of Salem is NOT a social network.**
> It is a place where digital creations live.
