import { z } from 'zod';

/**
 * A Firestore document ID or Auth UID coming from a client. Restricting the alphabet keeps a
 * client from smuggling "/" into a document path.
 */
export const FirestoreId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, 'Invalid ID');

export const OkOutput = z.object({ ok: z.literal(true) });
export type OkOutput = z.infer<typeof OkOutput>;
