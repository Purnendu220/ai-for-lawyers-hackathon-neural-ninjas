import { httpsCallable } from 'firebase/functions';
import type { CallableInput, CallableName, CallableOutput } from '@casepilot/shared';
import { functions } from './firebase';

/** Typed callable. Every write in the app goes through one of these (docs/ARCHITECTURE.md §4.3). */
export async function call<N extends CallableName>(
  name: N,
  input: CallableInput<N>,
  options?: { timeout?: number },
): Promise<CallableOutput<N>> {
  const fn = httpsCallable<CallableInput<N>, CallableOutput<N>>(functions, name, options);
  const result = await fn(input);
  return result.data;
}
