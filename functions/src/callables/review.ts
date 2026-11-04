import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  dateOnlyToInstant,
  paths,
  reviewItemKind,
  todayDateOnly,
  type AnalysisDoc,
  type CallableOutput,
  type EventDoc,
  type EventType,
  type ExtractedDate,
  type MemberDoc,
  type ReviewEdits,
  type Role,
} from '@casepilot/shared';
import { audit } from '../core/audit';
import { requireAuth, requireCase, requireMember } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { parseInput } from '../core/validate';

/** Roles that can own a task. Viewers can't be assigned work. */
const TASK_ASSIGNEE_ROLES: readonly Role[] = ['owner', 'admin', 'lawyer', 'paralegal'];

const EVENT_TYPE: Record<ExtractedDate['dateType'], EventType> = {
  hearing: 'hearing',
  filing_deadline: 'deadline',
  compliance_deadline: 'deadline',
  order_date: 'note',
  past_event: 'note',
  other: 'note',
};

const EVENT_TITLE: Record<ExtractedDate['dateType'], string> = {
  hearing: 'Hearing',
  filing_deadline: 'Filing deadline',
  compliance_deadline: 'Compliance deadline',
  order_date: 'Order date',
  past_event: 'Past event',
  other: 'Date from order',
};

const DECIDED = { approve: 'approved', edit: 'edited', reject: 'rejected' } as const;

/** Same analysis item, same ID: replaying an approval can never create a second task or event. */
function entityId(prefix: 't' | 'e', analysisId: string, itemId: string): string {
  return `${prefix}_${createHash('sha256').update(`${analysisId}:${itemId}`).digest('hex').slice(0, 24)}`;
}

/** Firestore rejects undefined values, so absent fields are dropped. */
function cleanEdits(edits: ReviewEdits | undefined): ReviewEdits | null {
  if (!edits) return null;
  const entries = Object.entries(edits).filter(([, value]) => value !== undefined);
  return entries.length ? (Object.fromEntries(entries) as ReviewEdits) : null;
}

const midnightIst = (day: string | null) => (day ? Timestamp.fromDate(dateOnlyToInstant(day)) : null);

/**
 * Applies a reviewer's decisions to an analysis in one transaction (docs/ARCHITECTURE.md §5.6).
 * Approved or edited tasks and dates become tasks and timeline events; facts and directions keep
 * their decision on the analysis. Items already decided are skipped, so a repeated call is safe.
 */
