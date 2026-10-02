import type { Temporal } from '@js-temporal/polyfill';

/** Label for a day: month and year when `isLong`, otherwise month and day */
export function formatDay(day: Temporal.PlainDate, isLong: boolean, locale?: string): string {
  return day.toLocaleString(
    locale,
    isLong ? { year: 'numeric', month: 'numeric' } : { month: 'numeric', day: 'numeric' }
  );
}
