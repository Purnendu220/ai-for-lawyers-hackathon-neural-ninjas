import { collection, collectionGroup, orderBy, query, where, type Timestamp } from 'firebase/firestore';
import { useMemo } from 'react';
import { can, isOverdue, paths, type TaskDoc } from '@casepilot/shared';
import { useActiveOrg } from '@/features/org/org-context';
import { db } from '@/lib/firebase';
import { useLiveQuery, type WithId } from '@/lib/live';

export type Task = WithId<TaskDoc<Timestamp>>;

export const OPEN_STATUSES = ['open', 'in_progress'] as const;

export function isTaskOverdue(task: Task, today: string): boolean {
  return (task.status === 'open' || task.status === 'in_progress') && isOverdue(task.dueDateOnly, today);
}

/** Tasks with a due date first (earliest first), then undated ones. */
export function byDueDate(a: Task, b: Task): number {
  if (a.dueDateOnly && b.dueDateOnly) return a.dueDateOnly.localeCompare(b.dueDateOnly);
  if (a.dueDateOnly) return -1;
  if (b.dueDateOnly) return 1;
  return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
}

export function useCaseTasks(caseId: string) {
  const { id: orgId } = useActiveOrg();
  const tasksQuery = useMemo(() => query(collection(db(), paths.tasks(orgId, caseId))), [orgId, caseId]);
  return useLiveQuery<TaskDoc<Timestamp>>(tasksQuery);
}

/**
 * Tasks across every case of the workspace (collection-group query; rules require the orgId
 * filter). `assignedTo` narrows to one person; `includeDone` adds completed tasks.
 */
export function useOrgTasks({ assignedTo, includeDone }: { assignedTo?: string; includeDone?: boolean } = {}) {
  const { id: orgId } = useActiveOrg();
  const tasksQuery = useMemo(() => {
    const statuses = includeDone ? [...OPEN_STATUSES, 'completed'] : [...OPEN_STATUSES];
    const filters = [
      where('orgId', '==', orgId),
      ...(assignedTo ? [where('assignedTo', '==', assignedTo)] : []),
      where('status', 'in', statuses),
    ];
    return query(collectionGroup(db(), 'tasks'), ...filters, orderBy('dueDate', 'asc'));
  }, [orgId, assignedTo, includeDone]);
  return useLiveQuery<TaskDoc<Timestamp>>(tasksQuery);
}

/** Paralegals manage only their own tasks (mirrors the updateTask check). */
export function useCanEditTask(task: Task): boolean {
  const { org, member } = useActiveOrg();
  return can(member.role, 'task.write', org.policy) && (member.role !== 'paralegal' || task.assignedTo === member.id);
}
