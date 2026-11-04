import { FirebaseError } from 'firebase/app';

const OFFLINE = "Can't reach CasePilot. Check your connection and try again.";

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/network-request-failed': OFFLINE,
  'functions/unavailable': OFFLINE,
  'functions/deadline-exceeded': 'CasePilot took too long to respond. Try again.',
  'permission-denied': "You don't have access to this.",
  unavailable: OFFLINE,
};

/** Server-side HttpsError messages are written for users, so these codes show them as-is. */
const USER_FACING_FUNCTION_CODES = new Set([
  'functions/invalid-argument',
  'functions/permission-denied',
  'functions/not-found',
  'functions/failed-precondition',
  'functions/resource-exhausted',
  'functions/unauthenticated',
]);

export function errorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    const known = MESSAGES[error.code];
    if (known) return known;
    if (USER_FACING_FUNCTION_CODES.has(error.code) && error.message) return error.message;
  }
  return 'Something went wrong. Try again.';
}
