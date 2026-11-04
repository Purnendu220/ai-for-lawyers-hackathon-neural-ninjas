import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Accept-invitation flow lands on Day 2 (acceptInvitation callable). */
export default function InvitePage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Workspace invitation</CardTitle>
          <CardDescription>
            Accepting invitations is planned for Day 2 (docs/IMPLEMENTATION_PLAN.md). Until then,
            sign in and create your own workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
