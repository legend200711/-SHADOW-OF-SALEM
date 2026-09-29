/* ═══════════════════════════════════════════════════════════
   SHADOW OF SALEM — app.js
   ES module. All Firebase calls go through firebase.js.
   Local media (audio/video/images) stays in memory only —
   blob: URLs are never written to Firestore.
═══════════════════════════════════════════════════════════ */

import { auth, db } from './firebase.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

'use strict';

// ─── Seed Data (written once to Firestore if creations collection is empty) ──

const SEED_CREATIONS = [
  {
    id: 'c001', type: 'music', title: 'Nebula Drift', creator: 'SolarPulse',
    creatorId: 'seed_u001',
    description: 'An ambient journey through deep space. Synthesizers, reverb, and cosmic textures layered into a floating dreamscape.',
    category: 'Ambient', tags: ['ambient','space','synth'],
    coverColor: 'linear-gradient(135deg,#000c30,#0a2050,#001040)',
    coverIcon: 'music', duration: 245, likes: 312, comments: 18, plays: 1840,
    createdAt: Date.now() - 86400000 * 2,
    hasLocalMedia: false,
  },
  {
    id: 'c002', type: 'art', title: 'Fractured Light', creator: 'PixelAlchemist',
    creatorId: 'seed_u002',
    description: 'Digital painting exploring refraction, glass, and prismatic light forms.',
    category: 'Digital Art', tags: ['painting','light','abstract'],
    coverColor: 'linear-gradient(135deg,#1a0030,#3d0060,#0a002a)',
    coverIcon: 'art', likes: 527, comments: 31, plays: 2100,
    createdAt: Date.now() - 86400000 * 1,
    hasLocalMedia: false,
  },
  {
    id: 'c003', type: 'video', title: 'Hyperion Reel 2025', creator: 'VaultFilms',
    creatorId: 'seed_u003',
    description: 'A cinematic showreel from the Hyperion project. Shot on location, graded in DaVinci.',
    category: 'Film', tags: ['cinematic','reel','short'],
    coverColor: 'linear-gradient(135deg,#1a1000,#302000,#100800)',
    coverIcon: 'video', duration: 180, likes: 289, comments: 22, plays: 3400,
    createdAt: Date.now() - 86400000 * 3,
    hasLocalMedia: false,
  },
  {
    id: 'c004', type: 'music', title: 'Void Protocol', creator: 'NightCoreX',
    creatorId: 'seed_u004',
    description: 'Hard-hitting electronic beat with heavy bass, distorted synths and 808 rhythms.',
    category: 'Electronic', tags: ['beats','bass','electronic'],
    coverColor: 'linear-gradient(135deg,#0a0010,#200035,#050015)',
    coverIcon: 'music', duration: 198, likes: 445, comments: 27, plays: 5200,
    createdAt: Date.now() - 86400000 * 4,
    hasLocalMedia: false,
  },
  {
    id: 'c005', type: 'art', title: 'Orbital Station 7', creator: 'PixelAlchemist',
    creatorId: 'seed_u002',
    description: 'Concept art for a near-future space station in low Earth orbit.',
    category: 'Concept Art', tags: ['scifi','concept','space'],
    coverColor: 'linear-gradient(135deg,#001520,#003040,#000a15)',
    coverIcon: 'art', likes: 618, comments: 44, plays: 2800,
    createdAt: Date.now() - 86400000 * 1.5,
    hasLocalMedia: false,
  },
  {
    id: 'c006', type: 'audio', title: 'Deep Field Meditation', creator: 'AuraSound',
    creatorId: 'seed_u005',
    description: 'A 40-minute guided meditation set against binaural tones and natural field recordings.',
    category: 'Meditation', tags: ['meditation','binaural','wellness'],
    coverColor: 'linear-gradient(135deg,#001a10,#00301a,#000d08)',
    coverIcon: 'audio', duration: 2400, likes: 193, comments: 12, plays: 920,
    createdAt: Date.now() - 86400000 * 5,
    hasLocalMedia: false,
  },
  {
    id: 'c007', type: 'music', title: 'Cygnus Transmission', creator: 'SolarPulse',
    creatorId: 'seed_u001',
    description: 'Radio signals from the Cygnus constellation, reinterpreted as melodic techno.',
    category: 'Techno', tags: ['techno','space','dark'],
    coverColor: 'linear-gradient(135deg,#100020,#2a0050,#08000f)',
    coverIcon: 'music', duration: 320, likes: 267, comments: 15, plays: 2100,
    createdAt: Date.now() - 86400000 * 6,
    hasLocalMedia: false,
  },
  {
    id: 'c008', type: 'art', title: 'Bioluminescent Bloom', creator: 'AuraSound',
    creatorId: 'seed_u005',
    description: 'Generative art piece inspired by deep-sea organisms and bioluminescence.',
    category: 'Generative', tags: ['generative','nature','glow'],
    coverColor: 'linear-gradient(135deg,#001510,#003525,#000a08)',
    coverIcon: 'art', likes: 389, comments: 20, plays: 1600,
    createdAt: Date.now() - 86400000 * 2.5,
    hasLocalMedia: false,
  },
  {
    id: 'c009', type: 'video', title: 'Midnight Protocol', creator: 'VaultFilms',
    creatorId: 'seed_u003',
    description: 'Short experimental film. No dialogue. Ambient score by NightCoreX.',
    category: 'Experimental', tags: ['experimental','shortfilm','noir'],
    coverColor: 'linear-gradient(135deg,#050505,#111111,#020202)',
    coverIcon: 'video', duration: 420, likes: 341, comments: 29, plays: 4100,
    createdAt: Date.now() - 86400000 * 7,
    hasLocalMedia: false,
  },
  {
    id: 'c010', type: 'music', title: 'Remnants of the Sun', creator: 'NightCoreX',
    creatorId: 'seed_u004',
    description: 'Lo-fi hip-hop instrumental with jazz chords, dusty drums, and warm vinyl crackle.',
    category: 'Lo-Fi', tags: ['lofi','hiphop','jazz'],
    coverColor: 'linear-gradient(135deg,#1a0800,#301500,#0d0400)',
    coverIcon: 'music', duration: 215, likes: 512, comments: 35, plays: 6800,
    createdAt: Date.now() - 86400000 * 3.5,
    hasLocalMedia: false,
  },
  {
    id: 'c011', type: 'art', title: 'Chromatic Storm', creator: 'PixelAlchemist',
    creatorId: 'seed_u002',
    description: 'An abstract study in colour theory — colliding hues, saturation, and energy.',
    category: 'Abstract', tags: ['abstract','color','digital'],
    coverColor: 'linear-gradient(135deg,#200010,#400030,#100005)',
    coverIcon: 'art', likes: 447, comments: 26, plays: 1900,
    createdAt: Date.now() - 86400000 * 0.8,
    hasLocalMedia: false,
  },
  {
    id: 'c012', type: 'audio', title: 'Signal Lost / Signal Found', creator: 'SolarPulse',
    creatorId: 'seed_u001',
    description: 'A field recording experiment combining radio interference with processed vocals.',
    category: 'Experimental', tags: ['experimental','fieldrecording','vocals'],
    coverColor: 'linear-gradient(135deg,#000f1a,#001a30,#000508)',
    coverIcon: 'audio', duration: 635, likes: 158, comments: 9, plays: 740,
    createdAt: Date.now() - 86400000 * 8,
    hasLocalMedia: false,
  },
];

const SEED_COLLECTIONS = [
  { id: 'col001', name: 'Space Music',   creatorId: 'seed_u001', creations: ['c001','c007','c012'], description: 'A journey through the cosmos in sound.' },
  { id: 'col002', name: 'Digital Art',   creatorId: 'seed_u002', creations: ['c002','c005','c008','c011'], description: 'Selected digital artworks.' },
  { id: 'col003', name: 'Short Films',   creatorId: 'seed_u003', creations: ['c003','c009'], description: 'Experimental and cinematic short films.' },
  { id: 'col004', name: 'Beat Library',  creatorId: 'seed_u004', creations: ['c004','c010'], description: 'Instrumentals and beat productions.' },
  { id: 'col005', name: 'Ambient Space', creatorId: 'seed_u001', creations: ['c001','c006','c012'], description: 'Calm, meditative, and expansive audio.' },
];

// ─── In-memory local media registry ──────────────────────────
// blob: URLs are never stored in Firestore. They live here keyed
// by creation ID for the current session only.
const LocalMedia = {
  _store: {},
  set(id, urls) { this._store[id] = urls; },
  get(id)       { return this._store[id] || {}; },
  clear(id)     { delete this._store[id]; },
};

// ─── App State (in-memory cache of Firestore data) ────────────

const State = {
  currentPage: 'stream',
  currentCreationId: null,
  currentProfileId: null,
  currentCollectionId: null,

  // Populated by Firestore listeners after init
  creations:   [],
  collections: [],

  // Current auth user (Firebase User object or null)
  currentUser: null,
  // Current user's Firestore profile doc
  myProfile: null,

  // Like set for current user: Set of creation IDs
  myLikes: new Set(),

  getCreation(id)  { return this.creations.find(c => c.id === id) || null; },
  isLiked(id)      { return this.myLikes.has(id); },
};

// ─── Firestore helpers ────────────────────────────────────────

/** Resolve a Firestore Timestamp, millis number, or JS Date to millis */
function tsToMs(val) {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (val.toMillis) return val.toMillis();      // Firestore Timestamp
  if (val instanceof Date) return val.getTime();
  return Date.now();
}

/** Strip undefined fields so Firestore doesn't reject them */
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ─── Seed Firestore (run once when creations collection is empty) ──

async function maybeSeedFirestore() {
  const snap = await getDocs(query(collection(db, 'creations'), limit(1)));
  if (!snap.empty) return; // already seeded

  const batch = writeBatch(db);

  // Seed creations
  for (const c of SEED_CREATIONS) {
    const ref = doc(db, 'creations', c.id);
    batch.set(ref, clean({
      type: c.type, title: c.title,
      creator: c.creator, creatorId: c.creatorId,
      description: c.description, category: c.category,
      tags: c.tags, coverColor: c.coverColor, coverIcon: c.coverIcon,
      duration: c.duration || null,
      likes: c.likes, comments: c.comments, plays: c.plays,
      createdAt: Timestamp.fromMillis(c.createdAt),
      hasLocalMedia: false,
    }));
  }

  // Seed collections
  for (const col of SEED_COLLECTIONS) {
    const ref = doc(db, 'collections', col.id);
    batch.set(ref, clean({
      name: col.name, description: col.description,
      creatorId: col.creatorId, creations: col.creations,
      createdAt: serverTimestamp(),
    }));
  }

  await batch.commit();
}

// ─── Auth Layer ───────────────────────────────────────────────

async function loadMyLikes(uid) {
  State.myLikes.clear();
  const snap = await getDocs(
    query(collection(db, 'likes'), where('uid', '==', uid))
  );
  snap.forEach(d => State.myLikes.add(d.data().creationId));
}

// Set to true while submitSignup owns the Firestore profile write.
// loadMyProfile skips its own repair attempt to avoid racing submitSignup.
let _signupInProgress = false;

async function loadMyProfile(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    State.myProfile = { id: uid, ...snap.data() };
    return;
  }

  // If submitSignup is handling the profile creation, don't race it.
  if (_signupInProgress) {
    // Leave State.myProfile null — submitSignup will set it after its write.
    console.info('loadMyProfile: signup in progress, skipping repair for uid =', uid);
    return;
  }

  // Existing Firebase Auth account with no Firestore profile yet — repair it.
  const displayName = State.currentUser?.displayName || 'Creator';
  const username    = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'creator';
  const profileData = {
    uid,
    username,
    usernameLower: username.toLowerCase(),
    displayName,
    bio: '',
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(ref, profileData);
    console.info('loadMyProfile: repaired missing profile for uid =', uid);
  } catch (e) {
    console.warn('loadMyProfile: could not repair profile (code:', e.code, '):', e.message);
  }
  State.myProfile = { id: uid, ...profileData, createdAt: Date.now() };
}

