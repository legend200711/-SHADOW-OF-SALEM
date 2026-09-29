/* ═══════════════════════════════════════════════════════════
   SHADOW OF SALEM — firebase.js
   Single Firebase initialisation point for the entire app.
   Import { auth, db } from this module; do not call
   initializeApp() anywhere else.
═══════════════════════════════════════════════════════════ */

import { initializeApp }             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth }                   from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore }              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAnalytics, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js';

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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Analytics is optional (blocked in some privacy contexts)
isSupported().then(yes => { if (yes) getAnalytics(app); }).catch(() => {});
