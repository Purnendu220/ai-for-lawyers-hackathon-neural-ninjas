import { toast } from 'sonner';

export function invitationLink(orgId: string, inviteId: string): string {
  return `${window.location.origin}/invite/${orgId}/${inviteId}`;
}

export function copyLink(link: string): void {
  navigator.clipboard.writeText(link).then(
    () => toast.success('Link copied.'),
    () => toast.error("Couldn't copy. Select the link and copy it manually."),
  );
}
