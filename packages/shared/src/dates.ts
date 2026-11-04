import { APP_TIME_ZONE } from './constants';

/**
 * Legal dates (hearings, due dates) are calendar days, stored as 'YYYY-MM-DD' next to a Timestamp.
 * Overdue/upcoming logic compares these strings, so no time-zone shift can move a date by a day.
 */
export type DateOnly = string;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** India Standard Time is UTC+05:30 all year (no daylight saving). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function isDateOnly(value: string): value is DateOnly {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** The IST calendar day that contains `instant`. */
export function toDateOnly(instant: Date): DateOnly {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayDateOnly(now: Date = new Date()): DateOnly {
  return toDateOnly(now);
}

/** Midnight IST at the start of `day`, as an instant. Use it for the Timestamp stored beside the string. */
export function dateOnlyToInstant(day: DateOnly): Date {
  if (!isDateOnly(day)) throw new RangeError(`Not a valid YYYY-MM-DD date: ${day}`);
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
}

export function isOverdue(due: DateOnly | null, today: DateOnly): boolean {
  return due !== null && due < today;
}

export function formatDateOnly(day: DateOnly, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dateOnlyToInstant(day));
}

export function formatInstant(instant: Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}
