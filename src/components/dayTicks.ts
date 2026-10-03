import type { TimeRange } from '@grafana/data';
import { Temporal } from './temporal';
import { resolveTimeZone } from './timeZone';

type TickInterval = { minDaysApart: number; isTick: (day: Temporal.PlainDate) => boolean };

const YEARLY: TickInterval = { minDaysApart: 365, isTick: (day) => day.day === 1 && day.month === 1 };

// Same candidates as d3's scaleTime().ticks(), finest first
const TICK_INTERVALS: TickInterval[] = [
  { minDaysApart: 1, isTick: () => true },
  { minDaysApart: 2, isTick: (day) => day.day % 2 === 1 },
  { minDaysApart: 7, isTick: (day) => day.dayOfWeek === 7 },
  { minDaysApart: 28, isTick: (day) => day.day === 1 },
  { minDaysApart: 90, isTick: (day) => day.day === 1 && day.month % 3 === 1 },
  YEARLY,
];

function pickTickInterval(numDays: number, maxCount: number): TickInterval {
  return TICK_INTERVALS.find((interval) => numDays / interval.minDaysApart <= maxCount) ?? YEARLY;
}

/** Labelled dates within the time range, as seen in the given time zone, at most `maxCount` of them. */
export function makeDayTicks(timeRange: TimeRange, timeZone: string, maxCount: number): Temporal.PlainDate[] {
  const tz = resolveTimeZone(timeZone);
  const firstDay = Temporal.Instant.fromEpochMilliseconds(timeRange.from.valueOf())
    .toZonedDateTimeISO(tz)
    .toPlainDate();
  const lastDay = Temporal.Instant.fromEpochMilliseconds(timeRange.to.valueOf()).toZonedDateTimeISO(tz).toPlainDate();
  const numDays = firstDay.until(lastDay).days + 1;
  const { isTick } = pickTickInterval(numDays, maxCount);

  const ticks: Temporal.PlainDate[] = [];
  for (let day = firstDay; Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({ days: 1 })) {
    if (isTick(day)) {
      ticks.push(day);
    }
  }
  return ticks;
}
