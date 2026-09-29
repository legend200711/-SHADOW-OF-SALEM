# OMEGA UNIVERSE
## CREATE · DISCOVER · EXPERIENCE

A **frontend-only** digital creation universe. No backend, no database, no authentication required.

---

## What Is Omega Universe?

Omega Universe is a **digital creation platform** — not a social network.

People use it to:
- Upload and publish **music, audio, beats, and mixes**
- Share **digital art, illustrations, and photography**
- Post **videos and short films**
- Organise creations into **Collections**
- Discover creations in the **Omega Stream** and **Omega Gallery**
- Play audio through the **Omega Player** (persistent, full-featured)

---

## Architecture

```
omega-universe/
├── index.html      — App shell, navigation, persistent player
├── style.css       — Full design system (dark, electric blue, cosmic)
├── app.js          — All pages, state, player, routing
└── manifest.json   — PWA manifest
```

**Single-file frontend prototype.** All data lives in `sessionStorage` (creations) and `localStorage` (likes, comments, profile).

---

## Navigation

| Route | Description |
|---|---|
| Stream | Discovery stream of all digital creations |
| Explore | Omega Gallery — browse by category with search |
| Music | Music-only gallery |
| Video | Video-only gallery |
| Art | Art & images gallery |
| Collections | Organisational groups of creations |
| Create | Creator Space — upload and publish |
| Search | Content-first search |
| Profile | Your profile and creations |

---

## Omega Player

Persistent audio player at the bottom of the screen. Supports:
- Play / Pause / Previous / Next
- Seekable progress bar
- Volume control
- Mini-player with artwork, title, creator
- Queue (all audio in current session)
- Keyboard shortcut: `Space` or `K` to play/pause

---

## Creator Space

Upload images, audio, video, and art **locally in the browser**.
- File preview before publishing
- Title, description, category, tags
- Published creations appear in Stream and profile
- Data resets on page refresh (prototype behaviour)

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

## Source

Extracted and rebuilt from **Shadow Feature Library** components:
- Audio player pattern → `shadowvoltix-main` PlayerContext + MiniPlayer
- Media cards → `shadowvoltix-main` AudioCard
- Gallery + lightbox → `AVENORA12-main` gallery.js
- Upload UI → `shadow-waves-main` sfl-upload.html
- Profile UI → `shadowvoltix-main` ProfilePage
- Music CSS tokens → `AVENORA12-main` music.css

---

> **Omega Universe is NOT a social network.**
> It is a place where digital creations live.
