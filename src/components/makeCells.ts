import type { TimeRange } from '@grafana/data';
import { Temporal } from '@js-temporal/polyfill';
import { makeTimeScale } from './useTimeScale';
import { resolveTimeZone } from './timeZone';

export type Cell<V = number> = {
  time: number;
  endTime: number;
  value: V;
  left: number;
  top: number;
  right: number;
  bottom: number;
  split?: number;
};

export type Area = Pick<Cell, 'left' | 'top' | 'right' | 'bottom'>;

const FALLBACK_TIME_STEP = 3600;

/** Maps unix seconds to their position within the day, scaled to `height`. */
function makeTimeOfDayScale(tz: string, height: number) {
  return (unixSeconds: number) => {
    const zdt = Temporal.Instant.fromEpochMilliseconds(unixSeconds * 1000).toZonedDateTimeISO(tz);
    const startOfDay = zdt.startOfDay();
    const secondsInDay = zdt.since(startOfDay, { largestUnit: 'seconds' }).total({ unit: 'seconds' });
    const totalDaySeconds = startOfDay
      .add({ days: 1 })
      .since(startOfDay, { largestUnit: 'seconds' })
      .total({ unit: 'seconds' });
    return (height * secondsInDay) / totalDaySeconds;
  };
}

/** The region of the plot covered by the time range, as up to three boxes. */
export function makeTimeRangeArea(timeZone: string, timeRange: TimeRange): Area[] {
  const tz = resolveTimeZone(timeZone);
  const xTime = makeTimeScale(timeRange, 1, tz);
  const yAxis = makeTimeOfDayScale(tz, 1);
  const from = Temporal.Instant.fromEpochMilliseconds(timeRange.from.valueOf()).toZonedDateTimeISO(tz);
  const to = Temporal.Instant.fromEpochMilliseconds(timeRange.to.valueOf()).toZonedDateTimeISO(tz);
  const first = {
    left: xTime(from.startOfDay().epochMilliseconds),
    top: yAxis(from.epochMilliseconds / 1000),
    right: xTime(from.startOfDay().add({ days: 1 }).epochMilliseconds),
  };
  const last = {
    left: xTime(to.startOfDay().epochMilliseconds),
    right: xTime(to.startOfDay().add({ days: 1 }).epochMilliseconds),
    bottom: yAxis(to.epochMilliseconds / 1000),
  };
  return makeSpanArea(first, last);
}

/** The region from the top of `first` to the bottom of `last`, as up to three boxes. */
export function makeSpanArea(
  first: Pick<Area, 'left' | 'top' | 'right'>,
  last: Pick<Area, 'left' | 'right' | 'bottom'>
): Area[] {
  if (first.left === last.left) {
    return [{ left: first.left, top: first.top, right: first.right, bottom: last.bottom }];
  }
  const area: Area[] = [{ left: first.left, top: first.top, right: first.right, bottom: 1 }];
  if (first.right < last.left) {
    area.push({ left: first.right, top: 0, right: last.left, bottom: 1 });
  }
  area.push({ left: last.left, top: 0, right: last.right, bottom: last.bottom });
  return area;
}

/** Smallest interval between samples, in seconds. */
export function getTimeStep(timeValues: number[]): number {
  let minInterval = Infinity;
  for (let i = 1; i < timeValues.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const interval = timeValues[i]! - timeValues[i - 1]!;
    if (interval > 0 && interval < minInterval) {
      minInterval = interval;
    }
  }
  return Number.isFinite(minInterval) ? minInterval / 1000 : FALLBACK_TIME_STEP;
}

export function makeCells<V>(
  values: Array<V | null>,
  timeValues: number[],
  timeZone: string,
  timeRange: TimeRange,
  height = 1,
  width = 1
): Array<Cell<V>> {
  const tz = resolveTimeZone(timeZone);
  const xTime = makeTimeScale(timeRange, width, tz);
  const yAxis = makeTimeOfDayScale(tz, height);

  const timeStep = getTimeStep(timeValues);
  const cells: Array<Cell<V>> = [];

  const startDate = Temporal.Instant.fromEpochMilliseconds(timeRange.from.unix() * 1000).toZonedDateTimeISO(tz);
  let dayStart = startDate.startOfDay();
  let nextDay = dayStart;
  // Unix seconds of dayStart and nextDay, as Temporal's epoch getters are costly per sample
  let dayStartUnix = dayStart.epochMilliseconds / 1000;
  let nextDayUnix = dayStartUnix;
  let dayWidth = 0,
    x = 0,
    nextDayX = 0;
  const advanceDay = (start: Temporal.ZonedDateTime) => {
    dayStart = start;
    nextDay = dayStart.add({ days: 1 });
    dayStartUnix = dayStart.epochMilliseconds / 1000;
    nextDayUnix = nextDay.epochMilliseconds / 1000;
  };
  // Equals yAxis within the current day, without a time zone lookup per sample
  const timeOfDay = (unixSeconds: number) =>
    unixSeconds >= dayStartUnix && unixSeconds < nextDayUnix
      ? (height * (unixSeconds - dayStartUnix)) / (nextDayUnix - dayStartUnix)
      : yAxis(unixSeconds);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) {
      continue;
    }
    // timeValues and values share length
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const timeMs = timeValues[i]!;
    // Sorted input puts repeated timestamps side by side; the last sample wins
    if (timeValues[i + 1] === timeMs) {
      continue;
    }
    const time = timeMs / 1000;

    while (time >= nextDayUnix) {
      advanceDay(
        dayStart === nextDay
          ? Temporal.Instant.fromEpochMilliseconds(timeMs).toZonedDateTimeISO(tz).startOfDay()
          : nextDay
      );
      x = xTime(dayStart.epochMilliseconds);
      nextDayX = xTime(nextDay.epochMilliseconds);
      dayWidth = nextDayX - x;
    }

    const cellEndTime = time + timeStep;

    const TIME_EPS = 60;
    const segments: Array<Cell<V>> = [];
    let top = timeOfDay(time);
    for (;;) {
      segments.push({
        time,
        endTime: cellEndTime,
        value,
        left: x,
        top,
        right: x + dayWidth,
        bottom: cellEndTime < nextDayUnix ? timeOfDay(cellEndTime) : height,
      });
      if (cellEndTime - nextDayUnix <= TIME_EPS) {
        break;
      }
      advanceDay(nextDay);
      x = nextDayX;
      nextDayX = xTime(nextDay.epochMilliseconds);
      dayWidth = nextDayX - x;
      top = 0;
    }

    if (segments.length > 1) {
      segments.forEach((segment, ordinal) => {
        segment.split = ordinal + 1;
      });
    }
    cells.push(...segments);
  }

  return cells;
}
