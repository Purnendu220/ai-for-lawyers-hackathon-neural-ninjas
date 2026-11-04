import { useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// The event can fire before React mounts, so it is captured at module load (imported by main.tsx).
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  notify();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => deferredPrompt !== null,
    () => false,
  );

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
  }

  // iOS Safari has no install event; the app shows Share → Add to Home Screen steps instead.
  const showIosHint = !canInstall && isIos() && !isStandalone();

  return { canInstall, install, showIosHint };
}
