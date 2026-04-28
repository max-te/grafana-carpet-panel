import {
  dateTime,
  dateTimeForTimeZone,
  type DateTimeInput,
  type TimeRange,
} from '@grafana/data';
import { makeTimeScale } from './useTimeScale';

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
  const xTime = makeTimeScale(timeRange, width, timeZone);
  const yAxis = (t: DateTimeInput) => {
    const timeInMs = typeof t === 'number' ? t * 1000 : t;
    const time = dateTimeForTimeZone(timeZone, timeInMs);
    const dayStart = dateTime(time).startOf('d');
    const tSecondsInDay = time.diff(dayStart, 's', false);
    const dayEnd = dateTime(time).endOf('d');
    const daySeconds = dayEnd.diff(dayStart, 's', false);

    return (height * tSecondsInDay) / daySeconds;
  };

  const timeStep = getTimeStep(timeValues);
  const cells: Cell[] = [];

  let dayStart = dateTime(0),
    nextDay = dayStart;
  let dayWidth = 0,
    x = 0,
    nextDayX = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    const date = dateTimeForTimeZone(timeZone, timeValues[i]);
    const time = date.unix();

    while (time >= nextDay.unix()) {
      dayStart = dayStart === nextDay ? dateTime(date).startOf('d') : nextDay;
      nextDay = dateTime(dayStart).add(1, 'd');
      x = nextDayX;
      nextDayX = xTime(nextDay);
      dayWidth = nextDayX - x;
    }

    const y = yAxis(time);
    const cellEndTime = time + timeStep;

    const TIME_EPS = 60;
    const cell: Cell = {
      time,
      endTime: cellEndTime,
      value,
      left: x,
      top: y,
      right: x + dayWidth,
      bottom: cellEndTime < nextDay.unix() ? yAxis(cellEndTime) : height,
    };
    cells.push(cell);

    // TODO: at really low resolutions a cell *could* span more than a full day
    if (cellEndTime - nextDay.unix() > TIME_EPS) {
      cell.split = 1;
      dayStart = nextDay;
      nextDay = dateTime(dayStart).add(1, 'd');
      x = nextDayX;
      nextDayX = xTime(nextDay);
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