// Real-time listener for creations (unsubscribe handle)
let _unsubCreations = null;
let _unsubCollections = null;

function subscribeCreations() {
  if (_unsubCreations) _unsubCreations();
  const q = query(collection(db, 'creations'), orderBy('createdAt', 'desc'));
  _unsubCreations = onSnapshot(q, snap => {
    State.creations = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: tsToMs(d.data().createdAt),
    }));
    // Re-render current page if it displays creations
    const page = State.currentPage;
    if (['stream','explore','music','video','art','profile'].includes(page)) {
      renderPage(page);
    }
  }, err => console.error('creations listener:', err));
}

function subscribeCollections() {
  if (_unsubCollections) _unsubCollections();
  const q = query(collection(db, 'collections'), orderBy('createdAt', 'desc'));
  _unsubCollections = onSnapshot(q, snap => {
    State.collections = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: tsToMs(d.data().createdAt),
    }));
    if (State.currentPage === 'collections') renderPage('collections');
  }, err => console.error('collections listener:', err));
}

// ─── App boot state ───────────────────────────────────────────
// Tracks which phase the app is in:
//   'booting'       — Firebase Auth hasn't resolved yet (startup screen showing)
//   'guest'         — Auth resolved, no signed-in user
//   'authenticated' — Auth resolved, user confirmed + profile loaded
let _bootState = 'booting';

// ─── Startup Screen controller ────────────────────────────────
const Startup = {
  _el:       null,
  _statusEl: null,

  // The element is already in the DOM from HTML — grab it once DOM is ready.
  _init() {
    if (this._el) return;
    this._el       = document.getElementById('startup-screen');
    this._statusEl = document.getElementById('startup-status');
  },

  setStatus(msg) {
    this._init();
    if (this._statusEl) this._statusEl.textContent = msg;
  },

  /** Fade out and remove the startup screen. */
  dismiss() {
    this._init();
    if (!this._el || this._el.classList.contains('startup-hiding')) return;
    this._el.classList.add('startup-hiding');
    this._el.addEventListener('transitionend', () => {
      this._el.classList.add('startup-gone');
    }, { once: true });
    // Safety: ensure it's gone even if transitionend never fires.
    setTimeout(() => {
      if (this._el) this._el.classList.add('startup-gone');
    }, 600);
  },

  /** Show a non-blocking error message inside the startup screen. */
  showError(msg) {
    this._init();
    if (this._statusEl) {
      this._statusEl.textContent = msg;
      this._statusEl.style.color = 'var(--danger)';
    }
    // Hide the dots when showing an error
    const dots = this._el?.querySelector('.startup-dots');
    if (dots) dots.style.display = 'none';
  },
};

// ─── Auth state change ────────────────────────────────────────

// Resolves when onAuthStateChanged fires at least once.
// Used by DOMContentLoaded so the router waits for Firebase Auth.
let _authReadyResolve;
const authReady = new Promise(resolve => { _authReadyResolve = resolve; });
let _authResolved = false; // becomes true after the first onAuthStateChanged call

// True during a user-initiated login (submitLogin) so onAuthStateChanged
// knows to navigate to stream after the login completes.
let _loginInProgress = false;

onAuthStateChanged(auth, async user => {
  // ── Wrap entire callback so _authReadyResolve() ALWAYS fires ─────────────
  // If any awaited call throws (e.g. Firestore permission during profile load),
  // the catch ensures authReady still resolves and the app never hangs.
  try {
    State.currentUser = user;
    updateAuthNav();

    if (user) {
      await Promise.all([loadMyProfile(user.uid), loadMyLikes(user.uid)]);
      updateAuthNav(); // refresh now that myProfile is populated
      _bootState = 'authenticated';
    } else {
      State.myProfile = null;
      State.myLikes.clear();
      _bootState = 'guest';
    }
  } catch (err) {
    console.error('Shadow of Salem: onAuthStateChanged error:', err?.code, err?.message, err);
    // Treat as guest on error — do not leave _bootState stuck on 'booting'
    _bootState = 'guest';
  }

  // Signal authReady regardless of success/failure above
  const wasBooting = !_authResolved;
  if (!_authResolved) {
    _authResolved = true;
    _authReadyResolve();
  }

  // ── Ensure Firestore listeners are always running ─────────────────────────
  // subscribeCreations/subscribeCollections guard against duplicate listeners
  // internally, so it is always safe to call them here.
  // They must run on first boot AND after login/logout so the Stream always
  // reflects the current state without a page refresh.
  await maybeSeedFirestore().catch(e => console.warn('maybySeedFirestore skipped:', e?.code));
  subscribeCreations();
  subscribeCollections();

  // ── Post-auth navigation (non-boot only) ──────────────────────────────────
  if (!wasBooting) {
    if (_loginInProgress && user) {
      // User-triggered login completed → navigate to Shadow Stream immediately.
      _loginInProgress = false;
      navigate('stream');
      return;
    }
    _loginInProgress = false;

    if (!user) {
      // User-triggered sign-out completed → return to guest stream.
      navigate('stream');
      return;
    }
  }
});

// ─── Auth UI helpers ──────────────────────────────────────────

function updateAuthNav() {
  const user = State.currentUser;
  // Update both desktop and mobile profile nav buttons
  document.querySelectorAll('[data-auth-label]').forEach(el => {
    el.textContent = user
      ? (State.myProfile?.displayName || user.displayName || user.email || 'Profile')
      : 'Sign In';
  });
  document.querySelectorAll('[data-auth-avatar]').forEach(el => {
    el.src = avatarUrl(
      user ? (State.myProfile?.displayName || user.displayName || user.email || 'U') : 'U'
    );
    el.style.display = user ? 'block' : 'none';
  });
}

// ─── Auth modals ──────────────────────────────────────────────

window.openAuthModal = function(tab = 'login') {
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title" id="auth-modal-title">${tab === 'signup' ? 'Create Account' : 'Sign In'}</div>
      <button type="button" class="modal-close" onclick="Modal.close()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:8px;margin-bottom:var(--space-md)">
        <button id="tab-login"  class="btn btn-sm ${tab==='login'  ?'btn-primary':'btn-ghost'}" onclick="switchAuthTab('login')" >Sign In</button>
        <button id="tab-signup" class="btn btn-sm ${tab==='signup' ?'btn-primary':'btn-ghost'}" onclick="switchAuthTab('signup')">Create Account</button>
      </div>

      <div id="auth-login-form"  style="display:${tab==='login' ?'block':'none'}">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="auth-login-email" type="email" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="auth-login-pw" type="password" placeholder="Password" autocomplete="current-password"
                 onkeydown="if(event.key==='Enter')submitLogin()">
        </div>
        <div style="text-align:right;margin-bottom:var(--space-md)">
          <button class="btn btn-ghost btn-sm" onclick="openResetModal()">Forgot password?</button>
        </div>
        <div id="auth-login-error" style="color:var(--danger);font-size:0.82rem;margin-bottom:8px;display:none"></div>
      </div>

      <div id="auth-signup-form" style="display:${tab==='signup'?'block':'none'}">
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input class="form-input" id="auth-signup-name" type="text" placeholder="Your name" maxlength="50" autocomplete="name">
        </div>
        <div class="form-group">
          <label class="form-label">Username</label>
          <input class="form-input" id="auth-signup-username" type="text" placeholder="username (no spaces)" maxlength="30" autocomplete="username">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" id="auth-signup-email" type="email" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input class="form-input" id="auth-signup-pw" type="password" placeholder="At least 6 characters" autocomplete="new-password"
                 onkeydown="if(event.key==='Enter')submitSignup()">
        </div>
        <div id="auth-signup-error" style="color:var(--danger);font-size:0.82rem;margin-bottom:8px;display:none"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" id="auth-submit-btn" class="btn btn-create"
              onclick="${tab==='login'?'submitLogin()':'submitSignup()'}">
        ${tab==='login'?'Sign In':'Create Account'}
      </button>
    </div>
  `);
};

window.switchAuthTab = function(tab) {
  document.getElementById('auth-login-form').style.display  = tab === 'login'  ? 'block' : 'none';
  document.getElementById('auth-signup-form').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('auth-modal-title').textContent   = tab === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('tab-login').className  = `btn btn-sm ${tab==='login'  ?'btn-primary':'btn-ghost'}`;
  document.getElementById('tab-signup').className = `btn btn-sm ${tab==='signup' ?'btn-primary':'btn-ghost'}`;
  const btn = document.getElementById('auth-submit-btn');
  btn.textContent = tab === 'signup' ? 'Create Account' : 'Sign In';
  btn.setAttribute('onclick', tab === 'signup' ? 'submitSignup()' : 'submitLogin()');
};

window.submitLogin = async function() {
  const email = document.getElementById('auth-login-email')?.value?.trim();
  const pw    = document.getElementById('auth-login-pw')?.value;
  const errEl = document.getElementById('auth-login-error');
  errEl.style.display = 'none';
  if (!email || !pw) { errEl.textContent = 'Enter your email and password.'; errEl.style.display = 'block'; return; }

  // Disable the submit button while the request is in flight.
  const btn = document.getElementById('auth-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    // Signal the onAuthStateChanged listener to navigate to stream
    // once Firebase confirms the login — so there is NO manual refresh needed.
    _loginInProgress = true;
    await signInWithEmailAndPassword(auth, email, pw);
    // onAuthStateChanged fires next — it closes the modal, loads profile,
    // navigates to stream, and updates the nav. Nothing more needed here.
    Modal.close();
    Toast.success('Welcome back!');
  } catch (e) {
    _loginInProgress = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
};

window.submitSignup = async function() {
  const name     = document.getElementById('auth-signup-name')?.value?.trim();
  const rawUser  = document.getElementById('auth-signup-username')?.value?.trim();
  const username = rawUser?.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  const email    = document.getElementById('auth-signup-email')?.value?.trim();
  const pw       = document.getElementById('auth-signup-pw')?.value;
  const errEl    = document.getElementById('auth-signup-error');
  if (!errEl) { console.error('submitSignup: auth-signup-error element not found'); return; }

  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!name)     { showErr('Display name is required.'); return; }
  if (!username) { showErr('Username is required.'); return; }
  if (!email)    { showErr('Email is required.'); return; }
  if (!pw)       { showErr('Password is required.'); return; }

  // ── Stage A: check username availability ─────────────────────
  // Query before creating the Auth account so we don't leave an
  // orphaned Auth user if the username is already taken.
  try {
    const uSnap = await getDocs(
      query(collection(db, 'users'), where('usernameLower', '==', username.toLowerCase()), limit(1))
    );
    if (!uSnap.empty) {
      showErr(`The username "@${username}" is already taken.`);
      return;
    }
  } catch (e) {
    // Username check failing (e.g. Firestore not provisioned, no index) should
    // not block signup — log the real error and continue.
    console.warn('submitSignup: username uniqueness check failed:', e.code, e.message, e);
  }

  // ── Stage B: create Firebase Auth account ────────────────────
  // Set flag BEFORE calling createUserWithEmailAndPassword so that
  // onAuthStateChanged (which fires immediately on success) knows
  // submitSignup owns the Firestore profile write and must not race it.
  _signupInProgress = true;
  let uid;
  let authUser;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    authUser = cred.user;
    uid      = cred.user.uid;
    console.info('submitSignup: Auth account created, uid =', uid);
  } catch (e) {
    _signupInProgress = false;
    // Log the real Firebase error — never log the password.
    console.error('submitSignup Auth error:', e.code, e.message, e.name, e);
    showErr(friendlyAuthError(e.code, e));
    return; // Stop here — do NOT attempt Firestore.
  }

  // ── Stage C: set display name on Auth profile ─────────────────
  try {
    await updateProfile(authUser, { displayName: name });
  } catch (e) {
    // Non-fatal — display name update failed but account exists.
    console.warn('submitSignup: updateProfile failed (non-fatal):', e.code, e.message);
  }

  // ── Stage D: create Firestore profile ────────────────────────
  // Auth succeeded. If Firestore fails, the account still exists — we must
  // NOT re-run createUserWithEmailAndPassword (would get email-already-in-use).
  // We retry up to 3 times with a brief delay because the Firestore auth token
  // can take a moment to propagate after a brand-new account is created.
  const profileData = clean({
    uid,
    username,
    usernameLower: username.toLowerCase(),
    displayName:  name,
    bio:          '',
    email,
    createdAt:    serverTimestamp(),
  });

  let fsError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await setDoc(doc(db, 'users', uid), profileData);
      fsError = null;
      console.info(`submitSignup: Firestore profile written for uid = ${uid} (attempt ${attempt})`);
      break;
    } catch (e) {
      fsError = e;
      console.warn(`submitSignup: Firestore write attempt ${attempt} failed:`, e.code, e.message);
      if (attempt < 3) {
        // Brief pause before retry — gives the auth token time to propagate.
        await new Promise(r => setTimeout(r, 600 * attempt));
      }
    }
  }

  _signupInProgress = false;

  if (fsError) {
    // Log the actual Firestore error — this is separate from Auth.
    console.error('submitSignup Firestore error (Auth succeeded, uid =', uid, '):', fsError.code, fsError.message, fsError);
    // Auth succeeded — let the user in even if profile write ultimately failed.
    // loadMyProfile will attempt repair on the next sign-in cycle.
    const fsErrMsg = fsError.code === 'permission-denied'
      ? 'Account created! Profile setup hit a permissions issue — it will repair on next sign-in.'
      : `Account created! Profile setup failed (${fsError.code || 'unknown error'}) — sign in to continue.`;
    State.myProfile = { id: uid, uid, username, displayName: name, bio: '' };
    Modal.close();
    Toast.info(fsErrMsg);
    navigate('stream');
    return;
  }

  // ── Stage E: success ─────────────────────────────────────────
  State.myProfile = { id: uid, uid, username, displayName: name, bio: '' };
  Modal.close();
  Toast.success(`Welcome to Shadow of Salem, ${name}!`);
  navigate('stream');
};

window.openResetModal = function() {
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title">Reset Password</div>
      <button type="button" class="modal-close" onclick="Modal.close()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text-secondary);font-size:0.88rem;margin-bottom:var(--space-md)">
        Enter your email address and we'll send you a password reset link.
      </p>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" id="reset-email" type="email" placeholder="your@email.com"
               onkeydown="if(event.key==='Enter')submitReset()">
      </div>
      <div id="reset-error" style="color:var(--danger);font-size:0.82rem;display:none"></div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" class="btn btn-create" onclick="submitReset()">Send Reset Link</button>
    </div>
  `);
};

