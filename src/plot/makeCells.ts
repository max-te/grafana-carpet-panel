import type { Calendar } from '../time/calendar';

export type Cell<V = number> = {
  /** Start of the sample, in epoch milliseconds */
  time: number;
  /** End of the sample, in epoch milliseconds */
  endTime: number;
  value: V;
  left: number;
  top: number;
  right: number;
  bottom: number;
  split?: number;
};

export type Area = Pick<Cell, 'left' | 'top' | 'right' | 'bottom'>;

const FALLBACK_TIME_STEP = 3_600_000;

/** Horizontal extent of a day's column, as wide as the day is long. */
export function getDayColumn({ days }: Calendar, index: number): Pick<Area, 'left' | 'right'> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- a calendar has at least one day, and callers pass a day's index
  const [first, last, day] = [days[0]!, days.at(-1)!, days[index]!];
  const scale = (epochMs: number) => (epochMs - first.start) / (last.end - 1 - first.start);
  return { left: scale(day.start), right: scale(day.end) };
}

/** The region of the plot covered by the time range, as up to three boxes. */
export function makeTimeRangeArea(calendar: Calendar): Area[] {
  const { from, to, dayAt, timeOfDay } = calendar;
  // The range starts and ends within its own days
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const first = { ...getDayColumn(calendar, dayAt(from)!), top: timeOfDay(from)! };
  const last = { ...getDayColumn(calendar, dayAt(to)!), bottom: timeOfDay(to)! };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
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

/** Smallest interval between samples, in milliseconds. */
export function getTimeStep(timeValues: number[]): number {
  let minInterval = Infinity;
  for (let i = 1; i < timeValues.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const interval = timeValues[i]! - timeValues[i - 1]!;
    if (interval > 0 && interval < minInterval) {
      minInterval = interval;
    }
  }
  return Number.isFinite(minInterval) ? minInterval : FALLBACK_TIME_STEP;
}

/** Turns samples into cells, dropping the parts of cells on days outside the calendar. */
export function makeCells<V>(values: Array<V | null>, timeValues: number[], calendar: Calendar): Array<Cell<V>> {
  const { days, dayAt, timeOfDay } = calendar;
  const timeStep = getTimeStep(timeValues);
  const TIME_EPS = 60_000;
  const cells: Array<Cell<V>> = [];

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) {
      continue;
    }
    // timeValues and values share length
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const time = timeValues[i]!;
    // Sorted input puts repeated timestamps side by side; the last sample wins
    if (timeValues[i + 1] === time) {
      continue;
    }
    const endTime = time + timeStep;

    // A sample before the first day may still reach into it
    const firstDay = dayAt(time) ?? (time < (days[0]?.start ?? 0) ? 0 : days.length);
    const segments: Array<Cell<V>> = [];
    for (let index = firstDay; index < days.length; index++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index is within the days
      const day = days[index]!;
      if (endTime <= day.start) {
        break;
      }
      /* eslint-disable @typescript-eslint/no-non-null-assertion -- both instants lie within the day */
      segments.push({
        time,
        endTime,
        value,
        ...getDayColumn(calendar, index),
        top: time > day.start ? timeOfDay(time)! : 0,
        bottom: endTime < day.end ? timeOfDay(endTime)! : 1,
      });
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      if (endTime - day.end <= TIME_EPS) {
        break;
      }
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

/** The cell whose interval holds `time`, as all its segments if it is split. */
export function findCellsAt<V>(cells: Array<Cell<V>>, time: number): Array<Cell<V>> {
  // Half-open, as the next cell starts where a cell ends
  const cell = cells.find((c) => c.time <= time && time < c.endTime);
  return cell ? cells.filter((c) => c.time === cell.time) : [];
}
