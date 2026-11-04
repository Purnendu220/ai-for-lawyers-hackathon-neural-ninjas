import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { FUNCTIONS_REGION } from '@casepilot/shared';
import { isTrustedDevice } from './device';

const env = import.meta.env;
const EMULATOR_HOST = '127.0.0.1';
// Must match "emulators" in firebase.json. Firestore uses 8180 because 8080 is often blocked on Windows.
const EMULATOR_PORTS = { auth: 9099, functions: 5001, firestore: 8180, storage: 9199 };

export const usingEmulators = env.VITE_USE_EMULATORS === 'true';

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

if (!usingEmulators && env.VITE_APPCHECK_SITE_KEY) {
  if (import.meta.env.DEV) {
    // Prints a debug token in the console; register it under App Check → Manage debug tokens.
    (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);
export const storage = getStorage(app);

if (usingEmulators) {
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);
  connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
}

let firestore: Firestore | null = null;

/** Firestore is created on first use, after sign-in, so the per-device offline choice applies. */
export function db(): Firestore {
  if (!firestore) {
    firestore = initializeFirestore(app, {
      localCache: isTrustedDevice()
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
    if (usingEmulators)
      connectFirestoreEmulator(firestore, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  }
  return firestore;
}

/** Deletes any case data cached on this device. Reload the page afterwards. */
export async function wipeLocalData(): Promise<void> {
  const instance = firestore ?? initializeFirestore(app, { localCache: memoryLocalCache() });
  firestore = null;
  await terminate(instance);
  await clearIndexedDbPersistence(instance);
}