window.submitReset = async function() {
  const email = document.getElementById('reset-email')?.value?.trim();
  const errEl = document.getElementById('reset-error');
  errEl.style.display = 'none';
  if (!email) { errEl.textContent = 'Enter your email.'; errEl.style.display = 'block'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    Modal.close();
    Toast.success('Password reset email sent!');
  } catch (e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.style.display = 'block';
  }
};

window.handleSignOut = async function() {
  await signOut(auth);
  // onAuthStateChanged fires immediately after signOut resolves and handles
  // clearing state + navigating to stream. Toast here as confirmation.
  Toast.info('Signed out.');
  // Navigation is handled by onAuthStateChanged — do not call navigate() here.
};

function friendlyAuthError(code, raw) {
  const map = {
    'auth/user-not-found':           'No account found with that email.',
    'auth/wrong-password':           'Incorrect password.',
    'auth/invalid-email':            'Please enter a valid email address.',
    'auth/email-already-in-use':     'An account already exists with this email.',
    'auth/weak-password':            raw?.message?.replace('Firebase: ', '') || 'Password is too weak.',
    'auth/too-many-requests':        'Too many attempts. Try again later.',
    'auth/invalid-credential':       'Invalid email or password.',
    'auth/network-request-failed':   'Unable to connect to Firebase. Check your connection.',
    'auth/operation-not-allowed':    'Email/password signup is not enabled. Contact the site admin.',
    'auth/user-disabled':            'This account has been disabled.',
    'auth/missing-password':         'Please enter a password.',
  };
  return map[code] || `Something went wrong (${code || 'unknown'}). See console for details.`;
}

// ─── Firestore data actions ───────────────────────────────────

async function fsToggleLike(creationId) {
  if (!State.currentUser) { openAuthModal('login'); return; }
  const uid = State.currentUser.uid;
  const likeId = `${uid}_${creationId}`;
  const likeRef = doc(db, 'likes', likeId);
  const creationRef = doc(db, 'creations', creationId);

  if (State.myLikes.has(creationId)) {
    // Unlike
    State.myLikes.delete(creationId);
    const c = State.getCreation(creationId);
    if (c) c.likes = Math.max(0, (c.likes || 0) - 1);
    await deleteDoc(likeRef);
    await updateDoc(creationRef, { likes: increment(-1) });
  } else {
    // Like
    State.myLikes.add(creationId);
    const c = State.getCreation(creationId);
    if (c) c.likes = (c.likes || 0) + 1;
    await setDoc(likeRef, { uid, creationId, createdAt: serverTimestamp() });
    await updateDoc(creationRef, { likes: increment(1) });
  }
}

async function fsAddComment(creationId, text) {
  if (!State.currentUser) { openAuthModal('login'); return null; }
  const uid = State.currentUser.uid;
  const author = State.myProfile?.displayName || State.currentUser.displayName || 'Creator';
  const ref = collection(db, 'creations', creationId, 'comments');
  const docRef = await addDoc(ref, clean({
    uid, author, text, createdAt: serverTimestamp(),
  }));
  // Increment comment count
  await updateDoc(doc(db, 'creations', creationId), { comments: increment(1) });
  return { id: docRef.id, uid, author, text, time: Date.now() };
}

async function fsGetComments(creationId) {
  const q = query(
    collection(db, 'creations', creationId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    time: tsToMs(d.data().createdAt),
  }));
}

async function fsAddCreation(creationData) {
  if (!State.currentUser) { openAuthModal('login'); return null; }
  const uid  = State.currentUser.uid;
  const name = State.myProfile?.displayName || State.currentUser.displayName || 'Creator';

  // Never store blob: URLs — only metadata
  const safeData = clean({
    type:        creationData.type,
    title:       creationData.title,
    creator:     name,
    creatorId:   uid,
    description: creationData.description || '',
    category:    creationData.category || '',
    tags:        creationData.tags || [],
    coverColor:  creationData.coverColor || 'linear-gradient(135deg,#0a000f,#1a002a,#050010)',
    coverIcon:   creationData.type,
    duration:    creationData.duration || null,
    likes: 0, comments: 0, plays: 0,
    hasLocalMedia: creationData.hasLocalMedia || false,
    createdAt: serverTimestamp(),
  });

  const docRef = await addDoc(collection(db, 'creations'), safeData);

  // Store local media blob URL in memory only (not Firestore)
  if (creationData.audioURL || creationData.videoURL || creationData.coverURL) {
    LocalMedia.set(docRef.id, {
      audioURL: creationData.audioURL || null,
      videoURL: creationData.videoURL || null,
      coverURL: creationData.coverURL || null,
    });
  }

  return docRef.id;
}

async function fsAddCollection(colData) {
  if (!State.currentUser) { openAuthModal('login'); return null; }
  const uid = State.currentUser.uid;
  const ref = await addDoc(collection(db, 'collections'), clean({
    name:        colData.name,
    description: colData.description || '',
    creatorId:   uid,
    creations:   [],
    createdAt:   serverTimestamp(),
  }));
  return ref.id;
}

async function fsIncrementPlays(creationId) {
  try {
    await updateDoc(doc(db, 'creations', creationId), { plays: increment(1) });
  } catch (_) { /* non-critical */ }
}

async function fsUpdateCreation(creationId, fields) {
  if (!State.currentUser) return;
  const c = State.getCreation(creationId);
  if (!c || c.creatorId !== State.currentUser.uid) {
    Toast.error('You can only edit your own creations.'); return;
  }
  await updateDoc(doc(db, 'creations', creationId), clean(fields));
}

async function fsDeleteCreation(creationId) {
  if (!State.currentUser) return;
  const c = State.getCreation(creationId);
  if (!c || c.creatorId !== State.currentUser.uid) {
    Toast.error('You can only delete your own creations.'); return;
  }
  await deleteDoc(doc(db, 'creations', creationId));
  LocalMedia.clear(creationId);
}

// ─── Router ───────────────────────────────────────────────────

// Build the canonical hash string for a page + params.
// This is the single source of truth for URL format.
function pageToHash(page, params = {}) {
  switch (page) {
    case 'viewer':     return params.id          ? `#/viewer/${params.id}`           : '#/stream';
    case 'profile':    return params.profileId   ? `#/profile/${params.profileId}`   : '#/profile/my';
    case 'collection': return params.collectionId? `#/collection/${params.collectionId}` : '#/collections';
    case 'search':     return params.q           ? `#/search/${encodeURIComponent(params.q)}` : '#/search';
    default:           return `#/${page}`;
  }
}

