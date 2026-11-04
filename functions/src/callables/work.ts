import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  can,
  paths,
  type CallableOutput,
  type EventDoc,
  type MemberDoc,
  type Role,
  type TaskDoc,
} from '@casepilot/shared';
import { audit } from '../core/audit';
import { requireAuth, requireCase, requireMember, type MemberContext } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { midnightIst, readHearings, refreshNextHearing } from '../core/hearings';
import { parseInput } from '../core/validate';

const TASK_ASSIGNEE_ROLES: readonly Role[] = ['owner', 'admin', 'lawyer', 'paralegal'];

async function requireAssignee(tx: Transaction, ctx: MemberContext, uid: string | null | undefined) {
  if (!uid) return;
  const member = (await tx.get(db.doc(paths.member(ctx.orgId, uid)))).data() as MemberDoc<Timestamp> | undefined;
  if (member?.status !== 'active' || !TASK_ASSIGNEE_ROLES.includes(member.role)) {
    throw new HttpsError(
      'invalid-argument',
      'Tasks can only be assigned to active owners, admins, lawyers and paralegals in this workspace.',
    );
  }
}

export const createTask = onCall(callableOptions, async (req): Promise<CallableOutput<'createTask'>> => {
  requireAuth(req);
  const input = parseInput(callables.createTask.input, req.data);
  const ctx = await requireMember(req, input.orgId, 'task.write');
  const ref = db.collection(paths.tasks(ctx.orgId, input.caseId)).doc();
  const { fields } = input;
  // Paralegals create tasks for themselves; assigning others is for lawyers and above.
  if (ctx.role === 'paralegal' && fields.assignedTo && fields.assignedTo !== ctx.uid) {
    throw new HttpsError('permission-denied', 'Paralegals can only assign tasks to themselves.');
  }

  await db.runTransaction(async (tx) => {
    const kase = await requireCase(tx, ctx, input.caseId, { writable: true });
    await requireAssignee(tx, ctx, fields.assignedTo);
    const now = FieldValue.serverTimestamp();
    tx.create(ref, {
      orgId: ctx.orgId,
      caseId: input.caseId,
      caseTitle: kase.data.title,
      title: fields.title,
      description: fields.description,
      status: 'open',
      priority: fields.priority,
      assignedTo: fields.assignedTo,
      dueDate: midnightIst(fields.dueDateOnly),
      dueDateOnly: fields.dueDateOnly,
      dueDateBasis: fields.dueDateOnly ? 'explicit' : 'none',
      condition: null,
      origin: 'manual',
      analysisId: null,
      analysisItemId: null,
      sourceRef: null,
      createdBy: ctx.uid,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    audit(tx, ctx, { action: 'task.created', entityType: 'task', entityId: ref.id, caseId: input.caseId });
  });
  return { taskId: ref.id };
});

export const updateTask = onCall(callableOptions, async (req): Promise<CallableOutput<'updateTask'>> => {
  requireAuth(req);
  const input = parseInput(callables.updateTask.input, req.data);
  const ctx = await requireMember(req, input.orgId, 'task.write');
  const ref = db.doc(paths.task(ctx.orgId, input.caseId, input.taskId));
  const { changes } = input;

  await db.runTransaction(async (tx) => {
    await requireCase(tx, ctx, input.caseId, { writable: true });
    const task = (await tx.get(ref)).data() as TaskDoc<Timestamp> | undefined;
    if (!task) throw new HttpsError('not-found', 'Task not found.');
    // Paralegals manage their own work (blueprint §6: "assigned/manage per policy").
    if (ctx.role === 'paralegal') {
      if (task.assignedTo !== ctx.uid) {
        throw new HttpsError('permission-denied', 'Paralegals can only update tasks assigned to them.');
      }
      if (changes.assignedTo !== undefined && changes.assignedTo !== ctx.uid) {
        throw new HttpsError('permission-denied', 'Paralegals cannot reassign tasks.');
      }
    }
    await requireAssignee(tx, ctx, changes.assignedTo);

    const update: Record<string, unknown> = { ...changes, updatedAt: FieldValue.serverTimestamp() };
    if (changes.dueDateOnly !== undefined) update.dueDate = midnightIst(changes.dueDateOnly);
    if (changes.status !== undefined && changes.status !== task.status) {
      update.completedAt = changes.status === 'completed' ? FieldValue.serverTimestamp() : null;
    }
    tx.update(ref, update);
    const completed = changes.status === 'completed' && task.status !== 'completed';
    audit(tx, ctx, {
      action: completed ? 'task.completed' : 'task.updated',
      entityType: 'task',
      entityId: input.taskId,
      caseId: input.caseId,
      metadata: { fields: Object.keys(changes), ...(changes.status ? { status: changes.status } : {}) },
    });
  });
  return { ok: true };
});

export const createEvent = onCall(callableOptions, async (req): Promise<CallableOutput<'createEvent'>> => {
  requireAuth(req);
  const input = parseInput(callables.createEvent.input, req.data);
  const ctx = await requireMember(req, input.orgId, 'event.write');
  const { fields } = input;
  // A date typed by someone allowed to verify dates counts as verified; anyone else's waits.
  const verified = fields.dateOnly !== null && can(ctx.role, 'event.verify', ctx.policy);
  const ref = db.collection(paths.events(ctx.orgId, input.caseId)).doc();

  await db.runTransaction(async (tx) => {
    const kase = await requireCase(tx, ctx, input.caseId, { writable: true });
    const hearings = await readHearings(tx, ctx.orgId, input.caseId);
    const now = Timestamp.now();
    const event: EventDoc<Timestamp> = {
      orgId: ctx.orgId,
      caseId: input.caseId,
      caseTitle: kase.data.title,
      type: fields.type,
      title: fields.title,
      eventDate: midnightIst(fields.dateOnly),
      eventDateOnly: fields.dateOnly,
      dateStatus: verified ? 'verified' : 'needs_review',
      dateText: null,
      origin: 'manual',
      analysisId: null,
      analysisItemId: null,
      sourceRef: null,
      createdBy: ctx.uid,
      createdAt: now,
      verifiedBy: verified ? ctx.uid : null,
      verifiedAt: verified ? now : null,
    };
    tx.create(ref, event);
    refreshNextHearing(tx, kase, hearings, new Map([[ref.id, event]]), ctx.uid);
    audit(tx, ctx, {
      action: 'event.created',
      entityType: 'event',
      entityId: ref.id,
      caseId: input.caseId,
      metadata: { type: fields.type, dateStatus: event.dateStatus },
    });
  });
  return { eventId: ref.id };
});

export const updateEvent = onCall(callableOptions, async (req): Promise<CallableOutput<'updateEvent'>> => {
  requireAuth(req);
  const input = parseInput(callables.updateEvent.input, req.data);
  const ctx = await requireMember(req, input.orgId, 'event.write');
  const ref = db.doc(paths.event(ctx.orgId, input.caseId, input.eventId));

  await db.runTransaction(async (tx) => {
    const kase = await requireCase(tx, ctx, input.caseId, { writable: true });
    const event = (await tx.get(ref)).data() as EventDoc<Timestamp> | undefined;
    if (!event) throw new HttpsError('not-found', 'Event not found.');
    const hearings = await readHearings(tx, ctx.orgId, input.caseId);
    tx.update(ref, input.changes);
    // Turning an event into a hearing, or a hearing into something else, can move the next hearing.
    refreshNextHearing(tx, kase, hearings, new Map([[input.eventId, { ...event, ...input.changes }]]), ctx.uid);
    audit(tx, ctx, {
      action: 'event.updated',
      entityType: 'event',
      entityId: input.eventId,
      caseId: input.caseId,
      metadata: { fields: Object.keys(input.changes) },
    });
  });
  return { ok: true };
});

export const verifyEvent = onCall(callableOptions, async (req): Promise<CallableOutput<'verifyEvent'>> => {
  requireAuth(req);
  const input = parseInput(callables.verifyEvent.input, req.data);
  const ctx = await requireMember(req, input.orgId, 'event.verify');
  const ref = db.doc(paths.event(ctx.orgId, input.caseId, input.eventId));

  await db.runTransaction(async (tx) => {
    const kase = await requireCase(tx, ctx, input.caseId, { writable: true });
    const event = (await tx.get(ref)).data() as EventDoc<Timestamp> | undefined;
    if (!event) throw new HttpsError('not-found', 'Event not found.');
    const hearings = await readHearings(tx, ctx.orgId, input.caseId);
    const now = Timestamp.now();
    const verified = {
      eventDate: midnightIst(input.dateOnly),
      eventDateOnly: input.dateOnly,
      dateStatus: 'verified' as const,
      verifiedBy: ctx.uid,
      verifiedAt: now,
    };
    tx.update(ref, verified);
    refreshNextHearing(tx, kase, hearings, new Map([[input.eventId, { ...event, ...verified }]]), ctx.uid);
    audit(tx, ctx, {
      action: 'event.verified',
      entityType: 'event',
      entityId: input.eventId,
      caseId: input.caseId,
      metadata: { type: event.type, corrected: event.eventDateOnly !== null && event.eventDateOnly !== input.dateOnly },
    });
  });
  return { ok: true };
});

/**
 * One case's audit trail for every member, newest first. The audit collection itself is limited to
 * owners and admins; entries carry only IDs, field names and codes (docs/ARCHITECTURE.md §5.8).
 */
export const listCaseActivity = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'listCaseActivity'>> => {
    requireAuth(req);
    const input = parseInput(callables.listCaseActivity.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'case.read');
    const logs = db.collection(paths.auditLogs(ctx.orgId));
    let query = logs.where('caseId', '==', input.caseId).orderBy('timestamp', 'desc').limit(input.limit + 1);
    if (input.after) {
      const cursor = await logs.doc(input.after).get();
      if (cursor.exists && cursor.get('caseId') === input.caseId) query = query.startAfter(cursor);
    }
    const docs = (await query.get()).docs;
    const page = docs.slice(0, input.limit);
    return {
      entries: page.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          action: data.action as string,
          actorUid: data.actorUid as string,
          entityType: data.entityType as string,
          entityId: data.entityId as string,
          at: (data.timestamp as Timestamp | null)?.toDate().toISOString() ?? null,
          metadata: (data.metadata as Record<string, unknown>) ?? {},
        };
      }),
      next: docs.length > input.limit ? (page.at(-1)?.id ?? null) : null,
    };
  },
);
