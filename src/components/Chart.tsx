import { dateTime, dateTimeAsMoment, getFieldConfigWithMinMax, type Field, type TimeRange } from '@grafana/data';
import * as d3 from 'd3';
import React, { useCallback, useMemo, useState } from 'react';
import { Layer, Group, Rect } from 'react-konva';


interface ChartProps {
  x: number;
  y: number;
  width: number;
  height: number;

  // legend: boolean;
  // cellBorder: boolean;
  // showValueIndicator: boolean;
  // legendGradientQuality: Quality;
  timeField: Field<number>;
  valueField: Field<number>;
  // timeZone: string;
  timeRange: TimeRange;
  // dailyIntervalHours: [number, number];
  // regions: TimeRegion[];
  // tooltip: boolean;
}

export const Chart: React.FC<ChartProps> = ({
  x,
  y,
  width,
  height,
  timeRange,
  timeField,
  valueField,
}) => {
  console.debug("range", timeRange.from.unix(), timeRange.to.unix())
  const dayFrom = dateTime(timeRange.from).startOf('day');
  const dayTo = dateTime(timeRange.to).endOf('day');
  const numDays = 1 + d3.timeDay.count(dayFrom.toDate(), dayTo.toDate());
  console.assert(numDays >= 0);
  const dates: string[] = [];
  for (let i = 0; i < numDays; i++) {
    const day = dateTime(dayFrom).add(i, 'days');
    dates.push(day.unix().toString());
  }

  const xAxis = useMemo(() => d3.scaleBand().domain(dates).range([0, width]), [dates, width]);
  const yAxis = d3.scaleLinear().domain([0, 25 * 60 * 60]).range([0, height])
  const fieldConfig = getFieldConfigWithMinMax(valueField);
  const colorScale = useMemo(() => d3.scaleSequential(d3.interpolateMagma).domain(([fieldConfig.min!, fieldConfig.max!] as [number, number])), [numDays])

  const buckets = valueField.values.map((value, i) => {
    const time = timeField.values[i]!;
    const date = dateTime(time);
    const dayStart = date.startOf('d').unix();
    const x =  xAxis(dayStart.toString())!;
    const y = yAxis(time / 1000 - dayStart)!;
    return {time, value, date, x, y, dayStart}
  })


  return <Group width={width} height={height} x={x} y={y}>
    {
      buckets.map(({x, y, value, time, dayStart}, i) => {
        const dayWidth = xAxis.bandwidth(); // TODO
        let bucketEnd = timeRange.to.unix();
        if (i + 1 < buckets.length) {
          const nextBucket = buckets[i + 1]!;
          bucketEnd = nextBucket.time / 1000;
        }
        const bucketHeight = yAxis(bucketEnd - dayStart)! + 1 - y!;

        return <Rect
          x={x}
          y={y}
          width={dayWidth + 1}
          height={bucketHeight}
          fill={colorScale(value)}
          onMouseOver={(ev) => console.debug(time, value)}
        />
      })
    }

  </Group>
};
