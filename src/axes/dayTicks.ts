import type { Temporal } from 'temporal-polyfill';
import type { CalendarDay } from '../time/calendar';

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

/** Indices of the days that get a label, at most `maxCount` of them. */
export function makeDayTicks(days: CalendarDay[], maxCount: number): number[] {
  const { isTick } = pickTickInterval(days.length, maxCount);
  return days.flatMap((day, index) => (isTick(day.date) ? [index] : []));
}
