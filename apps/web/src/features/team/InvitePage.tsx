import { useMutation } from '@tanstack/react-query';
import { sendEmailVerification, type User } from 'firebase/auth';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { signOut } from '@/lib/session';
import { useOnline } from '@/pwa/online';

export default function InvitePage() {
  const { orgId = '', inviteId = '' } = useParams();
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join a CasePilot workspace</CardTitle>
          <CardDescription>
            Someone invited you to work with them on CasePilot AI. Use the email address the
            invitation was sent to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <AcceptInvitation user={user} orgId={orgId} inviteId={inviteId} returnTo={location.pathname} />
          ) : (
            <Button asChild className="w-full">
              <Link to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in or create an account</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AcceptInvitation({
  user,
  orgId,
  inviteId,
  returnTo,
}: {
  user: User;
  orgId: string;
  inviteId: string;
  returnTo: string;
}) {
  const navigate = useNavigate();
  const online = useOnline();
  const [verified, setVerified] = useState(user.emailVerified);

  const accept = useMutation({
    mutationFn: () => call('acceptInvitation', { orgId, inviteId }),
    onSuccess: ({ orgName }) => {
      toast.success(`You've joined ${orgName}.`);
      void navigate('/dashboard', { replace: true });
    },
  });
  const resend = useMutation({
    mutationFn: () => sendEmailVerification(user),
    onSuccess: () => toast.success(`Verification email sent to ${user.email}.`),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const recheck = useMutation({
    mutationFn: async () => {
      await user.reload();
      // A fresh ID token carries the new email_verified claim to the server.
      await user.getIdToken(true);
      return user.emailVerified;
    },
    onSuccess: (isVerified) => {
      setVerified(isVerified);
      if (!isVerified) toast.info('Not verified yet. Open the link in the email, then try again.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        Signed in as <span className="font-medium">{user.email}</span>.
      </p>

      {!verified ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted p-3">
          <p>Verify your email address before joining. We sent a link when you created your account.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={recheck.isPending} onClick={() => recheck.mutate()}>
              I've verified my email
            </Button>
            <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate()}>
              Send the email again
            </Button>
          </div>
        </div>
      ) : (
        <Button disabled={accept.isPending || !online} onClick={() => accept.mutate()}>
          {accept.isPending ? 'Joining…' : 'Accept invitation'}
        </Button>
      )}

      {accept.error && <FieldError>{errorMessage(accept.error)}</FieldError>}

      <button
        type="button"
        className="text-left text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => void signOut(returnTo)}
      >
        Use a different account
      </button>
    </div>
  );
}
