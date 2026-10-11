import type { TimeRange } from '@grafana/data';
import { Temporal } from 'temporal-polyfill';
import { resolveTimeZone } from './timeZone';

export interface CalendarDay {
  date: Temporal.PlainDate;
  /** Local midnight that starts the day, in epoch milliseconds */
  start: number;
  /** Local midnight that starts the next day, in epoch milliseconds */
  end: number;
}

/** The days of a time range as seen in a time zone. */
export interface Calendar {
  /** Start of the time range, in epoch milliseconds */
  from: number;
  /** End of the time range, in epoch milliseconds */
  to: number;
  /** Every day the time range touches, in order */
  days: CalendarDay[];
  /** Index of the day holding an instant; undefined before the first day or after the last */
  dayAt: (epochMs: number) => number | undefined;
  /** Position of an instant within its day, from 0 at its start to 1 at its end; undefined outside the days */
  timeOfDay: (epochMs: number) => number | undefined;
}

/** Lists the days of `timeRange` in `timeZone`, which may be Grafana's "browser". */
export function makeCalendar(timeRange: TimeRange, timeZone: string): Calendar {
  const tz = resolveTimeZone(timeZone);
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  const firstDate = Temporal.Instant.fromEpochMilliseconds(from).toZonedDateTimeISO(tz).toPlainDate();
  const lastDate = Temporal.Instant.fromEpochMilliseconds(to).toZonedDateTimeISO(tz).toPlainDate();

  const days: CalendarDay[] = [];
  let start = firstDate.toZonedDateTime(tz).epochMilliseconds;
  for (let date = firstDate; Temporal.PlainDate.compare(date, lastDate) <= 0; ) {
    const next = date.add({ days: 1 });
    const end = next.toZonedDateTime(tz).epochMilliseconds;
    days.push({ date, start, end });
    date = next;
    start = end;
  }

  const dayAt = (epochMs: number) => {
    let low = 0;
    let high = days.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- middle lies within the bounds
      const day = days[middle]!;
      if (epochMs < day.start) {
        high = middle - 1;
      } else if (epochMs >= day.end) {
        low = middle + 1;
      } else {
        return middle;
      }
    }
    return undefined;
  };

  return {
    from,
    to,
    days,
    dayAt,
    timeOfDay: (epochMs) => {
      const index = dayAt(epochMs);
      const day = index === undefined ? undefined : days[index];
      return day && (epochMs - day.start) / (day.end - day.start);
    },
  };
}
