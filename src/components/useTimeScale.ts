import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import { dateTime, type TimeRange } from '@grafana/data';
import { useMemo } from 'react';

export function useTimeScale(timeRange: TimeRange, width: number): ScaleTime<number, number> {
  return useMemo(() => {
    const dayFromValue = timeRange.from.valueOf();
    const dayToValue = timeRange.to.valueOf();
    const dayFrom = dateTime(dayFromValue).startOf('day').toDate();
    const dayTo = dateTime(dayToValue).endOf('day').toDate();
    const numDays = 1 + d3.timeDay.count(dayFrom, dayTo);
    if (numDays <= 0) {
      throw new Error('Negative time range');
    }

    return d3.scaleTime().domain([dayFrom, dayTo]).range([0, width]);
  }, [timeRange, width]);
}
