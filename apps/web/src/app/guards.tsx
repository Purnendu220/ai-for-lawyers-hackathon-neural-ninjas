import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';
import { useOrgs } from '@/features/org/org-context';
import { OrgProvider } from '@/features/org/OrgProvider';
import { signOut } from '@/lib/session';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return (
    <OrgProvider key={user.uid}>
      <Outlet />
    </OrgProvider>
  );
}

export function RequireOrg() {
  const { loading, error, orgs, active } = useOrgs();

  if (loading) return <FullPageSpinner label="Loading workspace" />;
  if (error) return <NoAccess message="We couldn't load your workspaces. Check your connection." />;
  if (orgs.length === 0) return <Navigate to="/onboarding" replace />;
  if (!active) return <NoAccess message="You no longer have access to this workspace." />;
  return <Outlet />;
}

function NoAccess({ message }: { message: string }) {
  const { orgs, active, switchOrg } = useOrgs();
  const others = orgs.filter((o) => o.id !== active?.id);
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {others.map((o) => (
            <Button key={o.id} variant="outline" onClick={() => void switchOrg(o.id)}>
              Open {o.name}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
