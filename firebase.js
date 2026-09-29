/* ═══════════════════════════════════════════════════════════
   SHADOW OF SALEM — firebase.js
   Single Firebase initialisation point for the entire app.
   Import { auth, db } from this module; do not call
   initializeApp() anywhere else.
═══════════════════════════════════════════════════════════ */

import { initializeApp }             from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth }                   from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore }              from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js';

// ─── DIAGNOSTIC: confirm firebase.js module loaded ────────────
console.log('[Firebase] firebase.js module executing — SDK 12.19.0');

const firebaseConfig = {
  apiKey:            'AIzaSyDSxO8uyyEwWSIDW-y0-ngWrCPytzA4XmA',
  authDomain:        'legend-4af26.firebaseapp.com',
  databaseURL:       'https://legend-4af26-default-rtdb.firebaseio.com',
  projectId:         'legend-4af26',
  storageBucket:     'legend-4af26.firebasestorage.app',
  messagingSenderId: '128882062099',
  appId:             '1:128882062099:web:3fd0f76f80fbea137620e6',
  measurementId:     'G-Q5X2MDBBH1',
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase] App initialized — projectId:', firebaseConfig.projectId);
} catch (e) {
  console.error('[Firebase] initializeApp FAILED');
  console.error('[Firebase] code:', e.code);
  console.error('[Firebase] message:', e.message);
  console.error(e);
  throw e; // re-throw so import fails clearly
}

try {
  auth = getAuth(app);
  console.log('[Firebase] Auth initialized');
} catch (e) {
  console.error('[Firebase] getAuth FAILED');
  console.error('[Firebase] code:', e.code);
  console.error('[Firebase] message:', e.message);
  console.error(e);
  throw e;
}

try {
  db = getFirestore(app);
  console.log('[Firebase] Firestore initialized');
} catch (e) {
  console.error('[Firebase] getFirestore FAILED');
  console.error('[Firebase] code:', e.code);
  console.error('[Firebase] message:', e.message);
  console.error(e);
  throw e;
}

export { auth, db };

// Analytics is optional (blocked in some privacy contexts)
isSupported().then(yes => { if (yes) getAnalytics(app); }).catch(() => {});
