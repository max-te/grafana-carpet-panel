import type { TimeRange } from '@grafana/data';
import { Temporal } from '@js-temporal/polyfill';
import { resolveTimeZone } from './timeZone';

type TickInterval = { days: number; isTick: (day: Temporal.PlainDate) => boolean };

// Same candidates and selection rule as d3's scaleTime().ticks()
const TICK_INTERVALS: [TickInterval, ...TickInterval[]] = [
  { days: 1, isTick: () => true },
  { days: 2, isTick: (day) => day.day % 2 === 1 },
  { days: 7, isTick: (day) => day.dayOfWeek === 7 },
  { days: 30, isTick: (day) => day.day === 1 },
  { days: 90, isTick: (day) => day.day === 1 && day.month % 3 === 1 },
  { days: 365, isTick: (day) => day.day === 1 && day.month === 1 },
];

function pickTickInterval(numDays: number, count: number): TickInterval {
  const target = numDays / count;
  let previous = TICK_INTERVALS[0];
  for (const interval of TICK_INTERVALS) {
    if (interval.days >= target) {
      return target / previous.days < interval.days / target ? previous : interval;
    }
    previous = interval;
  }
  return previous;
}

/** Labelled dates within the time range, as seen in the given time zone. */
export function makeDayTicks(timeRange: TimeRange, timeZone: string, count = 10): Temporal.PlainDate[] {
  const tz = resolveTimeZone(timeZone);
  const firstDay = Temporal.Instant.fromEpochMilliseconds(timeRange.from.valueOf())
    .toZonedDateTimeISO(tz)
    .toPlainDate();
  const lastDay = Temporal.Instant.fromEpochMilliseconds(timeRange.to.valueOf()).toZonedDateTimeISO(tz).toPlainDate();
  const numDays = firstDay.until(lastDay).days + 1;
  const { isTick } = pickTickInterval(numDays, count);

  const ticks: Temporal.PlainDate[] = [];
  for (let day = firstDay; Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({ days: 1 })) {
    if (isTick(day)) {
      ticks.push(day);
    }
  }
  return ticks;
}
