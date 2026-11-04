import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  CASE_STATUS_LABELS,
  CaseFormValues,
  EDITABLE_CASE_STATUSES,
  ROLE_LABELS,
  WORKSPACE_FEATURES,
} from '@casepilot/shared';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { FieldError, Label } from '@/components/ui/label';
import { useActiveOrg } from '@/features/org/org-context';
import { memberName, useMembers } from '@/features/team/useMembers';
import { errorMessage } from '@/lib/errors';
import { useOnline } from '@/pwa/online';

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

type CaseFormProps = {
  mode: 'create' | 'edit';
  defaultValues: CaseFormValues;
  submitLabel: string;
  onSubmit: (values: CaseFormValues) => Promise<unknown>;
  onCancel: () => void;
};

export function CaseForm({ mode, defaultValues, submitLabel, onSubmit, onCancel }: CaseFormProps) {
  const { org } = useActiveOrg();
  const features = WORKSPACE_FEATURES[org.workspaceType];
  const { assignable, byId } = useMembers();
  const online = useOnline();
  const form = useForm<CaseFormValues>({ resolver: zodResolver(CaseFormValues), defaultValues });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  });

  const matterTypes = features.matterTypes.some((m) => m.value === defaultValues.matterType)
    ? features.matterTypes
    : [...features.matterTypes, { value: defaultValues.matterType, label: defaultValues.matterType }];

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="title" label="Case title" error={errors.title?.message}>
        <Input
          id="title"
          placeholder="e.g. ABC Traders v. XYZ Supplies"
          aria-invalid={!!errors.title}
          {...form.register('title')}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="caseNumber" label="Case number" error={errors.caseNumber?.message}>
          <Input id="caseNumber" placeholder="e.g. CS(COMM) 123/2026" {...form.register('caseNumber')} />
        </Field>
        <Field id="courtName" label="Court" error={errors.courtName?.message}>
          <Input id="courtName" placeholder="e.g. Delhi High Court" {...form.register('courtName')} />
        </Field>
        <Field id="matterType" label="Matter type" error={errors.matterType?.message}>
          <Select id="matterType" {...form.register('matterType')}>
            <option value="">Not specified</option>
            {matterTypes
              .filter((m) => m.value)
              .map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field id="caseType" label="Case type" error={errors.caseType?.message}>
          <Input id="caseType" placeholder="e.g. Commercial suit" {...form.register('caseType')} />
        </Field>
        <Field id="clientName" label="Client" error={errors.clientName?.message}>
          <Input id="clientName" {...form.register('clientName')} />
        </Field>
        <Field id="opposingParty" label="Opposing party" error={errors.opposingParty?.message}>
          <Input id="opposingParty" {...form.register('opposingParty')} />
        </Field>
        {mode === 'edit' && (
          <Field id="status" label="Status" error={errors.status?.message}>
            <Select id="status" {...form.register('status')}>
              {EDITABLE_CASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CASE_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      {features.taskAssignment && (
        <Controller
          control={form.control}
          name="assignedLawyerIds"
          render={({ field }) => {
            const ids = [...new Set([...assignable.map((m) => m.id), ...field.value])];
            const toggle = (uid: string, checked: boolean) =>
              field.onChange(checked ? [...field.value, uid] : field.value.filter((id) => id !== uid));
            return (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Assigned team</legend>
                {ids.length === 0 && (
                  <p className="text-sm text-muted-foreground">No owners, admins or lawyers to assign yet.</p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {ids.map((uid) => {
                    const member = byId.get(uid);
                    return (
                      <label key={uid} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={field.value.includes(uid)}
                          onChange={(event) => toggle(uid, event.target.checked)}
                        />
                        <span className="truncate">{memberName(member)}</span>
                        {member && (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <FieldError>{errors.assignedLawyerIds?.message}</FieldError>
              </fieldset>
            );
          }}
        />
      )}

      <FieldError>{errors.root?.message}</FieldError>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !online}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
      {!online && <p className="text-sm text-muted-foreground">Connect to the internet to save.</p>}
    </form>
  );
}
