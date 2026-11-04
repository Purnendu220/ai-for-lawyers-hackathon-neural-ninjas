import { Timestamp } from 'firebase/firestore';
import { useState } from 'react';
import { dateOnlyToInstant, todayDateOnly, type DateOnly } from '@casepilot/shared';

/**
 * Today in India Standard Time, fixed for the life of the component so overdue badges and date
 * queries don't shift during a render.
 */
export function useToday(): { today: DateOnly; todayStart: Timestamp } {
  const [value] = useState(() => {
    const today = todayDateOnly();
    return { today, todayStart: Timestamp.fromDate(dateOnlyToInstant(today)) };
  });
  return value;
}

/** The calendar day `days` after `day`. */
export function addDays(day: DateOnly, days: number): DateOnly {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
