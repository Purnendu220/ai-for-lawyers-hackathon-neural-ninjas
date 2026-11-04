import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth, wipeLocalData } from './firebase';
import { queryClient } from './query';

/**
 * Signs out and removes every trace of case data from this device, then reloads on the sign-in
 * page. `next` is where to return after signing in again.
 */
export async function signOut(next?: string): Promise<void> {
  await firebaseSignOut(auth);
  queryClient.clear();
  try {
    await wipeLocalData();
  } finally {
    window.location.assign(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }
}
