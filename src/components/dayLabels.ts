import type { Temporal } from './temporal';

// Building a formatter is costly; PlainDate.toLocaleString builds one per call
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Label for a day: month and year when `isLong`, otherwise month and day */
export function formatDay(day: Temporal.PlainDate, isLong: boolean, locale?: string): string {
  const key = `${locale ?? ''}|${isLong ? 'long' : 'short'}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      locale,
      isLong
        ? { year: 'numeric', month: 'numeric', timeZone: 'UTC' }
        : { month: 'numeric', day: 'numeric', timeZone: 'UTC' }
    );
    formatters.set(key, formatter);
  }
  const date = new Date(0);
  // Unlike Date.UTC, keeps years 0–99 as they are
  date.setUTCFullYear(day.year, day.month - 1, day.day);
  return formatter.format(date);
}
