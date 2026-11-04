/** A failure that retrying will not fix (bad file, no text, quota, refusal). Fails the job at once. */
export class PermanentJobError extends Error {
  constructor(
    readonly code: string,
    /** Shown to the user on the document. */
    readonly userMessage: string,
  ) {
    super(code);
    this.name = 'PermanentJobError';
  }
}
