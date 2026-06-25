import { type TimeRange } from '@grafana/data';
import { Temporal } from '@js-temporal/polyfill';
import { makeTimeScale } from './useTimeScale';
import { resolveTimeZone } from './timeZone';

export type Cell = {
  time: number;
  endTime: number;
  value: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  split?: number;
};

function getTimeStep(timeValues: number[]): number {
  let minInterval = Infinity;
  for (let i = 1; i < timeValues.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const interval = timeValues[i]! - timeValues[i - 1]!;
    if (interval < minInterval) {
      minInterval = interval;
    }
  }
  return minInterval / 1000;
}

export function makeCells(
  values: (number | null)[],
  timeValues: number[],
  timeZone: string,
  timeRange: TimeRange,
  height: number = 1,
  width: number = 1
): Cell[] {
  const tz = resolveTimeZone(timeZone);
  const xTime = makeTimeScale(timeRange, width, tz);
  const yAxis = (unixSeconds: number) => {
    const zdt = Temporal.Instant.fromEpochMilliseconds(unixSeconds * 1000).toZonedDateTimeISO(tz);
    const startOfDay = zdt.startOfDay();
    const secondsInDay = zdt.since(startOfDay, { largestUnit: 'seconds' }).total({ unit: 'seconds' });
    const totalDaySeconds = startOfDay
      .add({ days: 1 })
      .since(startOfDay, { largestUnit: 'seconds' })
      .total({ unit: 'seconds' });
    return (height * secondsInDay) / totalDaySeconds;
  };

  const timeStep = getTimeStep(timeValues);
  const cells: Cell[] = [];

  const startDate = Temporal.Instant.fromEpochMilliseconds(timeRange.from.unix() * 1000).toZonedDateTimeISO(tz);
  let dayStart = startDate.startOfDay();
  let nextDay = dayStart;
  let dayWidth = 0,
    x = 0,
    nextDayX = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    // timeValues and values share length
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const date = Temporal.Instant.fromEpochMilliseconds(timeValues[i]!).toZonedDateTimeISO(tz);
    const time = date.epochMilliseconds / 1000;

    while (time >= nextDay.epochMilliseconds / 1000) {
      dayStart = dayStart === nextDay ? date.startOfDay() : nextDay;
      nextDay = dayStart.add({ days: 1 });
      x = nextDayX;
      nextDayX = xTime(nextDay.epochMilliseconds);
      dayWidth = nextDayX - x;
    }

    const y = yAxis(time);
    const cellEndTime = time + timeStep;

    const TIME_EPS = 60;
    const nextDayUnix = nextDay.epochMilliseconds / 1000;
    const cell: Cell = {
      time,
      endTime: cellEndTime,
      value,
      left: x,
      top: y,
      right: x + dayWidth,
      bottom: cellEndTime < nextDayUnix ? yAxis(cellEndTime) : height,
    };
    cells.push(cell);

    // TODO: at really low resolutions a cell *could* span more than a full day
    if (cellEndTime - nextDayUnix > TIME_EPS) {
      cell.split = 1;
      dayStart = nextDay;
      nextDay = dayStart.add({ days: 1 });
      x = nextDayX;
      nextDayX = xTime(nextDay.epochMilliseconds);
      dayWidth = nextDayX - x;

      const secondCell: Cell = {
        time,
        endTime: cellEndTime,
        value,
        left: x,
        top: 0,
        right: x + dayWidth,
        bottom: yAxis(cellEndTime),
        split: -1,
      };
      cells.push(secondCell);
    }
  }

  return cells;
}
