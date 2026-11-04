import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/https';
import {
  assignableRoles,
  callables,
  INVITATION_TTL_DAYS,
  paths,
  ROLE_LABELS,
  WORKSPACE_FEATURES,
  type CallableOutput,
  type InvitationDoc,
  type MemberDoc,
  type OrganizationDoc,
  type UserDoc,
} from '@casepilot/shared';
import { audit } from '../core/audit';
import { requireAuth, requireMember } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { profileWithMembership } from '../core/profile';
import { parseInput } from '../core/validate';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Invitations are shared as links; nothing is emailed in the MVP. A link only works for a signed-in
 * user whose verified email matches the invitation.
 */
export const inviteMember = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'inviteMember'>> => {
    requireAuth(req);
    const input = parseInput(callables.inviteMember.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'member.manage');
    if (!WORKSPACE_FEATURES[ctx.workspaceType].teamInvites) {
      throw new HttpsError(
        'failed-precondition',
        'A solo workspace has one member. Create a law firm or corporate workspace to work with a team.',
      );
    }
    if (!assignableRoles(ctx.role, null).includes(input.role)) {
      throw new HttpsError(
        'permission-denied',
        `Your role cannot invite someone as ${ROLE_LABELS[input.role]}.`,
      );
    }
    const email = input.email.toLowerCase();

    const [members, pending] = await Promise.all([
      db.collection(paths.members(ctx.orgId)).where('email', '==', email).limit(1).get(),
      db
        .collection(paths.invitations(ctx.orgId))
        .where('email', '==', email)
        .where('status', '==', 'pending')
        .get(),
    ]);
    if (!members.empty) {
      throw new HttpsError('already-exists', 'This person is already a member of the workspace.');
    }
    const live = pending.docs.find(
      (doc) => (doc.data() as InvitationDoc<Timestamp>).expiresAt.toMillis() > Date.now(),
    );
    if (live) return { inviteId: live.id, existing: true };

    const ref = db.collection(paths.invitations(ctx.orgId)).doc();
    const batch = db.batch();
    batch.create(ref, {
      email,
      role: input.role,
      status: 'pending',
      invitedBy: ctx.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITATION_TTL_DAYS * DAY_MS),
      acceptedBy: null,
      acceptedAt: null,
    });
    audit(batch, ctx, {
      action: 'member.invited',
      entityType: 'invitation',
      entityId: ref.id,
      metadata: { role: input.role },
    });
    await batch.commit();
    return { inviteId: ref.id, existing: false };
  },
);

export const revokeInvitation = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'revokeInvitation'>> => {
    requireAuth(req);
    const input = parseInput(callables.revokeInvitation.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'member.manage');
    const ref = db.doc(paths.invitation(ctx.orgId, input.inviteId));

    await db.runTransaction(async (tx) => {
      const invitation = (await tx.get(ref)).data() as InvitationDoc<Timestamp> | undefined;
      if (!invitation) throw new HttpsError('not-found', 'Invitation not found.');
      if (invitation.status !== 'pending') return;
      tx.update(ref, { status: 'revoked' });
      audit(tx, ctx, { action: 'invitation.revoked', entityType: 'invitation', entityId: ref.id });
    });
    return { ok: true };
  },
);

export const acceptInvitation = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'acceptInvitation'>> => {
    const user = requireAuth(req);
    const input = parseInput(callables.acceptInvitation.input, req.data);
    if (!user.email) {
      throw new HttpsError('failed-precondition', 'Your account has no email address.');
    }
    if (!user.emailVerified) {
      throw new HttpsError(
        'failed-precondition',
        'Verify your email address first, using the link we sent when you signed up.',
      );
    }

    const inviteRef = db.doc(paths.invitation(input.orgId, input.inviteId));
    const orgRef = db.doc(paths.org(input.orgId));
    const memberRef = db.doc(paths.member(input.orgId, user.uid));
    const userRef = db.doc(paths.user(user.uid));

    return db.runTransaction(async (tx) => {
      const [inviteSnap, orgSnap, memberSnap, userSnap] = await tx.getAll(
        inviteRef,
        orgRef,
        memberRef,
        userRef,
      );
      const invitation = inviteSnap?.data() as InvitationDoc<Timestamp> | undefined;
      const org = orgSnap?.data() as OrganizationDoc<Timestamp> | undefined;
      if (!invitation || !org) throw new HttpsError('not-found', 'This invitation does not exist.');
      if (invitation.email !== user.email) {
        throw new HttpsError(
          'permission-denied',
          'This invitation was sent to a different email address. Sign in with that address to accept it.',
        );
      }
      const result = { orgId: input.orgId, orgName: org.name };
      if (invitation.status === 'accepted' && invitation.acceptedBy === user.uid) return result;
      if (invitation.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'This invitation is no longer valid.');
      }
      if (invitation.expiresAt.toMillis() < Date.now()) {
        throw new HttpsError('failed-precondition', 'This invitation has expired. Ask for a new link.');
      }

      const member = memberSnap?.data() as MemberDoc<Timestamp> | undefined;
      if (member?.status === 'suspended') {
        throw new HttpsError('permission-denied', 'Your access to this workspace is suspended.');
      }
      const role = member?.role ?? invitation.role;
      const profile = profileWithMembership(
        user,
        userSnap?.data() as UserDoc<Timestamp> | undefined,
        input.orgId,
        { orgName: org.name, role },
        org.defaultLanguage,
      );

      if (!member) {
        tx.create(memberRef, {
          role,
          status: 'active',
          displayName: profile.displayName,
          email: user.email,
          joinedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.set(userRef, profile, { merge: true });
      tx.update(inviteRef, {
        status: 'accepted',
        acceptedBy: user.uid,
        acceptedAt: FieldValue.serverTimestamp(),
      });
      audit(tx, { uid: user.uid, orgId: input.orgId }, {
        action: 'member.joined',
        entityType: 'member',
        entityId: user.uid,
        metadata: { role, inviteId: input.inviteId },
      });
      return result;
    });
  },
);

export const updateMember = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'updateMember'>> => {
    requireAuth(req);
    const input = parseInput(callables.updateMember.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'member.manage');
    if (input.uid === ctx.uid) {
      throw new HttpsError('failed-precondition', "You can't change your own role or access.");
    }
    const memberRef = db.doc(paths.member(ctx.orgId, input.uid));
    const userRef = db.doc(paths.user(input.uid));

    await db.runTransaction(async (tx) => {
      const member = (await tx.get(memberRef)).data() as MemberDoc<Timestamp> | undefined;
      if (!member) throw new HttpsError('not-found', 'Member not found.');
      const allowed = assignableRoles(ctx.role, member.role);
      if (allowed.length === 0 || (input.role && !allowed.includes(input.role))) {
        throw new HttpsError('permission-denied', 'Your role cannot make this change.');
      }
      const role = input.role ?? member.role;
      const status = input.status ?? member.status;
      if (role === member.role && status === member.status) return;

      tx.update(memberRef, { role, status });
      // Keep the user's workspace list in step: suspended members lose the workspace from it.
      tx.set(
        userRef,
        {
          memberships: {
            [ctx.orgId]: status === 'active' ? { orgName: ctx.orgName, role } : FieldValue.delete(),
          },
        },
        { merge: true },
      );
      audit(tx, ctx, {
        action: 'member.updated',
        entityType: 'member',
        entityId: input.uid,
        metadata: { role, status },
      });
    });
    return { ok: true };
  },
);
