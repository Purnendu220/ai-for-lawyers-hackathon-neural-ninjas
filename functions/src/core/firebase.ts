import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions';
import type { CallableOptions } from 'firebase-functions/https';
import { FUNCTIONS_REGION } from '@casepilot/shared';

// Imported first by index.ts so the app and global options exist before any function is defined.
initializeApp();
setGlobalOptions({ region: FUNCTIONS_REGION, maxInstances: 10 });

export const db = getFirestore();

export const callableOptions: CallableOptions = {
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};
