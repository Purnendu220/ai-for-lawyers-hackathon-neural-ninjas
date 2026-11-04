import { getRedirectResult, onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { auth } from '@/lib/firebase';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // Surfaces errors from the redirect sign-in used in the installed iOS app.
    getRedirectResult(auth).catch((error: unknown) => toast.error(errorMessage(error)));
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }));
  }, []);

  return <AuthContext value={state}>{children}</AuthContext>;
}
