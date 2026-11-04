import type { User } from 'firebase/auth';
import { createContext, useContext } from 'react';

export type AuthState = { user: User | null; loading: boolean };

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** For screens behind RequireAuth, where a signed-in user is guaranteed. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
