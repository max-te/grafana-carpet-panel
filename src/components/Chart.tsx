import { dateTime, getFieldConfigWithMinMax, type DateTime, type Field, type TimeRange } from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import React, { useMemo, useState } from 'react';
import { Group, Rect, Line, Text } from 'react-konva';
import { Html } from 'react-konva-utils';

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
  colorPalette: (t: number) => string;
}

type Bucket = {
  time: number;
  value: number;
  x: number;
  y: number;
  dayStart: DateTime;
};

export const Chart: React.FC<ChartProps> = ({
  x,
  y,
  width,
  height,
  timeRange,
  timeField,
  valueField,
  colorPalette,
}) => {
  const [hover, setHover] = useState<Bucket | null>(null);

  const dayFrom = useMemo(() => dateTime(timeRange.from).startOf('day').toDate(), [timeRange.from]);
  const dayTo = useMemo(() => dateTime(timeRange.to).endOf('day').toDate(), [timeRange.to]);
  const numDays = 1 + d3.timeDay.count(dayFrom, dayTo);
  console.assert(numDays >= 0);

  const xTime = useMemo(() => d3.scaleTime().domain([dayFrom, dayTo]).range([0, width]), [dayFrom.valueOf(), dayTo.valueOf(), width]);
  const yAxis = useMemo(() => d3.scaleLinear().domain([0, 24 * 60 * 60]).rangeRound([0, height]), [height]);

  const fieldConfig = getFieldConfigWithMinMax(valueField);
  const colorScale = useMemo(() => d3.scaleSequential(colorPalette).domain(([fieldConfig.min!, fieldConfig.max!] as [number, number])), [numDays, colorPalette])

  let previous: Bucket | null = null;
  const buckets = useMemo(() => valueField.values.flatMap((value, i) => {
    const time = timeField.values[i]!;
    const date = dateTime(time);
    const dayStart = date.startOf('d');

    const x = xTime(dayStart)!;
    const y = yAxis(time / 1000 - dayStart.unix())!;
    const bucket = { time, value, x, y, dayStart }

    if (previous !== null && previous.time / 1000 < dayStart.unix()) {
      previous = bucket;
      const interBucket = {
        time: dayStart.unix() * 1000,
        value: value,
        x: x,
        y: 0,
        dayStart: dayStart
      }
      return [interBucket, bucket];
    }

    previous = bucket;
    return [bucket];
  }), [valueField.values, timeField.values, xTime, yAxis]);

  let hoverFrame = <></>;

  return <Group x={x} y={y}>
    {
      buckets.map((bucket, i) => {
        const { time, value, x, y, dayStart } = bucket;
        const dayWidth = width / numDays;
        let bucketEnd = timeRange.to.unix();
        if (i + 1 < buckets.length) {
          const nextBucket = buckets[i + 1]!;
          bucketEnd = nextBucket.time / 1000;
        }
        // const bucketHeight = 1 + Math.min(height, yAxis(bucketEnd - dayStart.unix())!) - y!;
        const bucketHeight = 1 + yAxis(bucketEnd - dayStart.unix())! - y!;

        if (hover?.time === bucket.time) {
          hoverFrame = <Rect
            x={x}
            y={y}
            width={dayWidth + 1}
            height={bucketHeight}
            fill={"rgba(255, 255, 255, 0.2)"}
            stroke={value > (fieldConfig.max! + fieldConfig.min!) / 2 ? colorScale(fieldConfig.min!) : colorScale(fieldConfig.max!)}
            strokeWidth={2}
            onMouseOut={() => setHover(null)}
          />
        }

        return <Rect
          key={time}
          x={x}
          y={y}
          width={dayWidth + 1}
          height={bucketHeight}
          fill={colorScale(value)}
          onMouseOver={({ evt }) => setHover({ ...bucket, x: evt.clientX, y: evt.clientY })}
        />
      })
    }
    <XAxis
      x={0}
      y={height}
      height={16}
      width={width}
      scale={xTime}
    />
    {hover && <>{hoverFrame}
      <Html>
        <VizTooltip position={hover} offset={{x: 10, y: 0}}
          content={<SeriesTable timestamp={dateTime(hover.time).toString()}
          series={[{ label: valueField.name, value: valueField.display?.(hover.value!)!.text, color: valueField.display?.(hover.value!)!.color }]} />}
        />
      </Html>
    </>}
  </Group>
};

const XAxis: React.FC<{ x: number, y: number, height: number; width: number; scale: ScaleTime<number, number> }> =
  ({ x, y, width, scale }) => {
    const ticks = scale.ticks();
    ticks.forEach((t) => t.setHours(12))
    ticks.pop();
    const spacing = width / (ticks.length - 1);
    const theme = useTheme2();
    const color = theme.colors.text.primary;
    return <>
      <Line points={[x, y, x + width, y]} stroke={color} strokeWidth={1} />
      {
        ticks.map((date) => {
          const x = scale(date)!;
          return <>
            <Line
              points={[x, y, x, y + 3]}
              stroke={color}
              strokeWidth={1}
            />
            <Text text={(1 + date.getMonth()) + "-" + date.getDate()} x={x - spacing / 2} y={y + 5} fill={color} align='center'
             fontFamily={theme.typography.fontFamily} width={spacing}
              fontSize={theme.typography.htmlFontSize! * 0.75} textBaseline="top"
            />
          </>
        })
      }
    </>
  }
