import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { can, CASE_ASSIGNEE_ROLES } from '@casepilot/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useActiveOrg } from '@/features/org/org-context';
import { call } from '@/lib/callables';
import { CaseForm } from './CaseForm';

export default function NewCasePage() {
  const { id: orgId, org, member } = useActiveOrg();
  const navigate = useNavigate();

  if (!can(member.role, 'case.write', org.policy)) {
    return (
      <Card className="mx-auto w-full max-w-3xl">
        <CardHeader>
          <CardTitle>New case</CardTitle>
          <CardDescription>Your role can view cases but not create them.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New case</h1>
      <Card>
        <CardContent>
          <CaseForm
            mode="create"
            submitLabel="Create case"
            defaultValues={{
              title: '',
              caseNumber: '',
              courtName: '',
              matterType: '',
              caseType: '',
              clientName: '',
              opposingParty: '',
              assignedLawyerIds: CASE_ASSIGNEE_ROLES.includes(member.role) ? [member.id] : [],
              status: 'active',
            }}
            onSubmit={async ({ status: _status, ...fields }) => {
              const { caseId } = await call('createCase', { orgId, fields });
              toast.success('Case created.');
              void navigate(`/cases/${caseId}/overview`);
            }}
            onCancel={() => void navigate('/cases')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