export const reviewAnalysis = onCall(
  { ...callableOptions, timeoutSeconds: 120 },
  async (req): Promise<CallableOutput<'reviewAnalysis'>> => {
    requireAuth(req);
    const input = parseInput(callables.reviewAnalysis.input, req.data);
    const ctx = await requireMember(req, input.orgId, 'ai.review');
    const { caseId, analysisId } = input;
    const analysisRef = db.doc(paths.analysis(ctx.orgId, caseId, analysisId));
    const today = todayDateOnly();

    return db.runTransaction(async (tx) => {
      // Every read happens before the first write, as transactions require.
      const kase = await requireCase(tx, ctx, caseId, { writable: true });
      const analysis = (await tx.get(analysisRef)).data() as AnalysisDoc<Timestamp> | undefined;
      if (!analysis) throw new HttpsError('not-found', 'Analysis not found.');
      if (analysis.status === 'superseded') {
        throw new HttpsError(
          'failed-precondition',
          'A newer analysis of this document replaced this one. Review that one instead.',
        );
      }

      const assigneeIds = [
        ...new Set(input.decisions.map((d) => d.edits?.assignedTo).filter((uid): uid is string => !!uid)),
      ];
      const assignees = assigneeIds.length
        ? await tx.getAll(...assigneeIds.map((uid) => db.doc(paths.member(ctx.orgId, uid))))
        : [];
      for (const snap of assignees) {
        const member = snap.data() as MemberDoc<Timestamp> | undefined;
        if (member?.status !== 'active' || !TASK_ASSIGNEE_ROLES.includes(member.role)) {
          throw new HttpsError(
            'invalid-argument',
            'Tasks can only be assigned to active owners, admins, lawyers and paralegals in this workspace.',
          );
        }
      }
      const hearings = await tx.get(
        db.collection(paths.events(ctx.orgId, caseId)).where('type', '==', 'hearing'),
      );

      const lists = {
        fact: [...analysis.facts],
        direction: [...analysis.directions],
        date: [...analysis.dates],
        task: [...analysis.proposedTasks],
      };
      // serverTimestamp() is not allowed inside arrays, so decisions carry the transaction's clock.
      const now = Timestamp.now();
      const taskIds: string[] = [];
      const eventIds: string[] = [];
      const verifiedHearings: string[] = [];
      let applied = 0;
      let skipped = 0;

      for (const decision of input.decisions) {
        const kind = reviewItemKind(decision.itemId);
        const list = kind ? lists[kind] : [];
        const index = list.findIndex((item) => item.itemId === decision.itemId);
        const item = list[index];
        if (!kind || !item) {
          throw new HttpsError('invalid-argument', `Item ${decision.itemId} is not in this analysis.`);
        }
        if (item.decision !== 'pending') {
          skipped++;
          continue;
        }
        if (decision.action === 'edit' && !decision.edits) {
          throw new HttpsError('invalid-argument', 'An edit needs the changed values.');
        }
        const edits = decision.action === 'reject' ? null : cleanEdits(decision.edits);
        let resultEntityId: string | null = null;

        if (decision.action !== 'reject' && kind === 'task') {
          const task = lists.task[index]!;
          const dueDateOnly = edits?.date !== undefined ? edits.date : task.suggestedDueDate;
          resultEntityId = entityId('t', analysisId, task.itemId);
          tx.create(db.doc(paths.task(ctx.orgId, caseId, resultEntityId)), {
            orgId: ctx.orgId,
            caseId,
            caseTitle: kase.data.title,
            title: edits?.title ?? task.title,
            description: edits?.description ?? task.description,
            status: 'open',
            priority: edits?.priority ?? task.priority,
            assignedTo: edits?.assignedTo ?? null,
            dueDate: midnightIst(dueDateOnly),
            dueDateOnly,
            dueDateBasis: task.dueDateBasis,
            condition: task.condition,
            origin: 'ai',
            analysisId,
            analysisItemId: task.itemId,
            sourceRef: task.sourceRef,
            createdBy: ctx.uid,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          });
          taskIds.push(resultEntityId);
        }

        if (decision.action !== 'reject' && kind === 'date') {
          const date = lists.date[index]!;
          const eventDateOnly = edits?.date !== undefined ? edits.date : date.normalizedDate;
          // A concrete date that a lawyer approved is verified; without one it waits for review.
          const verified = eventDateOnly !== null;
          const type = EVENT_TYPE[date.dateType];
          const event: Omit<EventDoc<Timestamp>, 'createdAt'> & { createdAt: Timestamp } = {
            orgId: ctx.orgId,
            caseId,
            caseTitle: kase.data.title,
            type,
            title: edits?.text ?? EVENT_TITLE[date.dateType],
            eventDate: midnightIst(eventDateOnly),
            eventDateOnly,
            dateStatus: verified ? 'verified' : 'needs_review',
            dateText: date.dateText,
            origin: 'ai',
            analysisId,
            analysisItemId: date.itemId,
            sourceRef: date.sourceRef,
            createdBy: ctx.uid,
            createdAt: now,
            verifiedBy: verified ? ctx.uid : null,
            verifiedAt: verified ? now : null,
          };
          resultEntityId = entityId('e', analysisId, date.itemId);
          tx.create(db.doc(paths.event(ctx.orgId, caseId, resultEntityId)), event);
          eventIds.push(resultEntityId);
          if (verified && type === 'hearing') verifiedHearings.push(eventDateOnly);
        }

        list[index] = {
          ...item,
          decision: DECIDED[decision.action],
          decidedBy: ctx.uid,
          decidedAt: now,
          edits,
          resultEntityId,
        } as (typeof list)[number];
        audit(tx, ctx, {
          action: `analysis.item.${DECIDED[decision.action]}`,
          entityType: 'analysis',
          entityId: analysisId,
          caseId,
          metadata: { itemId: item.itemId, kind, resultEntityId },
        });
        applied++;
      }

      if (applied > 0) {
        const pending = [...lists.fact, ...lists.direction, ...lists.date, ...lists.task].filter(
          (item) => item.decision === 'pending',
        ).length;
        tx.update(analysisRef, {
          facts: lists.fact,
          directions: lists.direction,
          dates: lists.date,
          proposedTasks: lists.task,
          status: pending === 0 ? 'reviewed' : 'in_review',
          reviewedBy: pending === 0 ? ctx.uid : null,
          reviewedAt: pending === 0 ? now : null,
        });
      }

      if (verifiedHearings.length > 0) {
        const known = hearings.docs
          .map((doc) => doc.data() as EventDoc<Timestamp>)
          .filter((event) => event.dateStatus === 'verified' && event.eventDateOnly)
          .map((event) => event.eventDateOnly as string);
        const next = [...known, ...verifiedHearings].filter((day) => day >= today).sort()[0] ?? null;
        if (next !== kase.data.nextHearingDateOnly) {
          tx.update(kase.ref, {
            nextHearingDateOnly: next,
            nextHearingDate: midnightIst(next),
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: ctx.uid,
          });
        }
      }

      return { applied, skipped, taskIds, eventIds };
    });
  },
);