// Parse a raw location.hash into { page, params }.
function hashToRoute(hash) {
  const parts = hash.replace(/^#\//, '').split('/');
  const page  = parts[0] || 'stream';
  const seg1  = parts[1] ? decodeURIComponent(parts[1]) : null;

  switch (page) {
    case 'viewer':     return { page: 'viewer',     params: seg1 ? { id: seg1 }           : {} };
    case 'profile':    return { page: 'profile',    params: seg1 ? { profileId: seg1 }    : { profileId: 'my' } };
    case 'collection': return { page: 'collection', params: seg1 ? { collectionId: seg1 } : {} };
    case 'search':     return { page: 'search',     params: seg1 ? { q: seg1 }             : {} };
    case 'stream': case 'explore': case 'music': case 'video':
    case 'art': case 'collections': case 'create':
      return { page, params: {} };
    default:           return { page: 'stream',     params: {} };
  }
}

// Flag that prevents the hashchange listener from triggering a second navigate()
// when navigate() itself updates the hash.
let _navigating = false;

function navigate(page, params = {}) {
  // The nav sidebar Profile button calls navigate('profile') with no params.
  // That ALWAYS means own profile — never reuse a stale creator ID.
  if (page === 'profile' && !params.profileId) {
    params = { profileId: 'my' };
  }

  // Store only the IDs that are explicitly supplied for this navigation.
  // Never fall back to a previously stored ID — that is the stale-ID bug.
  State.currentPage = page;
  State.currentCreationId   = params.id           ?? null;
  State.currentProfileId    = params.profileId    ?? null;
  State.currentCollectionId = params.collectionId ?? null;

  // Update the browser URL hash (produces canonical shareable URLs).
  const newHash = pageToHash(page, params);
  _navigating = true;
  window.location.hash = newHash;
  // _navigating is reset by the hashchange listener (or synchronously if no
  // hashchange fires because the hash didn't change).
  // Use setTimeout(0) as a safety reset.
  setTimeout(() => { _navigating = false; }, 0);

  document.querySelectorAll('.nav-link[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.nav-link[data-mobile-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.mobilePage === page);
  });

  renderPage(page, params);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPage(page, params = {}) {
  const container = document.getElementById('page-container');
  container.innerHTML = '';

  // Each case receives only the params for THIS render — no stale fallbacks.
  switch (page) {
    case 'stream':      Pages.stream(container); break;
    case 'explore':     Pages.explore(container); break;
    case 'music':       Pages.gallery(container, 'music'); break;
    case 'video':       Pages.gallery(container, 'video'); break;
    case 'art':         Pages.gallery(container, 'art'); break;
    case 'collections': Pages.collections(container); break;
    case 'collection':  Pages.collectionDetail(container, params.collectionId ?? null); break;
    case 'create':      Pages.create(container); break;
    case 'search':      Pages.search(container, params.q || ''); break;
    case 'profile':     Pages.profile(container, params.profileId ?? 'my'); break;
    case 'viewer':      Pages.viewer(container, params.id ?? null); break;
    default:            Pages.stream(container);
  }
}

// ─── Omega Player ─────────────────────────────────────────────

const OmegaPlayer = (() => {
  let currentTrack = null;
  let queue        = [];
  let queueIndex   = 0;
  const audio    = document.getElementById('omega-audio');
  const playerEl = document.getElementById('omega-player');

  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function updateUI() {
    if (!currentTrack) return;
    const art         = document.getElementById('player-art');
    const placeholder = document.getElementById('player-art-placeholder');
    const media       = LocalMedia.get(currentTrack.id);
    if (media.coverURL) {
      art.src = media.coverURL;
      art.style.display = 'block';
      placeholder.style.display = 'none';
    } else if (currentTrack.coverColor) {
      art.style.display = 'none';
      placeholder.style.display = 'flex';
      placeholder.parentElement.style.background = currentTrack.coverColor;
    } else {
      art.style.display = 'none';
      placeholder.style.display = 'flex';
    }
    document.getElementById('player-title').textContent   = currentTrack.title;
    document.getElementById('player-creator').textContent = currentTrack.creator;
  }

  function setPlaying(playing) {
    document.getElementById('player-play-icon').classList.toggle('hidden',  playing);
    document.getElementById('player-pause-icon').classList.toggle('hidden', !playing);
  }

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById('player-progress-fill').style.width     = pct + '%';
    document.getElementById('player-current-time').textContent       = fmt(audio.currentTime);
    document.getElementById('player-duration').textContent           = fmt(audio.duration);
    const vFill = document.getElementById('viewer-progress-fill');
    if (vFill) vFill.style.width = pct + '%';
    const vCt  = document.getElementById('viewer-current-time');
    if (vCt) vCt.textContent = fmt(audio.currentTime);
    const vDur = document.getElementById('viewer-duration');
    if (vDur) vDur.textContent = fmt(audio.duration);
  });

  audio.addEventListener('play',  () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => { setPlaying(false); next(); });

  function next() {
    if (!queue.length) return;
    queueIndex = (queueIndex + 1) % queue.length;
    load(queue[queueIndex], queue, queueIndex);
  }

  function load(track, newQueue = [], idx = 0) {
    currentTrack = track;
    queue        = newQueue;
    queueIndex   = idx;
    const media  = LocalMedia.get(track.id);
    audio.src    = media.audioURL || '';
    playerEl.classList.remove('hidden');
    updateUI();
    if (media.audioURL) audio.play().catch(() => {});
  }

  return {
    get currentTrack() { return currentTrack; },
    load,

    togglePlay() {
      if (!currentTrack) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },

    seek(e) {
      if (!audio.duration) return;
      const bar  = document.getElementById('player-progress-bar');
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audio.duration;
    },

    seekRatio(ratio) {
      if (!audio.duration) return;
      audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    },

    setVolume(v) {
      audio.volume = Math.max(0, Math.min(1, parseFloat(v)));
      document.getElementById('player-volume').value = v;
    },

    next,

    prev() {
      if (!queue.length) return;
      if (audio.currentTime > 3) { audio.currentTime = 0; return; }
      queueIndex = (queueIndex - 1 + queue.length) % queue.length;
      load(queue[queueIndex], queue, queueIndex);
    },

    close() {
      audio.pause();
      audio.src    = '';
      currentTrack = null;
      playerEl.classList.add('hidden');
    },

    isPlaying()        { return !audio.paused; },
    isCurrentTrack(id) { return currentTrack?.id === id; },
  };
})();

// ─── Toast ────────────────────────────────────────────────────

const Toast = {
  show(msg, type = '') {
    const el = document.createElement('div');
    el.className   = `toast ${type ? 'toast-' + type : ''}`;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.style.opacity    = '0';
      el.style.transition = 'opacity 0.3s';
      setTimeout(() => el.remove(), 300);
    }, 2800);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  info(msg)    { this.show(msg); },
};

// ─── Modal ────────────────────────────────────────────────────

const Modal = {
  _open: false,

  open(html) {
    const overlay   = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    container.innerHTML = html;
    overlay.classList.remove('hidden');
    container.classList.remove('hidden');

    // Push a history entry so Android/browser Back closes the modal
    // instead of navigating away from the page.
    if (!this._open) {
      history.pushState({ modal: true }, '');
      this._open = true;
    }
  },

  close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-container').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';

    // If we pushed a history entry for this modal, remove it.
    if (this._open) {
      this._open = false;
      // Only go back if the current state is our modal sentinel —
      // this avoids double-popping when the browser already fired popstate.
      if (history.state && history.state.modal) {
        history.back();
      }
    }
  },
};

