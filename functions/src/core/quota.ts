import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { paths, todayDateOnly, type OrganizationDoc } from '@casepilot/shared';
import { db } from './firebase';
import { PermanentJobError } from './errors';

const DEFAULT_ANALYSES_PER_DAY = 50;

/** Counts one analysis against the workspace's daily quota (IST day), or refuses it. */
export async function reserveAnalysis(orgId: string): Promise<void> {
  const usageRef = db.doc(paths.usage(orgId, todayDateOnly()));
  const orgRef = db.doc(paths.org(orgId));
  await db.runTransaction(async (tx) => {
    const [usage, org] = await tx.getAll(usageRef, orgRef);
    const limit =
      (org?.data() as OrganizationDoc<Timestamp> | undefined)?.aiQuota?.analysesPerDay ??
      DEFAULT_ANALYSES_PER_DAY;
    const used = (usage?.data()?.analyses as number | undefined) ?? 0;
    if (used >= limit) {
      throw new PermanentJobError(
        'quota_exceeded',
        `This workspace has used its ${limit} document analyses for today. Try again tomorrow.`,
      );
    }
    tx.set(usageRef, { analyses: FieldValue.increment(1) }, { merge: true });
  });
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
