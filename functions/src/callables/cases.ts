import { FieldValue, type Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  CASE_ASSIGNEE_ROLES,
  paths,
  WORKSPACE_FEATURES,
  type CallableOutput,
  type CaseFields,
  type MemberDoc,
} from '@casepilot/shared';
import { audit } from '../core/audit';
import { requireAuth, requireCase, requireMember, type MemberContext } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { parseInput } from '../core/validate';
import { changedKeys, emptyToNull } from '../core/values';

function requireKnownMatterType(ctx: MemberContext, matterType: string): void {
  const allowed = WORKSPACE_FEATURES[ctx.workspaceType].matterTypes;
  if (matterType && !allowed.some((m) => m.value === matterType)) {
    throw new HttpsError('invalid-argument', 'Choose a matter type from the list.');
  }
}

/** Only active owners, admins and lawyers of this organization can be assigned to a case. */
async function requireAssignees(
  tx: Transaction,
  ctx: MemberContext,
  uids: string[],
): Promise<string[]> {
  const unique = [...new Set(uids)];
  if (unique.length === 0) return [];
  const snaps = await tx.getAll(...unique.map((uid) => db.doc(paths.member(ctx.orgId, uid))));
  for (const snap of snaps) {
    const member = snap.data() as MemberDoc<Timestamp> | undefined;
    if (!member || member.status !== 'active' || !CASE_ASSIGNEE_ROLES.includes(member.role)) {
      throw new HttpsError(
        'invalid-argument',
        'Cases can only be assigned to active owners, admins and lawyers in this workspace.',
      );
    }
  }
  return unique;
}

function caseValues(fields: CaseFields, assignees: string[]) {
  return {
    title: fields.title,
    caseNumber: emptyToNull(fields.caseNumber),
    courtName: emptyToNull(fields.courtName),
    matterType: emptyToNull(fields.matterType),
    caseType: emptyToNull(fields.caseType),
    clientName: emptyToNull(fields.clientName),
    opposingParty: emptyToNull(fields.opposingParty),
    assignedLawyerIds: assignees,
  };
}

export const createCase = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'createCase'>> => {
    requireAuth(req);
    const input = parseInput(callables.createCase.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'case.write');
    requireKnownMatterType(ctx, input.fields.matterType);
    const ref = db.collection(paths.cases(ctx.orgId)).doc();

    await db.runTransaction(async (tx) => {
      // The creator is assigned by default; every case.write role is assignable.
      const requested = input.fields.assignedLawyerIds.length
        ? input.fields.assignedLawyerIds
        : [ctx.uid];
      const assignees = await requireAssignees(tx, ctx, requested);
      const now = FieldValue.serverTimestamp();
      tx.create(ref, {
        ...caseValues(input.fields, assignees),
        jurisdiction: 'India',
        status: 'active',
        nextHearingDate: null,
        nextHearingDateOnly: null,
        createdAt: now,
        createdBy: ctx.uid,
        updatedAt: now,
        updatedBy: ctx.uid,
        archivedAt: null,
      });
      audit(tx, ctx, { action: 'case.created', entityType: 'case', entityId: ref.id, caseId: ref.id });
    });

    return { caseId: ref.id };
  },
);

export const updateCase = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'updateCase'>> => {
    requireAuth(req);
    const input = parseInput(callables.updateCase.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'case.write');
    requireKnownMatterType(ctx, input.fields.matterType);

    await db.runTransaction(async (tx) => {
      const kase = await requireCase(tx, ctx, input.caseId, { writable: true });
      const assignees = await requireAssignees(tx, ctx, input.fields.assignedLawyerIds);
      const next = { ...caseValues(input.fields, assignees), status: input.status };
      const fields = changedKeys(next, kase.data);
      if (fields.length === 0) return;
      tx.update(kase.ref, { ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });
      audit(tx, ctx, {
        action: 'case.updated',
        entityType: 'case',
        entityId: kase.id,
        caseId: kase.id,
        metadata: { fields },
      });
    });

    return { ok: true };
  },
);

export const archiveCase = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'archiveCase'>> => {
    requireAuth(req);
    const input = parseInput(callables.archiveCase.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'case.write');

    await db.runTransaction(async (tx) => {
      const kase = await requireCase(tx, ctx, input.caseId);
      if (input.archived === (kase.data.status === 'archived')) return;
      const now = FieldValue.serverTimestamp();
      tx.update(kase.ref, {
        status: input.archived ? 'archived' : 'active',
        archivedAt: input.archived ? now : null,
        updatedAt: now,
        updatedBy: ctx.uid,
      });
      audit(tx, ctx, {
        action: input.archived ? 'case.archived' : 'case.restored',
        entityType: 'case',
        entityId: kase.id,
        caseId: kase.id,
      });
    });

    return { ok: true };
  },
);