// ─── Hash-based routing (Back / Forward / direct links) ──────
//
// hashchange fires when the browser URL changes via Back, Forward,
// or an external link. navigate() sets _navigating=true before
// updating location.hash so we skip the re-render that would
// create an infinite loop.
window.addEventListener('hashchange', async () => {
  if (_navigating) {
    // navigate() triggered this change — skip the redundant re-render.
    _navigating = false;
    return;
  }
  // Triggered by Back/Forward/external link — route from the new hash.
  // Auth must be resolved before we attempt to render profile pages.
  await authReady;
  const { page, params } = hashToRoute(window.location.hash);
  // Update nav highlights and render without pushing another hash entry.
  State.currentPage         = page;
  State.currentCreationId   = params.id           ?? null;
  State.currentProfileId    = params.profileId    ?? null;
  State.currentCollectionId = params.collectionId ?? null;

  document.querySelectorAll('.nav-link[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.querySelectorAll('.nav-link[data-mobile-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.mobilePage === page);
  });

  renderPage(page, params);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Close modal on browser/Android Back
window.addEventListener('popstate', (e) => {
  if (Modal._open) {
    // The browser already popped the modal history entry.
    // Just close the UI without calling history.back() again.
    Modal._open = false;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-container').classList.add('hidden');
    document.getElementById('modal-container').innerHTML = '';
  }
});

// ─── Mobile nav ───────────────────────────────────────────────

window.toggleMobileNav = function() {
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  drawer.classList.toggle('open');
  overlay.classList.toggle('hidden');
};

window.closeMobileNav = function() {
  document.getElementById('mobile-nav-drawer').classList.remove('open');
  document.getElementById('mobile-nav-overlay').classList.add('hidden');
};

// ─── Helpers ──────────────────────────────────────────────────

function fmtCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n || 0);
}
function fmtDuration(s) {
  if (!s || isNaN(s)) return '';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function typeColor(type) {
  return { music: 'blue', art: 'purple', video: 'gold', audio: 'green', text: 'blue' }[type] || 'blue';
}
function typeIcon(type) {
  const icons = {
    music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    art:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>`,
    video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>`,
    text:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  };
  return icons[type] || icons.music;
}
function avatarUrl(name) {
  const colors = ['1a1a2e,00c8ff', '0d0d1a,a855f7', '000a15,39ff14', '100010,f0b429'];
  const idx    = (name || '').charCodeAt(0) % colors.length;
  const [bg, fg] = colors[idx].split(',');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'U')}&background=${bg}&color=${fg}&bold=true`;
}

// ─── Creation Card HTML ───────────────────────────────────────

function buildCreationCard(c, opts = {}) {
  const liked     = State.isLiked(c.id);
  const isAudio   = c.type === 'music' || c.type === 'audio';
  const isPlaying = OmegaPlayer.isCurrentTrack(c.id) && OmegaPlayer.isPlaying();
  const mediaBg   = c.coverColor
    ? `style="background:${c.coverColor}"`
    : `style="background:var(--omega-surface)"`;
  const cardClass = opts.square ? 'card-media card-media--square' : 'card-media';

  return `
    <div class="creation-card" onclick="navigate('viewer',{id:'${esc(c.id)}',type:'${esc(c.type)}'})">
      <div class="${cardClass}" ${mediaBg}>
        <div class="card-media-placeholder">
          <div style="width:48px;height:48px;color:var(--electric);opacity:0.5">${typeIcon(c.type)}</div>
        </div>
        <div class="card-play-overlay">
          ${isAudio ? `
            <button class="card-play-btn ${isPlaying ? 'card-playing-btn' : ''}"
                    onclick="event.stopPropagation();playCreation('${esc(c.id)}')"
                    aria-label="${isPlaying ? 'Pause' : 'Play'}">
              ${isPlaying
                ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
            </button>` : `
            <div class="card-play-btn" style="background:rgba(255,255,255,0.15)">
              ${typeIcon(c.type)}
            </div>`}
        </div>
        <span class="badge badge-${typeColor(c.type)} card-badge-tl">${esc(c.type.toUpperCase())}</span>
        ${c.duration ? `<span class="card-duration">${fmtDuration(c.duration)}</span>` : ''}
        ${isPlaying ? `<div style="position:absolute;bottom:10px;left:10px"><div class="eq-bars">${[6,10,8,14,8].map(h=>`<div class="eq-bar" style="height:${h}px"></div>`).join('')}</div></div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-creator-row">
          <img src="${avatarUrl(c.creator)}" class="avatar avatar-sm" alt="${esc(c.creator)}"
               onclick="event.stopPropagation();navigate('profile',{profileId:'${esc(c.creatorId)}'})" style="cursor:pointer">
          <span class="card-creator-name"
                onclick="event.stopPropagation();navigate('profile',{profileId:'${esc(c.creatorId)}'})">
            ${esc(c.creator)}
          </span>
          <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="card-title" onclick="navigate('viewer',{id:'${esc(c.id)}'})">
          ${esc(c.title)}
        </div>
        ${c.description ? `<div class="card-desc">${esc(c.description)}</div>` : ''}
        ${c.tags?.length ? `<div class="card-tags">${c.tags.slice(0,4).map(t=>`<span class="card-tag">#${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="card-actions">
          <button class="action-btn ${liked ? 'liked' : ''}" onclick="event.stopPropagation();handleLike('${esc(c.id)}')" aria-label="Like">
            <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span id="likes-${esc(c.id)}">${fmtCount(c.likes)}</span>
          </button>
          <button class="action-btn" onclick="event.stopPropagation();navigate('viewer',{id:'${esc(c.id)}'})" aria-label="Comments">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span>${c.comments || 0}</span>
          </button>
          <button class="action-btn" onclick="event.stopPropagation();handleShare('${esc(c.id)}')" aria-label="Share">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          ${isAudio ? `
          <button class="action-btn" style="margin-left:auto" onclick="event.stopPropagation();playCreation('${esc(c.id)}')" aria-label="Play">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>${fmtCount(c.plays)}</span>
          </button>` : ''}
        </div>
      </div>
    </div>`;
}

// ─── Action handlers ──────────────────────────────────────────

window.handleLike = async function(id) {
  await fsToggleLike(id);
  const c = State.getCreation(id);
  document.querySelectorAll(`#likes-${id}`).forEach(el => {
    el.textContent = fmtCount(c?.likes || 0);
  });
  document.querySelectorAll(`.action-btn[onclick*="handleLike('${id}')"]`).forEach(btn => {
    const liked = State.isLiked(id);
    btn.classList.toggle('liked', liked);
    btn.querySelector('svg')?.setAttribute('fill', liked ? 'currentColor' : 'none');
  });
};

window.handleShare = function(id) {
  const c    = State.getCreation(id);
  const text = `Check out "${c?.title}" on Shadow of Salem`;
  if (navigator.share) {
    navigator.share({ title: c?.title, text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text)
      .then(() => Toast.success('Copied to clipboard!'))
      .catch(() => Toast.info('Share: ' + text));
  }
};

window.playCreation = function(id) {
  const c = State.getCreation(id);
  if (!c) return;
  if (OmegaPlayer.isCurrentTrack(id)) { OmegaPlayer.togglePlay(); return; }
  const audioCreations = State.creations.filter(x => x.type === 'music' || x.type === 'audio');
  const queueTracks    = audioCreations.map(x => ({
    id: x.id, title: x.title, creator: x.creator,
    coverColor: x.coverColor,
  }));
  const idx = queueTracks.findIndex(t => t.id === id);
  OmegaPlayer.load(queueTracks[idx >= 0 ? idx : 0], queueTracks, idx >= 0 ? idx : 0);
  fsIncrementPlays(id);
  const local = State.getCreation(id);
  if (local) local.plays = (local.plays || 0) + 1;
};

// ─── Pages ────────────────────────────────────────────────────

const Pages = {

  // ── STREAM ───────────────────────────────────────────────────
  stream(container) {
    container.innerHTML = `
      <div class="hero-banner">
        <div class="page-title glow-gradient">SHADOW STREAM</div>
        <div class="page-subtitle">Digital creations from across the universe</div>
      </div>
      <div class="filter-tabs" id="stream-filters">
        <button class="filter-tab active" onclick="streamFilter('all',this)">All</button>
        <button class="filter-tab" onclick="streamFilter('music',this)">Music</button>
        <button class="filter-tab" onclick="streamFilter('art',this)">Art</button>
        <button class="filter-tab" onclick="streamFilter('video',this)">Video</button>
        <button class="filter-tab" onclick="streamFilter('audio',this)">Audio</button>
      </div>
      <div id="stream-grid" class="grid-3"></div>`;
    renderStream('all');
  },

  // ── EXPLORE ──────────────────────────────────────────────────
  explore(container) {
    container.innerHTML = `
      <div class="hero-banner">
        <div class="page-title"><span class="glow-blue">SHADOW</span> <span class="glow-purple">GALLERY</span></div>
        <div class="page-subtitle">Browse all digital creations</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:var(--space-lg)">
        <div class="search-bar" style="flex:1;min-width:200px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="explore-search" type="search" placeholder="Search creations..." oninput="exploreSearch(this.value)" aria-label="Search creations">
        </div>
      </div>
      <div class="filter-tabs" id="explore-filters">
        <button class="filter-tab active" onclick="exploreFilter('all',this)">All</button>
        <button class="filter-tab" onclick="exploreFilter('art',this)">Art</button>
        <button class="filter-tab" onclick="exploreFilter('music',this)">Music</button>
        <button class="filter-tab" onclick="exploreFilter('video',this)">Video</button>
        <button class="filter-tab" onclick="exploreFilter('audio',this)">Audio</button>
        <button class="filter-tab" onclick="exploreFilter('new',this)">New</button>
      </div>
      <div id="explore-grid" class="grid-3"></div>`;
    renderExplore('all', '');
  },

  // ── GALLERY ──────────────────────────────────────────────────
  gallery(container, type) {
    const titles    = { music: 'MUSIC', video: 'VIDEO', art: 'ART' };
    const subtitles = {
      music: 'Tracks, beats, instrumentals, mixes and audio',
      video: 'Short films, reels and visual works',
      art:   'Digital paintings, photography and illustrations',
    };
    const colors = { music: 'glow-blue', video: 'glow-gold', art: 'glow-purple' };
    container.innerHTML = `
      <div class="hero-banner">
        <div class="page-title ${colors[type] || 'glow-blue'}">${titles[type]}</div>
        <div class="page-subtitle">${subtitles[type] || ''}</div>
      </div>
      <div id="type-gallery-grid" class="grid-3"></div>`;
    const items = State.creations.filter(c => c.type === type);
    const grid  = document.getElementById('type-gallery-grid');
    grid.innerHTML = items.length
      ? items.map(c => buildCreationCard(c)).join('')
      : `<div class="empty-state" style="grid-column:1/-1">
           <div class="empty-state-icon">${typeIcon(type)}</div>
           <h3>No ${type} creations yet</h3>
           <p>Be the first to upload ${type} to Shadow of Salem.</p>
           <button class="btn btn-create mt-md" onclick="navigate('create')">+ New Creation</button>
         </div>`;
  },

  // ── COLLECTIONS ──────────────────────────────────────────────
  collections(container) {
    const cols = State.collections;
    container.innerHTML = `
      <div class="hero-banner">
        <div class="page-title glow-purple">COLLECTIONS</div>
        <div class="page-subtitle">Curated groups of digital creations</div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:var(--space-lg)">
        <div class="section-title">All Collections</div>
        <button class="btn btn-create btn-sm" onclick="openCreateCollectionModal()">+ New Collection</button>
      </div>
      <div class="grid-3" id="collections-grid">
        ${cols.map(col => buildCollectionCard(col)).join('')}
        ${!cols.length ? `<div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>
          <h3>No collections yet</h3>
          <p>Create your first collection to organise your creations.</p>
        </div>` : ''}
      </div>`;
  },

  // ── COLLECTION DETAIL ────────────────────────────────────────
  collectionDetail(container, colId) {
    const col = State.collections.find(c => c.id === colId);
    if (!col) {
      container.innerHTML = `<div class="empty-state"><h3>Collection not found</h3><button class="btn btn-ghost mt-md" onclick="navigate('collections')">← Collections</button></div>`;
      return;
    }
    const items = (col.creations || []).map(id => State.getCreation(id)).filter(Boolean);
    container.innerHTML = `
      <div style="padding-top:var(--space-lg)">
        <button class="btn btn-ghost btn-sm mb-md" onclick="navigate('collections')">← Collections</button>
        <div class="page-title glow-purple mb-md">${esc(col.name)}</div>
        ${col.description ? `<p style="color:var(--text-secondary);margin-bottom:var(--space-lg);font-size:0.9rem">${esc(col.description)}</p>` : ''}
        <div class="section-header">
          <span class="section-title">${items.length} Creation${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="grid-3">
          ${items.length ? items.map(c => buildCreationCard(c)).join('') : `<div class="empty-state" style="grid-column:1/-1"><h3>No creations in this collection</h3></div>`}
        </div>
      </div>`;
  },

  // ── CREATE ───────────────────────────────────────────────────
  create(container) {
    if (!State.currentUser) {
      container.innerHTML = `
        <div class="hero-banner">
          <div class="page-title glow-green">CREATOR SPACE</div>
          <div class="page-subtitle">Sign in to publish your digital creations</div>
        </div>
        <div class="empty-state">
          <div class="empty-state-icon">${typeIcon('music')}</div>
          <h3>Sign in to create</h3>
          <p>You need an account to publish creations to Shadow of Salem.</p>
          <button class="btn btn-create mt-md" onclick="openAuthModal('signup')">Create Account</button>
          <button class="btn btn-ghost mt-md" style="margin-left:8px" onclick="openAuthModal('login')">Sign In</button>
        </div>`;
      return;
    }

    const myCreations = State.creations.filter(c => c.creatorId === State.currentUser.uid);

    container.innerHTML = `
      <div class="hero-banner">
        <div class="page-title glow-green">CREATOR SPACE</div>
        <div class="page-subtitle">Upload and publish your digital creations</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-lg);margin-bottom:var(--space-xl)" id="create-type-grid">
        ${[
          { type:'music',  label:'Upload Music',        sub:'MP3, WAV, FLAC, AAC' },
          { type:'audio',  label:'Upload Audio',        sub:'Podcasts, beats, sound effects' },
          { type:'video',  label:'Upload Video',        sub:'MP4, MOV, WebM' },
          { type:'art',    label:'Upload Art / Image',  sub:'PNG, JPG, WebP, GIF' },
          { type:'text',   label:'Write Something',     sub:'Post a thought, story, or update', icon:'text' },
        ].map(t => `
          <button class="creation-card" style="text-align:left;padding:24px;cursor:pointer"
                  onclick="showUploadForm('${t.type}')">
            <div style="width:48px;height:48px;color:var(--electric);margin-bottom:12px">${t.icon === 'text' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` : typeIcon(t.type)}</div>
            <div style="font-size:1rem;font-weight:700;margin-bottom:4px">${t.label}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${t.sub}</div>
          </button>
        `).join('')}
      </div>
      <div id="upload-form-wrap" class="hidden"></div>
      <div class="omega-divider"></div>
      <div class="section-header mb-md">
        <span class="section-title">My Creations</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${myCreations.length} published</span>
      </div>
      <div class="grid-3" id="my-creations-grid">
        ${myCreations.length
          ? myCreations.map(c => buildCreationCard(c)).join('')
          : `<div class="empty-state" style="grid-column:1/-1"><h3>No creations yet</h3><p>Upload your first creation above.</p></div>`}
      </div>`;
  },

  // ── SEARCH ───────────────────────────────────────────────────
  search(container, initialQuery) {
    container.innerHTML = `
      <div style="padding-top:var(--space-xl)">
        <div class="page-title glow-blue mb-md">SHADOW SEARCH</div>
        <div class="search-bar" style="margin-bottom:var(--space-lg)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="main-search-input" type="search" placeholder="Search creations, music, art, video, creators…"
                 oninput="runSearch(this.value)" autofocus aria-label="Search Shadow of Salem"
                 value="${esc(initialQuery)}">
        </div>
        <div id="search-results"></div>
      </div>`;
    if (initialQuery) runSearch(initialQuery);
    else document.getElementById('main-search-input')?.focus();
  },

  // ── PROFILE ──────────────────────────────────────────────────
  profile(container, profileId) {
    const isOwn = !profileId
      || profileId === 'my'
      || (State.currentUser && profileId === State.currentUser.uid);

    if (isOwn && !State.currentUser) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Sign in to view your profile</h3>
          <button class="btn btn-create mt-md" onclick="openAuthModal('login')">Sign In</button>
          <button class="btn btn-ghost mt-md" style="margin-left:8px" onclick="openAuthModal('signup')">Create Account</button>
        </div>`;
      return;
    }

    // Show loading state immediately — never show "Creator not found" before lookup completes
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">Loading creator…</div>`;

    if (isOwn) {
      // Own profile: State.myProfile is populated by onAuthStateChanged → loadMyProfile.
      // If it is already available render immediately; otherwise wait briefly.
      const render = () => {
        const profile   = State.myProfile;
        const creations = State.creations.filter(c => c.creatorId === State.currentUser.uid);
        renderProfileHTML(container, profile, creations, true);
      };
      if (State.myProfile) {
        render();
      } else {
        // myProfile not yet loaded — fetch directly
        getDoc(doc(db, 'users', State.currentUser.uid)).then(snap => {
          if (snap.exists()) {
            State.myProfile = { id: State.currentUser.uid, ...snap.data() };
          }
          render();
        }).catch(err => {
          console.error('profile fetch error:', err);
          render(); // render with whatever myProfile fallback we have
        });
      }
    } else {
      // Another user's profile — load from Firestore by UID
      getDoc(doc(db, 'users', profileId)).then(snap => {
        if (snap.exists()) {
          const profile   = { id: profileId, ...snap.data() };
          const creations = State.creations.filter(c => c.creatorId === profileId);
          renderProfileHTML(container, profile, creations, false);
        } else {
          // No Firestore profile doc for this UID — try to show something useful
          // using cached creation data (e.g. seed creators)
          const creations = State.creations.filter(c => c.creatorId === profileId);
          if (creations.length > 0) {
            const creator = creations[0].creator || profileId;
            renderProfileHTML(
              container,
              { id: profileId, username: creator, displayName: creator, bio: '' },
              creations,
              false
            );
          } else {
            // Genuinely not found after lookup completed
            renderProfileHTML(container, null, [], false);
          }
        }
      }).catch(err => {
        console.error('Creator profile load error:', err);
        const code = err?.code || '';
        let msg = 'Could not load creator profile.';
        if (code === 'permission-denied')  msg = 'You do not have permission to view this profile.';
        else if (code === 'unavailable' || code === 'network-request-failed')
          msg = 'Network error — check your connection and try again.';
        container.innerHTML = `<div class="empty-state"><h3>${esc(msg)}</h3><button class="btn btn-ghost mt-md" onclick="navigate('stream')">← Stream</button></div>`;
      });
    }
  },

  // ── VIEWER ───────────────────────────────────────────────────
  viewer(container, id) {
    const c = State.getCreation(id);
    if (!c) {
      container.innerHTML = `<div class="empty-state"><h3>Creation not found</h3><button class="btn btn-ghost mt-md" onclick="navigate('stream')">← Stream</button></div>`;
      return;
    }
    const liked    = State.isLiked(c.id);
    const isAudio  = c.type === 'music' || c.type === 'audio';
    const isVideo  = c.type === 'video';
    const isText   = c.type === 'text';
    const isOwner  = !!(State.currentUser && c.creatorId === State.currentUser.uid);
    const media    = LocalMedia.get(c.id);

    container.innerHTML = `
      <div class="viewer-page">
        <button class="btn btn-ghost btn-sm mb-md" onclick="navigate('stream')">← Back</button>

        <div class="viewer-media">
          ${isAudio ? `
            <div class="viewer-audio" style="background:${esc(c.coverColor||'var(--omega-surface)')}">
              <div class="viewer-audio-art">
                <div class="viewer-audio-art-placeholder">${typeIcon('music')}</div>
              </div>
              <div class="waveform-bars" id="viewer-waveform">
                ${Array.from({length:20},(_,i)=>`<div class="wave-bar ${OmegaPlayer.isCurrentTrack(c.id)&&OmegaPlayer.isPlaying()?'playing':''}" style="height:${4+Math.sin(i*0.9)*12+6}px;animation-delay:${(i%5)*0.1}s"></div>`).join('')}
              </div>
              ${!media.audioURL ? `<div style="padding:6px 0;text-align:center;font-size:0.78rem;color:var(--text-muted)">Audio is local to the uploader's device and not available here.</div>` : ''}
              <div class="viewer-controls">
                <button class="viewer-skip-btn" onclick="OmegaPlayer.prev()" aria-label="Previous">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
                </button>
                <button class="viewer-play-btn" id="viewer-play-btn" onclick="viewerTogglePlay('${esc(c.id)}')" aria-label="Play/Pause">
                  ${OmegaPlayer.isCurrentTrack(c.id) && OmegaPlayer.isPlaying()
                    ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
                    : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`}
                </button>
                <button class="viewer-skip-btn" onclick="OmegaPlayer.next()" aria-label="Next">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                </button>
              </div>
              <div class="viewer-progress" onclick="viewerSeek(event)" style="margin:0 8px 6px">
                <div class="viewer-progress-fill" id="viewer-progress-fill" style="width:0%"></div>
              </div>
              <div class="viewer-times">
                <span id="viewer-current-time">0:00</span>
                <span id="viewer-duration">${fmtDuration(c.duration) || '0:00'}</span>
              </div>
              <div class="viewer-volume-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
                <input type="range" class="viewer-volume" min="0" max="1" step="0.02" value="1"
                       oninput="OmegaPlayer.setVolume(this.value)" aria-label="Volume">
              </div>
            </div>
          ` : isVideo ? `
            <div>
              ${media.videoURL
                ? `<video controls src="${esc(media.videoURL)}" style="width:100%;max-height:70vh;background:#000;display:block"></video>`
                : `<div style="min-height:260px;display:flex;align-items:center;justify-content:center;flex-direction:column;background:var(--omega-surface);gap:12px;padding:40px;text-align:center">
                     ${typeIcon('video')}
                     <p style="color:var(--text-muted);font-size:0.85rem">Video is local to the uploader's device and not available here.</p>
                   </div>`}
            </div>
          ` : isText ? `
            <div style="display:none"></div>
          ` : `
            <div style="min-height:300px;display:flex;align-items:center;justify-content:center;padding:24px;background:${esc(c.coverColor||'var(--omega-surface)')}">
              ${media.coverURL
                ? `<img src="${esc(media.coverURL)}" style="max-height:340px;max-width:100%;border-radius:var(--r-md)">`
                : `<div style="color:var(--electric);opacity:0.5;width:80px;height:80px">${typeIcon(c.type)}</div>`}
            </div>
          `}
        </div>

        <div class="viewer-meta">
          <div class="viewer-creator-row">
            <img src="${avatarUrl(c.creator)}" class="avatar avatar-sm" alt="${esc(c.creator)}"
                 onclick="navigate('profile',{profileId:'${esc(c.creatorId)}'})" style="cursor:pointer">
            <span class="card-creator-name" onclick="navigate('profile',{profileId:'${esc(c.creatorId)}'})">
              ${esc(c.creator)}
            </span>
            <span class="badge badge-${typeColor(c.type)}" style="margin-left:8px">${esc(c.category || c.type)}</span>
            <span style="margin-left:auto;font-size:0.75rem;color:var(--text-muted)">${timeAgo(c.createdAt)}</span>
          </div>

          ${c.description ? `
          <div class="viewer-creator-note" id="viewer-creator-note">
            <div class="viewer-creator-note-text">${esc(c.description)}</div>
          </div>` : ''}

          ${isText ? '' : `<div class="viewer-title">${esc(c.title)}</div>`}
          ${c.tags?.length ? `<div class="card-tags mb-md">${c.tags.map(t=>`<span class="card-tag">#${esc(t)}</span>`).join('')}</div>` : ''}

          <div class="viewer-actions mb-lg">
            <button class="btn ${liked ? 'btn-danger' : 'btn-outline'}" id="viewer-like-btn"
                    onclick="handleLike('${esc(c.id)}');updateViewerLike('${esc(c.id)}')">
              <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span id="viewer-like-count">${fmtCount(c.likes)}</span>
            </button>
            <button class="btn btn-ghost" onclick="handleShare('${esc(c.id)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </button>
            <button class="btn btn-ghost" onclick="navigate('profile',{profileId:'${esc(c.creatorId)}'})">
              View Creator
            </button>
            ${isOwner ? `
            <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openEditCreationModal('${esc(c.id)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
            <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="confirmDeleteCreation('${esc(c.id)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete
            </button>` : ''}
          </div>

          <div class="omega-divider"></div>
          <div class="section-header" id="comments-header">
            <span class="section-title">Comments</span>
            <span style="font-size:0.8rem;color:var(--text-muted)" id="comment-count">${c.comments || 0}</span>
          </div>

          ${State.currentUser ? `
          <div style="display:flex;gap:10px;margin-bottom:var(--space-md)">
            <input class="form-input" id="comment-input" placeholder="Add a comment…" maxlength="400"
                   onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();submitComment('${esc(c.id)}')}"
                   style="flex:1">
            <button class="btn btn-outline" onclick="submitComment('${esc(c.id)}')">Post</button>
          </div>` : `
          <div style="margin-bottom:var(--space-md);font-size:0.85rem;color:var(--text-muted)">
            <button class="btn btn-ghost btn-sm" onclick="openAuthModal('login')">Sign in</button> to comment.
          </div>`}

          <div id="comments-list">
            <div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem">Loading comments…</div>
          </div>
        </div>
      </div>`;

    // Load comments async
    fsGetComments(c.id).then(comments => {
      const list = document.getElementById('comments-list');
      if (list) list.innerHTML = renderCommentsList(comments);
      const cnt = document.getElementById('comment-count');
      if (cnt) cnt.textContent = comments.length;
    });

    // Auto-load audio
    if (isAudio && !OmegaPlayer.isCurrentTrack(c.id)) {
      playCreation(c.id);
    }
  },
};

// ─── Profile HTML helper ──────────────────────────────────────

function renderProfileHTML(container, profile, creations, isOwn) {
  if (!profile) {
    container.innerHTML = `<div class="empty-state"><h3>Creator not found</h3><button class="btn btn-ghost mt-md" onclick="navigate('stream')">← Stream</button></div>`;
    return;
  }
  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-cover"><div class="profile-cover-placeholder"></div></div>
      <div style="display:flex;align-items:flex-end;gap:16px;padding:0 var(--space-lg);margin-top:-20px;flex-wrap:wrap">
        <div class="profile-avatar-wrap">
          <img src="${avatarUrl(profile.displayName || profile.username)}" class="avatar avatar-xl profile-avatar" alt="${esc(profile.displayName || profile.username)}">
        </div>
        ${isOwn ? `<div style="display:flex;gap:8px;margin-bottom:4px">
          <button class="btn btn-ghost btn-sm" onclick="openEditProfileModal()">Edit Profile</button>
          <button class="btn btn-ghost btn-sm" onclick="handleSignOut()">Sign Out</button>
        </div>` : ''}
      </div>
    </div>
    <div class="profile-info">
      <div class="profile-name">${esc(profile.displayName || profile.username)}</div>
      <div class="profile-username">@${esc(profile.username || profile.id)}</div>
      ${profile.bio ? `<div class="profile-bio">${esc(profile.bio)}</div>` : ''}
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-value">${creations.length}</div>
          <div class="profile-stat-label">Creations</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${fmtCount(creations.reduce((a,c) => a+(c.likes||0), 0))}</div>
          <div class="profile-stat-label">Likes</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${fmtCount(creations.reduce((a,c) => a+(c.plays||0), 0))}</div>
          <div class="profile-stat-label">Plays</div>
        </div>
      </div>
    </div>
    <div class="page-container" style="padding-top:0">
      <div class="omega-divider"></div>
      <div class="section-header mb-md">
        <span class="section-title">${isOwn ? 'My Creations' : 'Creations'}</span>
      </div>
      <div class="grid-3">
        ${creations.length
          ? creations.map(c => buildCreationCard(c)).join('')
          : `<div class="empty-state" style="grid-column:1/-1">
               <div class="empty-state-icon">${typeIcon('music')}</div>
               <h3>No creations yet</h3>
               ${isOwn ? `<button class="btn btn-create mt-md" onclick="navigate('create')">+ New Creation</button>` : ''}
             </div>`}
      </div>
    </div>`;
}

// ─── Stream helpers ───────────────────────────────────────────

function renderStream(filter) {
  const grid = document.getElementById('stream-grid');
  if (!grid) return;
  const items = (filter === 'all'
    ? [...State.creations]
    : State.creations.filter(c => c.type === filter)
  ).sort((a,b) => b.createdAt - a.createdAt);
  grid.innerHTML = items.length
    ? items.map(c => buildCreationCard(c)).join('')
    : `<div class="empty-state" style="grid-column:1/-1">
         <h3>No creations yet</h3>
         <button class="btn btn-create mt-md" onclick="navigate('create')">+ New Creation</button>
       </div>`;
}

window.streamFilter = function(filter, btn) {
  document.querySelectorAll('#stream-filters .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStream(filter);
};

function renderExplore(filter, query) {
  const grid = document.getElementById('explore-grid');
  if (!grid) return;
  let items = filter === 'all' ? [...State.creations] : State.creations.filter(c => c.type === filter);
  if (filter === 'new') items = [...State.creations].sort((a,b) => b.createdAt - a.createdAt);
  if (query) {
    const q = query.toLowerCase();
    items = items.filter(c =>
      c.title?.toLowerCase().includes(q) ||
      c.creator?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
  }
  grid.innerHTML = items.length
    ? items.map(c => buildCreationCard(c)).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><h3>No results</h3><p>Try a different filter or search term.</p></div>`;
}

window.exploreFilter = function(filter, btn) {
  document.querySelectorAll('#explore-filters .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('explore-search')?.value || '';
  renderExplore(filter, q);
};

window.exploreSearch = function(q) {
  const activeFilter = document.querySelector('#explore-filters .filter-tab.active')?.textContent?.toLowerCase() || 'all';
  renderExplore(activeFilter, q);
};

// ─── Collection helpers ───────────────────────────────────────

function buildCollectionCard(col) {
  const thumbs = (col.creations || []).slice(0,4).map(id => State.getCreation(id)).filter(Boolean);
  return `
    <div class="collection-card" onclick="navigate('collection',{collectionId:'${esc(col.id)}'})">
      <div class="collection-cover">
        ${thumbs.length ? `
          <div class="collection-cover-grid" style="grid-template-columns:${thumbs.length>1?'1fr 1fr':'1fr'};grid-template-rows:${thumbs.length>2?'1fr 1fr':'1fr'}">
            ${thumbs.map(c=>`
              <div class="collection-cover-thumb" style="background:${c.coverColor||'var(--omega-surface)'}">
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:0.5;color:var(--electric)">
                  <div style="width:28px;height:28px">${typeIcon(c.type)}</div>
                </div>
              </div>`).join('')}
          </div>` : `
          <div class="collection-cover-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </div>`}
      </div>
      <div class="collection-info">
        <div class="collection-name">${esc(col.name)}</div>
        <div class="collection-count">${(col.creations||[]).length} creation${(col.creations||[]).length!==1?'s':''}</div>
      </div>
    </div>`;
}

window.openCreateCollectionModal = function() {
  if (!State.currentUser) { openAuthModal('login'); return; }
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title">New Collection</div>
      <button type="button" class="modal-close" onclick="Modal.close()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Collection Name</label>
        <input class="form-input" id="col-name" placeholder="e.g. My Artwork, Beat Library…" maxlength="60">
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <textarea class="form-input" id="col-desc" placeholder="What's in this collection?" maxlength="200"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" class="btn btn-create" onclick="createCollection()">Create Collection</button>
    </div>
  `);
};

window.createCollection = async function() {
  const name = document.getElementById('col-name')?.value?.trim();
  if (!name) { Toast.error('Please enter a collection name.'); return; }
  const desc = document.getElementById('col-desc')?.value?.trim() || '';
  await fsAddCollection({ name, description: desc });
  Modal.close();
  Toast.success(`Collection "${name}" created!`);
  navigate('collections');
};

// ─── Upload / Creator Space ───────────────────────────────────

window.showUploadForm = function(type) {
  const wrap = document.getElementById('upload-form-wrap');
  if (!wrap) return;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const accepts    = { music: 'audio/*', audio: 'audio/*', video: 'video/*', art: 'image/*' };
  const fileLabels = { music: 'Audio File', audio: 'Audio File', video: 'Video File', art: 'Image File' };
  const isTextOnly = type === 'text';

  const typeNames = { music:'Music', audio:'Audio', video:'Video', art:'Art', text:'Post' };
  const typeName  = typeNames[type] || type.charAt(0).toUpperCase()+type.slice(1);

  wrap.innerHTML = `
    <div class="creation-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-lg)">
        <div style="font-size:1.05rem;font-weight:700">New ${typeName} Creation</div>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('upload-form-wrap').classList.add('hidden')">✕</button>
      </div>

      ${isTextOnly ? '' : `
      <div class="drop-zone" id="upload-drop-zone"
           onclick="document.getElementById('upload-file-input').click()"
           ondragover="event.preventDefault();this.classList.add('dragover')"
           ondragleave="this.classList.remove('dragover')"
           ondrop="handleFileDrop(event,'${type}')">
        <div class="drop-zone-icon">${typeIcon(type)}</div>
        <div class="drop-zone-text">Click to select a ${fileLabels[type]} or drag & drop</div>
        <div class="drop-zone-hint">File stays on your device — media is not uploaded to a server</div>
      </div>
      <input type="file" id="upload-file-input" accept="${accepts[type]}" style="display:none"
             onchange="handleFileSelected(this.files[0],'${type}')">
      <div id="upload-preview-area"></div>
      `}

      <div class="form-group mt-md">
        <label class="form-label">Title ${isTextOnly ? '<span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(optional)</span>' : '<span style="color:var(--danger)">*</span>'}</label>
        <input class="form-input" id="upload-title" placeholder="${isTextOnly ? 'Give it a title (optional)…' : 'Give your creation a title…'}" maxlength="100">
      </div>

      <div class="form-group">
        <label class="form-label" style="font-size:0.92rem">
          ${isTextOnly ? 'What\'s on your mind?' : 'Say something about this creation…'}
          ${isTextOnly ? '<span style="color:var(--danger)">*</span>' : '<span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(optional)</span>'}
        </label>
        <textarea class="form-input" id="upload-desc"
                  placeholder="${isTextOnly ? 'Share a thought, story, update, or anything on your mind…' : 'This is a new song I\'ve been working on. Here\'s what inspired it…'}"
                  maxlength="2000"
                  style="min-height:${isTextOnly ? '160px' : '90px'};resize:vertical"></textarea>
        <div style="font-size:0.75rem;color:var(--text-muted);text-align:right;margin-top:4px">
          <span id="upload-desc-count">0</span>/2000
        </div>
      </div>

      ${isTextOnly ? '' : `
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="upload-category">${getCategoryOptions(type)}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Tags (comma-separated)</label>
        <input class="form-input" id="upload-tags" placeholder="e.g. ambient, space, synth">
      </div>
      `}

      <div class="modal-footer" style="padding:0;margin-top:var(--space-md)">
        <button class="btn btn-ghost" onclick="document.getElementById('upload-form-wrap').classList.add('hidden')">Cancel</button>
        <button class="btn btn-create" onclick="submitCreation('${type}')">Publish</button>
      </div>
    </div>`;

  // Live character counter for the description textarea
  const descEl    = document.getElementById('upload-desc');
  const countEl   = document.getElementById('upload-desc-count');
  if (descEl && countEl) {
    descEl.addEventListener('input', () => { countEl.textContent = descEl.value.length; });
  }
};

function getCategoryOptions(type) {
  const opts = {
    music: ['Electronic','Hip-Hop','Ambient','Techno','Lo-Fi','Jazz','Classical','Pop','Rock','R&B','Experimental','Other'],
    audio: ['Podcast','Meditation','Sound Effects','Beats','Field Recording','Spoken Word','ASMR','Other'],
    video: ['Short Film','Music Video','Animation','Documentary','Experimental','Reel','Tutorial','Other'],
    art:   ['Digital Painting','Photography','Concept Art','Abstract','Illustration','Generative','3D Art','Other'],
  };
  return (opts[type] || opts.art).map(o => `<option value="${o}">${o}</option>`).join('');
}

window.handleFileSelected = function(file, type) {
  if (file) renderFilePreview(file, type);
};

window.handleFileDrop = function(e, type) {
  e.preventDefault();
  document.getElementById('upload-drop-zone')?.classList.remove('dragover');
  const file = e.dataTransfer?.files?.[0];
  if (file) renderFilePreview(file, type);
};

function renderFilePreview(file, type) {
  const area = document.getElementById('upload-preview-area');
  if (!area) return;
  const url = URL.createObjectURL(file);
  // Store blob URL in a data attribute — never goes to Firestore
  area.dataset.localUrl  = url;
  area.dataset.mediaType = type;

  if (type === 'art') {
    area.innerHTML = `<div class="mt-md"><img src="${url}" style="max-height:200px;border-radius:var(--r-md);border:1px solid var(--omega-border)"><p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">${esc(file.name)}</p></div>`;
  } else if (type === 'music' || type === 'audio') {
    area.innerHTML = `<div class="mt-md" style="background:var(--omega-surface);border-radius:var(--r-md);padding:14px;border:1px solid var(--omega-border)">
      <audio controls src="${url}" style="width:100%;margin-bottom:6px"></audio>
      <p style="font-size:0.78rem;color:var(--text-muted)">${esc(file.name)}</p>
    </div>`;
  } else if (type === 'video') {
    area.innerHTML = `<div class="mt-md"><video controls src="${url}" style="width:100%;max-height:220px;border-radius:var(--r-md);border:1px solid var(--omega-border)"></video><p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">${esc(file.name)}</p></div>`;
  }
}

window.submitCreation = async function(type) {
  const isTextOnly = type === 'text';
  const title      = document.getElementById('upload-title')?.value?.trim();
  const description = document.getElementById('upload-desc')?.value?.trim() || '';

  // Text-only posts require at least some content (description or title)
  if (isTextOnly && !title && !description) {
    Toast.error('Please write something before publishing.'); return;
  }
  // Media creations require a title
  if (!isTextOnly && !title) {
    Toast.error('Please enter a title.'); return;
  }

  const area      = document.getElementById('upload-preview-area');
  const localUrl  = area?.dataset?.localUrl  || null;
  const mediaType = area?.dataset?.mediaType || null;

  const tags = (document.getElementById('upload-tags')?.value || '')
    .split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5);

  const creationData = {
    type:        isTextOnly ? 'text' : type,
    title:       title || description.slice(0, 60) || 'Untitled', // auto-title for text posts
    description,
    category:    document.getElementById('upload-category')?.value || '',
    tags,
    coverColor:  'linear-gradient(135deg,#0a000f,#1a002a,#050010)',
    hasLocalMedia: !!localUrl,
    // Blob URLs stay local — passed to LocalMedia, not Firestore
    audioURL: (mediaType === 'music' || mediaType === 'audio') ? localUrl : null,
    videoURL: mediaType === 'video' ? localUrl : null,
    coverURL: mediaType === 'art'   ? localUrl : null,
  };

  try {
    const newId = await fsAddCreation(creationData);
    document.getElementById('upload-form-wrap')?.classList.add('hidden');
    Toast.success(`Published to Shadow of Salem!`);
    if (newId) setTimeout(() => navigate('viewer', { id: newId }), 400);
  } catch (e) {
    Toast.error('Failed to publish. Please try again.');
    console.error(e);
  }
};

// ─── Search ───────────────────────────────────────────────────

window.runSearch = function(query) {
  const results = document.getElementById('search-results');
  if (!results) return;
  if (!query?.trim()) {
    results.innerHTML = `<div class="empty-state"><p>Start typing to search creations and creators.</p></div>`;
    return;
  }
  const q = query.toLowerCase();
  const creations = State.creations.filter(c =>
    c.title?.toLowerCase().includes(q) ||
    c.creator?.toLowerCase().includes(q) ||
    c.description?.toLowerCase().includes(q) ||
    c.category?.toLowerCase().includes(q) ||
    c.tags?.some(t => t.toLowerCase().includes(q))
  );

  // Build creator list from creations (Firestore user docs require separate query)
  const seenCreators = new Map();
  State.creations.forEach(c => {
    if (!seenCreators.has(c.creatorId) &&
        (c.creator?.toLowerCase().includes(q))) {
      seenCreators.set(c.creatorId, { id: c.creatorId, displayName: c.creator, username: c.creator, bio: '' });
    }
  });
  const creators = [...seenCreators.values()];

  let html = '';
  if (creations.length) {
    html += `<div class="section-header mb-md"><span class="section-title">Creations (${creations.length})</span></div>`;
    html += `<div class="grid-3 mb-lg">${creations.map(c => buildCreationCard(c)).join('')}</div>`;
  }
  if (creators.length) {
    html += `<div class="section-header mb-md mt-lg"><span class="section-title">Creators (${creators.length})</span></div>`;
    html += `<div style="display:flex;flex-direction:column;gap:12px">${creators.map(cr => `
      <div class="creation-card" style="display:flex;align-items:center;gap:14px;padding:16px;cursor:pointer"
           onclick="navigate('profile',{profileId:'${esc(cr.id)}'})">
        <img src="${avatarUrl(cr.displayName)}" class="avatar avatar-md" alt="${esc(cr.displayName)}">
        <div>
          <div style="font-weight:700">${esc(cr.displayName)}</div>
          <div style="font-size:0.8rem;color:var(--electric)">@${esc(cr.username)}</div>
          ${cr.bio ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">${esc(cr.bio)}</div>` : ''}
        </div>
      </div>`).join('')}</div>`;
  }
  if (!creations.length && !creators.length) {
    html = `<div class="empty-state"><h3>No results for "${esc(query)}"</h3><p>Try different keywords.</p></div>`;
  }
  results.innerHTML = html;
};

// ─── Viewer helpers ───────────────────────────────────────────

window.viewerTogglePlay = function(id) {
  if (OmegaPlayer.isCurrentTrack(id)) {
    OmegaPlayer.togglePlay();
  } else {
    playCreation(id);
  }
  setTimeout(() => {
    const btn     = document.getElementById('viewer-play-btn');
    if (!btn) return;
    const playing = OmegaPlayer.isCurrentTrack(id) && OmegaPlayer.isPlaying();
    btn.innerHTML = playing
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    document.querySelectorAll('#viewer-waveform .wave-bar').forEach(b => {
      b.classList.toggle('playing', playing);
    });
  }, 120);
};

window.viewerSeek = function(e) {
  const bar   = e.currentTarget;
  const rect  = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  OmegaPlayer.seekRatio(ratio);
};

window.updateViewerLike = function(id) {
  const c = State.getCreation(id);
  if (!c) return;
  const liked = State.isLiked(id);
  const btn   = document.getElementById('viewer-like-btn');
  const cnt   = document.getElementById('viewer-like-count');
  if (btn) {
    btn.className = `btn ${liked ? 'btn-danger' : 'btn-outline'}`;
    btn.querySelector('svg')?.setAttribute('fill', liked ? 'currentColor' : 'none');
  }
  if (cnt) cnt.textContent = fmtCount(c.likes || 0);
};

// ─── Comments ─────────────────────────────────────────────────

window.submitComment = async function(creationId) {
  const input = document.getElementById('comment-input');
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = '';
  const comment = await fsAddComment(creationId, text);
  if (!comment) return;
  // Reload comments
  const comments = await fsGetComments(creationId);
  const list = document.getElementById('comments-list');
  if (list) list.innerHTML = renderCommentsList(comments);
  const cnt = document.getElementById('comment-count');
  if (cnt) cnt.textContent = comments.length;
};

function renderCommentsList(comments) {
  if (!comments.length) return `<div class="empty-state"><p style="font-size:0.85rem">No comments yet. Be the first.</p></div>`;
  return [...comments].reverse().map(cm => `
    <div class="comment">
      <img src="${avatarUrl(cm.author)}" class="avatar avatar-sm" alt="${esc(cm.author)}">
      <div class="comment-body">
        <div class="comment-author">${esc(cm.author)}</div>
        <div class="comment-text">${esc(cm.text)}</div>
        <div class="comment-time">${timeAgo(cm.time)}</div>
      </div>
    </div>`).join('');
}

// ─── Profile edit modal ───────────────────────────────────────

window.openEditProfileModal = function() {
  const p = State.myProfile || {};
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title">Edit Profile</div>
      <button type="button" class="modal-close" onclick="Modal.close()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Display Name</label>
        <input class="form-input" id="ep-name" value="${esc(p.displayName||'')}" maxlength="50">
      </div>
      <div class="form-group">
        <label class="form-label">Username</label>
        <input class="form-input" id="ep-username" value="${esc(p.username||'')}" maxlength="30">
      </div>
      <div class="form-group">
        <label class="form-label">Bio</label>
        <textarea class="form-input" id="ep-bio" maxlength="200" placeholder="Tell the universe who you are…">${esc(p.bio||'')}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="saveProfile()">Save</button>
    </div>
  `);
};

window.saveProfile = async function() {
  const name        = document.getElementById('ep-name')?.value?.trim();
  const rawUsername = document.getElementById('ep-username')?.value?.trim();
  const username    = rawUsername
    ? rawUsername.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
    : (State.myProfile?.username || '');
  const bio = document.getElementById('ep-bio')?.value?.trim() || '';
  if (!name) { Toast.error('Display name is required.'); return; }

  const uid = State.currentUser?.uid;
  if (!uid) return;

  const updates = clean({
    uid,
    displayName:   name,
    username:      username || undefined,
    usernameLower: username ? username.toLowerCase() : undefined,
    bio,
  });

  // Use setDoc with merge so this works even if the Firestore doc doesn't exist yet
  await setDoc(doc(db, 'users', uid), updates, { merge: true });
  await updateProfile(auth.currentUser, { displayName: name });

  State.myProfile = {
    ...State.myProfile,
    uid,
    displayName: name,
    username: username || State.myProfile?.username,
    usernameLower: username ? username.toLowerCase() : State.myProfile?.usernameLower,
    bio,
  };
  updateAuthNav();
  Modal.close();
  Toast.success('Profile updated!');
  navigate('profile', { profileId: 'my' });
};

// ─── Edit / Delete Creation modals ───────────────────────────

window.openEditCreationModal = function(creationId) {
  const c = State.getCreation(creationId);
  if (!c) return;
  if (!State.currentUser || c.creatorId !== State.currentUser.uid) {
    Toast.error('You can only edit your own creations.'); return;
  }
  const isTextType = c.type === 'text';
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title">Edit Creation</div>
      <button type="button" class="modal-close" onclick="Modal.close()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      ${isTextType ? '' : `
      <div class="form-group">
        <label class="form-label">Title <span style="color:var(--danger)">*</span></label>
        <input class="form-input" id="ec-title" value="${esc(c.title)}" maxlength="100">
      </div>`}
      <div class="form-group">
        <label class="form-label" style="font-size:0.92rem">
          ${isTextType ? 'Your post' : 'Say something about this creation…'}
        </label>
        <textarea class="form-input" id="ec-desc" maxlength="2000"
                  placeholder="${isTextType ? 'Share a thought, story, or update…' : 'What inspired this? What\'s the story?'}"
                  style="min-height:${isTextType ? '160px' : '90px'};resize:vertical">${esc(c.description||'')}</textarea>
        <div style="font-size:0.75rem;color:var(--text-muted);text-align:right;margin-top:4px">
          <span id="ec-desc-count">${(c.description||'').length}</span>/2000
        </div>
      </div>
      ${isTextType ? '' : `
      <div class="form-group">
        <label class="form-label">Tags (comma-separated)</label>
        <input class="form-input" id="ec-tags" value="${esc((c.tags||[]).join(', '))}" maxlength="200">
      </div>`}
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="saveCreation('${esc(creationId)}')">Save Changes</button>
    </div>
  `);
  const descEl  = document.getElementById('ec-desc');
  const countEl = document.getElementById('ec-desc-count');
  if (descEl && countEl) {
    descEl.addEventListener('input', () => { countEl.textContent = descEl.value.length; });
  }
};

window.saveCreation = async function(creationId) {
  const c = State.getCreation(creationId);
  if (!c) return;
  const isTextType = c.type === 'text';

  const title       = isTextType ? c.title : (document.getElementById('ec-title')?.value?.trim() || '');
  const description = document.getElementById('ec-desc')?.value?.trim() || '';
  const rawTags     = document.getElementById('ec-tags')?.value || '';

  if (!isTextType && !title) { Toast.error('Title is required.'); return; }
  if (isTextType && !title && !description) { Toast.error('Please write something.'); return; }

  const tags = isTextType ? (c.tags || []) :
    rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 5);

  const updates = clean({
    title:       title || description.slice(0, 60) || c.title,
    description,
    tags,
  });

  try {
    await fsUpdateCreation(creationId, updates);
    // Optimistically update local state
    const idx = State.creations.findIndex(x => x.id === creationId);
    if (idx !== -1) State.creations[idx] = { ...State.creations[idx], ...updates };
    Modal.close();
    Toast.success('Creation updated!');
    // Re-render the viewer with updated data
    navigate('viewer', { id: creationId });
  } catch (e) {
    Toast.error('Could not save changes. Please try again.');
    console.error(e);
  }
};

window.confirmDeleteCreation = function(creationId) {
  const c = State.getCreation(creationId);
  if (!c) return;
  Modal.open(`
    <div class="modal-header">
      <div class="modal-title">Delete Creation</div>
      <button type="button" class="modal-close" onclick="Modal.close()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p style="color:var(--text-secondary);font-size:0.9rem">
        Are you sure you want to permanently delete <strong>${esc(c.title)}</strong>?
        This cannot be undone.
      </p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
      <button type="button" class="btn btn-danger" onclick="handleDeleteCreation('${esc(creationId)}')">Delete</button>
    </div>
  `);
};

window.handleDeleteCreation = async function(creationId) {
  try {
    await fsDeleteCreation(creationId);
    Modal.close();
    Toast.info('Creation deleted.');
    navigate('stream');
  } catch (e) {
    Toast.error('Could not delete. Please try again.');
    console.error(e);
  }
};

// ─── Keyboard shortcuts ───────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Escape always closes an open modal, regardless of focus target
  if (e.code === 'Escape' && Modal._open) {
    e.preventDefault();
    Modal.close();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space')                    { e.preventDefault(); OmegaPlayer.togglePlay(); }
  if (e.code === 'KeyK')                       OmegaPlayer.togglePlay();
  if (e.code === 'ArrowRight' && e.altKey)     OmegaPlayer.next();
  if (e.code === 'ArrowLeft'  && e.altKey)     OmegaPlayer.prev();
  if (e.code === 'Slash')                    { e.preventDefault(); navigate('search'); }
});

// ─── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Startup screen is already visible — rendered inline in HTML before any JS
  // ran, so the user never sees a blank/black page.
  Startup._init();

  // Safety timeout: if Firebase Auth takes longer than 15 seconds (e.g. slow
  // CDN cold-start on GitHub Pages, offline, service outage) we stop waiting
  // and enter guest mode so the user is never left on a blank screen.
  // This must NOT show an error for a normal slow load — only a genuine timeout.
  const startupTimeout = setTimeout(() => {
    if (_bootState !== 'booting') return; // already resolved — nothing to do
    console.warn('Shadow of Salem: Firebase Auth timeout — entering guest mode.');
    _bootState = 'guest';
    // Ensure Firestore listeners are started even in the fallback path so the
    // Stream loads public creations as soon as the network is available.
    maybeSeedFirestore().catch(() => {});
    subscribeCreations();
    subscribeCollections();
    const raw = window.location.hash || '#/stream';
    const { page, params } = hashToRoute(raw);
    navigate(page, params);
    Startup.dismiss();
  }, 15000);

  // authReady only ever resolves — it never rejects.
  // The onAuthStateChanged callback has its own try/catch that guarantees
  // _authReadyResolve() is always called, even on errors.
  await authReady;
  clearTimeout(startupTimeout);

  // Parse the current URL hash using the canonical router.
  // If no hash is present, default to stream.
  const raw = window.location.hash || '#/stream';
  const { page, params } = hashToRoute(raw);
  navigate(page, params);

  // Smoothly remove the startup screen now that the app is ready.
  Startup.dismiss();
});

// Expose to HTML onclick handlers
window.navigate           = navigate;
window.OmegaPlayer        = OmegaPlayer;
