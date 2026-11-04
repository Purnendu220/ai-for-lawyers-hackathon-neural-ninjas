/** Optional text fields arrive as strings from forms and are stored as null when empty. */
export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Names of the keys whose values differ, for audit metadata. Values are never logged. */
export function changedKeys(next: Record<string, unknown>, current: Record<string, unknown>): string[] {
  return Object.keys(next).filter((key) => JSON.stringify(next[key]) !== JSON.stringify(current[key]));
}
