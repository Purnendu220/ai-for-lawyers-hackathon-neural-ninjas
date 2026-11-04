import { describe, expect, it } from 'vitest';
import { dateOnlyToInstant, isDateOnly, isOverdue, toDateOnly } from './dates';

describe('IST calendar days', () => {
  it('rolls over to the next day at midnight IST, not midnight UTC', () => {
    expect(toDateOnly(new Date('2026-12-14T18:29:59Z'))).toBe('2026-12-14');
    expect(toDateOnly(new Date('2026-12-14T18:30:00Z'))).toBe('2026-12-15');
  });

  it('maps a calendar day to midnight IST', () => {
    expect(dateOnlyToInstant('2026-12-15').toISOString()).toBe('2026-12-14T18:30:00.000Z');
    expect(toDateOnly(dateOnlyToInstant('2026-12-15'))).toBe('2026-12-15');
  });

  it('rejects impossible dates', () => {
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(isDateOnly('15-12-2026')).toBe(false);
    expect(() => dateOnlyToInstant('2026-13-01')).toThrow(RangeError);
  });

  it('treats a task as overdue only after its due day', () => {
    expect(isOverdue('2026-11-02', '2026-11-03')).toBe(true);
    expect(isOverdue('2026-11-03', '2026-11-03')).toBe(false);
    expect(isOverdue(null, '2026-11-03')).toBe(false);
  });
});
