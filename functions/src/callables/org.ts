import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/https';
import {
  callables,
  DEFAULT_ORG_POLICY,
  MAX_ORGS_PER_USER,
  paths,
  type CallableOutput,
  type UserDoc,
} from '@casepilot/shared';
import { audit } from '../core/audit';
import { requireAuth } from '../core/authz';
import { callableOptions, db } from '../core/firebase';
import { parseInput } from '../core/validate';

/** Creates a workspace with the caller as owner. A solo advocate is a one-member organization. */
export const createOrganization = onCall(
  callableOptions,
  async (req): Promise<CallableOutput<'createOrganization'>> => {
    const user = requireAuth(req);
    const input = parseInput(callables.createOrganization.input, req.data);

    const orgRef = db.collection('organizations').doc();
    const userRef = db.doc(paths.user(user.uid));
    const memberRef = db.doc(paths.member(orgRef.id, user.uid));

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const existing = userSnap.data() as UserDoc<Timestamp> | undefined;
      if (Object.keys(existing?.memberships ?? {}).length >= MAX_ORGS_PER_USER) {
        throw new HttpsError('resource-exhausted', 'You have reached the workspace limit.');
      }
      const displayName = existing?.displayName || user.displayName || user.email || '';

      tx.create(orgRef, {
        name: input.name,
        workspaceType: input.workspaceType,
        defaultLanguage: input.defaultLanguage,
        policy: DEFAULT_ORG_POLICY,
        aiQuota: { analysesPerDay: 50, copilotPerDay: 200 },
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid,
      });

      tx.create(memberRef, {
        role: 'owner',
        status: 'active',
        displayName,
        email: user.email,
        joinedAt: FieldValue.serverTimestamp(),
      });

      tx.set(
        userRef,
        {
          displayName,
          email: user.email,
          ...(existing ? {} : { createdAt: FieldValue.serverTimestamp() }),
          ...(existing?.preferences ? {} : { preferences: { language: input.defaultLanguage } }),
          memberships: { [orgRef.id]: { orgName: input.name, role: 'owner' } },
          lastActiveOrgId: orgRef.id,
        },
        { merge: true },
      );

      audit(tx, { uid: user.uid, orgId: orgRef.id }, {
        action: 'org.created',
        entityType: 'organization',
        entityId: orgRef.id,
        metadata: { workspaceType: input.workspaceType },
      });
    });

    logger.info('org.created', { orgId: orgRef.id, workspaceType: input.workspaceType });
    return { orgId: orgRef.id };
  },
);
