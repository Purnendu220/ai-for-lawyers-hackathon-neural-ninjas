import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Offers a reload when a new version is deployed. Never reloads on its own: a lawyer may be in
 * the middle of reviewing an analysis.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version of CasePilot is available.', {
      id: 'sw-update',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
