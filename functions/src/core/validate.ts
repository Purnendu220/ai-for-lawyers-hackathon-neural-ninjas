import { HttpsError } from 'firebase-functions/https';
import type { z } from 'zod';

/** Parses callable input. Issue messages and paths go back to the client; input values never do. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpsError('invalid-argument', 'Invalid request.', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
