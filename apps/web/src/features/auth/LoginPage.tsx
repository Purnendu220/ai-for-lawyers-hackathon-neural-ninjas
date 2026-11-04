import { zodResolver } from '@hookform/resolvers/zod';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { FileCheck2, Link2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { isTrustedDevice, setTrustedDevice } from '@/lib/device';
import { errorMessage } from '@/lib/errors';
import { auth } from '@/lib/firebase';
import { isIos, isStandalone } from '@/pwa/install';
import { useAuth } from './auth-context';

const SignInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

const SignUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100, 'Use at most 100 characters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

/** Only same-app paths, so ?next= cannot redirect to another site. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export default function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [trusted, setTrusted] = useState(isTrustedDevice);

  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={safeNext(params.get('next'))} replace />;

  /** A trusted device stays signed in and may cache case data; otherwise the session ends with the browser. */
  async function prepare() {
    setTrustedDevice(trusted);
    await setPersistence(auth, trusted ? browserLocalPersistence : browserSessionPersistence);
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <Logo className="text-white" />
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Less paperwork. Never miss a critical task.
          </h1>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <FileCheck2 className="mt-0.5 size-5 shrink-0 text-teal-300" aria-hidden />
              Upload a court order and get its directions, dates and suggested tasks.
            </li>
            <li className="flex gap-3">
              <Link2 className="mt-0.5 size-5 shrink-0 text-teal-300" aria-hidden />
              Every finding links back to the page it came from.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-teal-300" aria-hidden />
              Nothing enters your case until a lawyer approves it.
            </li>
          </ul>
        </div>
        <p className="text-xs opacity-70">For Indian advocates, law firms and corporate legal teams.</p>
      </section>

      <section className="flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-2 lg:hidden">
              <Logo />
            </div>
            <CardTitle className="text-xl">
              {mode === 'signin' ? 'Sign in' : 'Create your account'}
            </CardTitle>
            <CardDescription>
              {mode === 'signin'
                ? 'Welcome back to CasePilot AI.'
                : 'Set up CasePilot for yourself or your team.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <GoogleButton prepare={prepare} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or with email
              <span className="h-px flex-1 bg-border" />
            </div>
            {mode === 'signin' ? <SignInForm prepare={prepare} /> : <SignUpForm prepare={prepare} />}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={trusted}
                onChange={(event) => setTrusted(event.target.checked)}
              />
              <span>
                This is my own device
                <span className="block text-xs text-muted-foreground">
                  Stay signed in and keep case data available offline. Leave unticked on shared
                  computers.
                </span>
              </span>
            </label>
            <p className="text-center text-sm text-muted-foreground">
              {mode === 'signin' ? 'New to CasePilot?' : 'Already have an account?'}{' '}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type AuthFormProps = { prepare: () => Promise<void> };

function GoogleButton({ prepare }: AuthFormProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setError(null);
    try {
      await prepare();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Pop-ups are unreliable inside an installed iOS app, so it uses a redirect instead.
      if (isIos() && isStandalone()) await signInWithRedirect(auth, provider);
      else await signInWithPopup(auth, provider);
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={() => void signIn()} disabled={pending}>
        Continue with Google
      </Button>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function SignInForm({ prepare }: AuthFormProps) {
  const form = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    try {
      await prepare();
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      form.setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={!!errors.email} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
          aria-invalid={!!errors.password}
        />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      <FieldError>{errors.root?.message}</FieldError>
      <Button type="submit" disabled={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ prepare }: AuthFormProps) {
  const form = useForm({
    resolver: zodResolver(SignUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ name, email, password }) => {
    try {
      await prepare();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: name });
      // Accepting a team invitation requires a verified email (docs/ARCHITECTURE.md §5.1).
      await sendEmailVerification(user);
    } catch (e) {
      form.setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" {...form.register('name')} aria-invalid={!!errors.name} />
        <FieldError>{errors.name?.message}</FieldError>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register('email')} aria-invalid={!!errors.email} />
        <FieldError>{errors.email?.message}</FieldError>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
          aria-invalid={!!errors.password}
        />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      <FieldError>{errors.root?.message}</FieldError>
      <Button type="submit" disabled={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
