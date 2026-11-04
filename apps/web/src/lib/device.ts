const TRUSTED_DEVICE_KEY = 'casepilot.trustedDevice';

/**
 * A trusted device keeps case data in IndexedDB for offline reading and stays signed in.
 * Default is untrusted: memory-only cache and a session that ends when the browser closes.
 */
export function isTrustedDevice(): boolean {
  try {
    return localStorage.getItem(TRUSTED_DEVICE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTrustedDevice(trusted: boolean): void {
  try {
    localStorage.setItem(TRUSTED_DEVICE_KEY, String(trusted));
  } catch {
    // Storage unavailable (private mode): the device simply stays untrusted.
  }
}
