import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Building2, Scale, User, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import {
  CreateOrganizationInput,
  LANGUAGE_LABELS,
  LANGUAGES,
  WORKSPACE_TYPE_LABELS,
  type WorkspaceType,
} from '@casepilot/shared';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useOrgs } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { errorMessage } from '@/lib/errors';
import { signOut } from '@/lib/session';
import { useOnline } from '@/pwa/online';

const WORKSPACE_OPTIONS: { value: WorkspaceType; icon: LucideIcon; description: string }[] = [
  {
    value: 'solo',
    icon: User,
    description: 'Just you. Cases, documents, hearings and follow-ups in one place.',
  },
  {
    value: 'law_firm',
    icon: Scale,
    description: 'Lawyers and paralegals share case files and assign work to each other.',
  },
  {
    value: 'corporate',
    icon: Building2,
    description: 'Disputes, employment and regulatory matters with internal owners and external counsel.',
  },
];

export default function OnboardingPage() {
  const { orgs } = useOrgs();
  const navigate = useNavigate();
  const online = useOnline();
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  const form = useForm<CreateOrganizationInput>({
    resolver: zodResolver(CreateOrganizationInput),
    defaultValues: { name: '', workspaceType: 'law_firm', defaultLanguage: 'en' },
  });
  const { errors } = form.formState;

  const create = useMutation({
    mutationFn: (input: CreateOrganizationInput) => call('createOrganization', input),
    onSuccess: ({ orgId }) => setCreatedOrgId(orgId),
  });

  // The new workspace arrives through the users/{uid} listener; open the dashboard once it has.
  useEffect(() => {
    if (createdOrgId && orgs.some((o) => o.id === createdOrgId)) {
      void navigate('/dashboard', { replace: true });
    }
  }, [createdOrgId, orgs, navigate]);

  const onSubmit = form.handleSubmit((input) => create.mutate(input));
  const busy = create.isPending || createdOrgId !== null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Logo />
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="text-xl">Set up your workspace</CardTitle>
          <CardDescription>
            Everything in CasePilot belongs to a workspace. You can invite your team later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="org-name">Workspace name</Label>
              <Input
                id="org-name"
                placeholder="e.g. Sharma & Associates"
                {...form.register('name')}
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Who is this workspace for?</legend>
              {WORKSPACE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-accent"
                >
                  <input
                    type="radio"
                    value={option.value}
                    className="mt-1 accent-primary"
                    {...form.register('workspaceType')}
                  />
                  <option.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium">
                      {WORKSPACE_TYPE_LABELS[option.value]}
                    </span>
                    <span className="block text-sm text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="grid gap-2">
              <Label htmlFor="language">Default summary language</Label>
              <Select id="language" {...form.register('defaultLanguage')}>
                {LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {LANGUAGE_LABELS[language]}
                  </option>
                ))}
              </Select>
            </div>

            {create.error && <FieldError>{errorMessage(create.error)}</FieldError>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {orgs.length > 0 ? (
                <Button type="button" variant="ghost" asChild>
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => void signOut()}>
                  Sign out
                </Button>
              )}
              <Button type="submit" disabled={busy || !online}>
                {busy ? 'Creating workspace…' : 'Create workspace'}
              </Button>
            </div>
            {!online && (
              <p className="text-sm text-muted-foreground">Connect to the internet to continue.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
