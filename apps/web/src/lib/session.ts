import { signOut as firebaseSignOut } from 'firebase/auth';
import { auth, wipeLocalData } from './firebase';
import { queryClient } from './query';

/** Signs out and removes every trace of case data from this device, then reloads. */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  queryClient.clear();
  try {
    await wipeLocalData();
  } finally {
    window.location.assign('/login');
  }
}
