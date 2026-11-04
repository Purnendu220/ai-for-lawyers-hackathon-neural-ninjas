import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { paths, todayDateOnly, type OrganizationDoc } from '@casepilot/shared';
import { PermanentJobError } from './errors';
import { db } from './firebase';

const LIMITS = {
  analyses: { key: 'analysesPerDay', fallback: 50 },
  copilotQuestions: { key: 'copilotPerDay', fallback: 200 },
} as const;

export type AiUse = keyof typeof LIMITS;

/**
 * Counts one use against the workspace's daily quota (IST day). Returns the limit when the quota
 * is used up, so callers can say so, or null when the use was counted.
 */
export async function reserveAiUse(orgId: string, use: AiUse): Promise<number | null> {
  const usageRef = db.doc(paths.usage(orgId, todayDateOnly()));
  const orgRef = db.doc(paths.org(orgId));
  return db.runTransaction(async (tx) => {
    const [usage, org] = await tx.getAll(usageRef, orgRef);
    const quota = (org?.data() as OrganizationDoc<Timestamp> | undefined)?.aiQuota;
    const limit = quota?.[LIMITS[use].key] ?? LIMITS[use].fallback;
    const used = (usage?.data()?.[use] as number | undefined) ?? 0;
    if (used >= limit) return limit;
    tx.set(usageRef, { [use]: FieldValue.increment(1) }, { merge: true });
    return null;
  });
}

/** Counts one analysis against the daily quota, or fails the job for good. */
export async function reserveAnalysis(orgId: string): Promise<void> {
  const exhausted = await reserveAiUse(orgId, 'analyses');
  if (exhausted !== null) {
    throw new PermanentJobError(
      'quota_exceeded',
      `This workspace has used its ${exhausted} document analyses for today. Try again tomorrow.`,
    );
  }
}

export async function recordTokens(
  orgId: string,
  usage: { inputTokens: number; outputTokens: number } | null,
): Promise<void> {
  if (!usage) return;
  await db.doc(paths.usage(orgId, todayDateOnly())).set(
    {
      inputTokens: FieldValue.increment(usage.inputTokens),
      outputTokens: FieldValue.increment(usage.outputTokens),
    },
    { merge: true },
  );
}
