/**
 * MerkadoGo Web — Live Firestore Stall Sync
 *
 * Subscribes to the public-read /stalls collection and forwards every change
 * to a handler that recolors the SVG map (Master Context §4.1). The web app is
 * strictly read-only — all writes happen in the Android admin app.
 *
 * Firebase is dynamically imported so the initial static-JSON paint never
 * waits on the SDK bundle; if the network or Firebase is unreachable the app
 * keeps running on the static fallback with a console warning.
 */

import { normalizeStallDoc } from './stallNormalizer.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/**
 * @returns {boolean} True when the required VITE_FIREBASE_* variables are present.
 */
export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

/**
 * Subscribes to live /stalls changes.
 * @param {function(string, Object): void} onStallUpdate - Called per document change: (changeType, normalizedStall).
 * @param {function(Error): void} [onError] - Called when Firebase init or the snapshot stream fails.
 * @returns {Promise<function(): void>} Unsubscribe function for the listener.
 */
export async function initLiveStallSync(onStallUpdate, onError) {
  if (!isFirebaseConfigured()) {
    const err = new Error('Firebase configuration missing — set VITE_FIREBASE_* variables in .env');
    console.warn('[MerkadoGo Sync] Live sync disabled:', err.message);
    onError?.(err);
    return async () => {};
  }

  try {
    // Dynamic imports: the ~300kb Firestore SDK is code-split away from the
    // critical path and only fetched after the static map is already painted.
    const [{ initializeApp, getApps }, firestore] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore')
    ]);

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    const db = firestore.getFirestore(app);
    const stallsRef = firestore.collection(db, 'stalls');

    console.log(`[MerkadoGo Sync] Subscribing to live /stalls stream (project "${firebaseConfig.projectId}")...`);

    let firstSnapshot = true;
    return firestore.onSnapshot(stallsRef, (snapshot) => {
      if (firstSnapshot) {
        console.log(`[MerkadoGo Sync] Live snapshot connected — ${snapshot.size} stall document(s) in /stalls.`);
        firstSnapshot = false;
      }
      snapshot.docChanges().forEach((change) => {
        const stall = normalizeStallDoc(change.doc.id, change.doc.data());
        if (!stall) {
          console.warn(`[MerkadoGo Sync] Document "${change.doc.id}" is missing name/stallId — skipped`);
          return;
        }
        onStallUpdate(change.type, stall);
      });
    }, (error) => {
      console.warn('[MerkadoGo Sync] Firestore stream error — running on static fallback:', error);
      onError?.(error);
    });
  } catch (err) {
    console.warn('[MerkadoGo Sync] Firebase initialization failed — running on static fallback:', err);
    onError?.(err);
    return async () => {};
  }
}
