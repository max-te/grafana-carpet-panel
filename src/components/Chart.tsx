import {
  dateTime,
  formattedValueToString,
  getDisplayProcessor,
  getFieldConfigWithMinMax,
  type DateTime,
  type DateTimeInput,
  type Field,
  type TimeRange,
} from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import React, { Fragment, useCallback, useMemo, useState } from 'react';
import { Rect, Line, Text, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';

interface ChartProps {
  x: number;
  y: number;
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
  // dailyIntervalHours: [number, number];
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
  width,
  height,
  timeRange,
  timeField,
  valueField,
  colorPalette,
  timeZone,
}) => {
  const [hover, setHover] = useState<Bucket | null>(null);
  let hoverFrame = <></>;
  const hoverCallback = useCallback(
    ({ evt, currentTarget }: { evt: MouseEvent; currentTarget: Konva.Node }) => {
      const bucket = currentTarget.attrs['data-bucket'];
      const innerRect = currentTarget.getClientRect();
      const outerRect = (evt.target as Element).getBoundingClientRect();
      setHover({
        ...bucket,
        x: innerRect.x + outerRect.x + innerRect.width,
        y: innerRect.y + outerRect.y + innerRect.height,
      });
      evt.stopPropagation();
    },
    [setHover]
  );
  const unsetHover = useCallback(() => {
    setHover(null);
  }, [setHover]);

  const dayFrom = useMemo(() => dateTime(timeRange.from).startOf('day').toDate(), [timeRange.from]);
  const dayTo = useMemo(() => dateTime(timeRange.to).endOf('day').toDate(), [timeRange.to]);
  const numDays = useMemo(() => 1 + d3.timeDay.count(dayFrom, dayTo), [dayFrom.valueOf(), dayTo.valueOf()]);
  if (numDays <= 0) {
    throw new Error('Negative time range');
  }

  const xTime = useMemo(
    () =>
      d3
        .scaleUtc()
        .domain([dayFrom, dayTo])
        .range([1, width - 1]),
    [dayFrom.valueOf(), dayTo.valueOf(), width]
  );

  const yAxis = useMemo(() => {
    const DOMAIN_START = 0;
    const DOMAIN_END = 24 * 60 * 60;
    const RANGE_START = 1;
    const RANGE_END = height;
    return (t: DateTimeInput) => {
      if (typeof t === 'number') {
        t *= 1000;
      }
      const time = dateTime(t);
      const dayStart = dateTime(t).startOf('d');
      const daySeconds = time.diff(dayStart, 's', false);
      // console.debug(daySeconds / 3600, dayStart.toString(), time.toString());
      return RANGE_START + ((RANGE_END - RANGE_START) * (daySeconds - DOMAIN_START)) / (DOMAIN_END - DOMAIN_START);
    };
  }, [height]);

  const fieldConfig = getFieldConfigWithMinMax(valueField);
  const colorScale = useMemo(
    () => d3.scaleSequential(colorPalette).domain([fieldConfig.min!, fieldConfig.max!] as [number, number]),
    [colorPalette, fieldConfig.min, fieldConfig.max]
  );
  const display = getDisplayProcessor({
    field: valueField,
    theme: useTheme2(),
    timeZone,
  });

  const buckets = useMemo(() => {
    let previous: Bucket | null = null;

    return valueField.values.flatMap((value, i) => {
      const date = dateTime(timeField.values[i]!);
      const time = date.unix();
      const dayStart = dateTime(date).startOf('d');

      const x = Math.floor(xTime(dayStart)!);
      const y = Math.floor(yAxis(time)!);
      const bucket = { time, value, x, y, dayStart };

      // if (previous !== null && previous.time < dayStart.unix()) {
      //   const interBucket = {
      //     time: dayStart.unix(),
      //     value: previous.value,
      //     x: x,
      //     y: yAxis(dayStart)!,
      //     dayStart: dayStart,
      //   };
      //   previous = bucket;
      //   return [interBucket, bucket];
      // }

      previous = bucket;
      return [bucket];
    });
  }, [valueField.values, timeField.values, xTime, yAxis]);

  const cells: (Bucket & { width: number; height: number })[] = useMemo(
    () =>
      buckets.map((bucket, i) => {
        const { x, y, dayStart } = bucket;
        const nextDayX = Math.floor(xTime(dateTime(dayStart).add(1, 'd'))!);
        const dayWidth = 0.5 + nextDayX - x;
        let bucketEnd = timeRange.to.unix();
        if (i + 1 < buckets.length) {
          bucketEnd = buckets[i + 1]!.time - 1;
        }
        const bucketHeight = Math.min(height, 0.5 + yAxis(bucketEnd)!) - y;

        return {
          ...bucket,
          width: dayWidth,
          height: bucketHeight,
        };
      }),
    [buckets, xTime, timeRange.to]
  );

  if (hover) {
    const i = cells.findIndex((b) => b.time === hover.time)!;
    const cell = cells[i]!;
    hoverFrame = (
      <Rect
        x={cell.x}
        y={cell.y}
        width={cell.width}
        height={cell.height}
        fill={'rgba(120, 120, 130, 0.2)'}
        stroke={
          cell.value > (fieldConfig.max! + fieldConfig.min!) / 2
            ? colorScale(fieldConfig.min!)
            : colorScale(fieldConfig.max!)
        }
        // stroke={"rgba(120, 120, 130, 0.5)"}
        dash={[4, 2]}
        strokeWidth={1}
      />
    );
  }

  return (
    <>
      {useMemo(
        () => (
          <Layer onMouseOut={unsetHover}>
            {cells.map((cell) => (
              <Rect
                key={cell.time}
                x={cell.x}
                y={cell.y}
                width={cell.width}
                height={cell.height}
                fill={colorScale(cell.value)}
                data-bucket={cell}
                onMouseOver={hoverCallback}
                perfectDrawEnabled={true}
                strokeEnabled={false}
                strokeWidth={0}
                globalCompositeOperation="copy"
              />
            ))}
          </Layer>
        ),
        [cells, colorScale, unsetHover, hoverCallback]
      )}
      <Layer listening={false}>
        <XAxis x={0} y={height} height={16} width={width} scale={xTime} />
      </Layer>
      <Layer listening={false}>
        {hoverFrame}
        <Html>
          <VizTooltip
            position={hover ?? undefined}
            offset={{ x: 5, y: 5 }}
            content={
              hover ? (
                <SeriesTable
                  timestamp={dateTime(hover?.time * 1000).toISOString()}
                  series={[
                    {
                      label: valueField.name,
                      value: formattedValueToString(display(hover?.value!)!),
                      color: display(hover?.value!)!.color,
                    },
                  ]}
                />
              ) : undefined
            }
          />
        </Html>
      </Layer>
    </>
  );
};

const XAxis: React.FC<{ x: number; y: number; height: number; width: number; scale: ScaleTime<number, number> }> = ({
  x,
  y,
  width,
  scale,
}) => {
  const ticks = scale.ticks();
  ticks.forEach((t) => t.setHours(12));
  const spacing = width / ticks.length;
  const theme = useTheme2();
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  return (
    <>
      <Line points={[x, y, x + width, y]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((date) => {
        const x = scale(date)!;
        const label = date.toLocaleDateString(navigator.language, { month: '2-digit', day: '2-digit' });
        return (
          <Fragment key={label}>
            <Line points={[x, y, x, y + 4]} stroke={colorGrid} strokeWidth={1} />
            <Text
              text={label}
              x={x - spacing / 2}
              y={y + 5}
              fill={colorText}
              align="center"
              fontFamily={theme.typography.fontFamily}
              width={spacing}
              fontSize={theme.typography.htmlFontSize!}
              textBaseline="top"
              wrap="word"
            />
          </Fragment>
        );
      })}
    </>
  );
};
