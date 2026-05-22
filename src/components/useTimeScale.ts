import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import { type TimeRange } from '@grafana/data';
import { Temporal } from '@js-temporal/polyfill';
import { resolveTimeZone } from './timeZone';

export function makeTimeScale(timeRange: TimeRange, width: number, timeZone: string): ScaleTime<number, number> {
  const tz = resolveTimeZone(timeZone);
  const dayFromValue = timeRange.from.valueOf();
  const dayToValue = timeRange.to.valueOf();
  const fromZdt = Temporal.Instant.fromEpochMilliseconds(dayFromValue).toZonedDateTimeISO(tz);
  const toZdt = Temporal.Instant.fromEpochMilliseconds(dayToValue).toZonedDateTimeISO(tz);
  const dayFrom = new Date(fromZdt.startOfDay().epochMilliseconds);
  const dayTo = new Date(toZdt.startOfDay().add({ days: 1 }).epochMilliseconds - 1);
  const numDays = 1 + d3.timeDay.count(dayFrom, dayTo);
  if (numDays <= 0) {
    throw new Error('Negative time range');
  }

  return d3.scaleTime().domain([dayFrom, dayTo]).range([0, width]);
}
