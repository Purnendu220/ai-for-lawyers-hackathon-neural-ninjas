import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth';
import { Download, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LANGUAGE_LABELS, ROLE_LABELS, WORKSPACE_TYPE_LABELS } from '@casepilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/features/auth/auth-context';
import { useActiveOrg } from '@/features/org/org-context';
import { isTrustedDevice, setTrustedDevice } from '@/lib/device';
import { errorMessage } from '@/lib/errors';
import { auth, wipeLocalData } from '@/lib/firebase';
import { isStandalone, useInstallPrompt } from '@/pwa/install';

export default function SettingsPage() {
  const user = useUser();
  const { org, member } = useActiveOrg();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user.displayName || '—'}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {user.email ?? '—'}
              {user.email && (
                <Badge variant={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? 'Verified' : 'Not verified'}
                </Badge>
              )}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{org.name}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{WORKSPACE_TYPE_LABELS[org.workspaceType]}</dd>
            <dt className="text-muted-foreground">Your role</dt>
            <dd>{ROLE_LABELS[member.role]}</dd>
            <dt className="text-muted-foreground">Summaries in</dt>
            <dd>{LANGUAGE_LABELS[org.defaultLanguage]}</dd>
          </dl>
        </CardContent>
      </Card>

      <DeviceCard />
    </div>
  );
}

function DeviceCard() {
  const [trusted] = useState(isTrustedDevice);
  const [pending, setPending] = useState(false);
  const { canInstall, install, showIosHint } = useInstallPrompt();

  async function changeTrust(next: boolean) {
    setPending(true);
    try {
      setTrustedDevice(next);
      await setPersistence(auth, next ? browserLocalPersistence : browserSessionPersistence);
      if (!next) await wipeLocalData();
      // Firestore's cache mode is fixed at start-up, so reload to apply the change.
      window.location.reload();
    } catch (e) {
      toast.error(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MonitorSmartphone className="size-4" aria-hidden />
          This device
        </CardTitle>
        <CardDescription>
          {trusted
            ? 'Trusted: you stay signed in and recent case data is readable offline.'
            : 'Not trusted: case data is kept in memory only and the session ends when the browser closes.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Button variant="outline" disabled={pending} onClick={() => void changeTrust(!trusted)}>
            {trusted ? 'Stop trusting this device and clear saved data' : 'Trust this device'}
          </Button>
        </div>
        <div className="border-t pt-4 text-sm">
          {isStandalone() ? (
            <p className="text-muted-foreground">CasePilot is installed on this device.</p>
          ) : canInstall ? (
            <Button onClick={() => void install()}>
              <Download aria-hidden />
              Install CasePilot
            </Button>
          ) : showIosHint ? (
            <p className="text-muted-foreground">
              To install on iPhone or iPad, tap Share, then “Add to Home Screen”.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Use your browser's menu to install CasePilot, if your browser supports it.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
