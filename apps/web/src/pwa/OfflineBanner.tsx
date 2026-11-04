import { WifiOff } from 'lucide-react';
import { useOnline } from './online';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-2 text-sm text-warning"
    >
      <WifiOff className="size-4" aria-hidden />
      You're offline. You can read saved data; changes are disabled until you reconnect.
    </div>
  );
}
