import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import { dateTimeForTimeZone, type TimeRange } from '@grafana/data';

export function makeTimeScale(timeRange: TimeRange, width: number, timeZone: string): ScaleTime<number, number> {
  const dayFromValue = timeRange.from.valueOf();
  const dayToValue = timeRange.to.valueOf();
  const dayFrom = dateTimeForTimeZone(timeZone, dayFromValue).startOf('day').toDate();
  const dayTo = dateTimeForTimeZone(timeZone, dayToValue).endOf('day').toDate();
  const numDays = 1 + d3.timeDay.count(dayFrom, dayTo);
  if (numDays <= 0) {
    throw new Error('Negative time range');
  }

  return d3.scaleTime().domain([dayFrom, dayTo]).range([0, width]);
}
