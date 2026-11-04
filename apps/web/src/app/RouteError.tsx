import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

export function RouteError({ notFound: forceNotFound = false }: { notFound?: boolean }) {
  const error = useRouteError();
  const notFound = forceNotFound || (isRouteErrorResponse(error) && error.status === 404);
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {notFound
          ? 'This page does not exist.'
          : 'This screen failed to load. If you just went offline, reconnect and try again.'}
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
        {!notFound && (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        )}
      </div>
    </div>
  );
}
