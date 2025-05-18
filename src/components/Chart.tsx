import {
  dateTime,
  dateTimeForTimeZone,
  formattedValueToString,
  getDisplayProcessor,
  getFieldConfigWithMinMax,
  type DateTime,
  type DateTimeInput,
  type Field,
  type FieldConfig,
  type TimeRange,
} from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import type { ScaleTime } from 'd3';
import * as d3 from 'd3';
import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Rect, Line, Text, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import Konva from 'konva';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';

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
  gapWidth: number;
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
  gapWidth,
}) => {
  Konva.pixelRatio = Math.ceil(useDevicePixelRatio({ round: false, maxDpr: 4 }));

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
    () => d3.scaleUtc().domain([dayFrom, dayTo]).range([0, width]),
    [dayFrom.valueOf(), dayTo.valueOf(), width]
  );

  const yAxis = useMemo(() => {
    const RANGE_START = 1;
    const RANGE_END = height;
    return (t: DateTimeInput) => {
      const timeInMs = typeof t === 'number' ? t * 1000 : t;
      const time = dateTimeForTimeZone(timeZone, timeInMs);
      const dayStart = dateTimeForTimeZone(timeZone, timeInMs).startOf('d');
      const tSecondsInDay = time.diff(dayStart, 's', false);
      const dayEnd = dateTimeForTimeZone(timeZone, timeInMs).endOf('d');
      const daySeconds = dayEnd.diff(dayStart, 's', false);

      return RANGE_START + ((RANGE_END - RANGE_START) * tSecondsInDay) / daySeconds;
    };
  }, [height, timeZone]);

  const fieldConfig = getFieldConfigWithMinMax(valueField) as FieldConfig & { min: number; max: number };
  const colorScale = useMemo(
    () => d3.scaleSequential(colorPalette).domain([fieldConfig.min, fieldConfig.max]),
    [colorPalette, fieldConfig.min, fieldConfig.max]
  );
  const theme = useTheme2();
  const display = getDisplayProcessor({
    field: valueField,
    theme,
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
        const nextDay = dateTime(dayStart).add(1, 'd');
        const nextDayX = Math.floor(xTime(nextDay)!);
        const dayWidth = nextDayX - x;
        let bucketEnd = timeRange.to.unix();
        if (i + 1 < buckets.length) {
          bucketEnd = buckets[i + 1]!.time - 1;
        }
        if (bucketEnd >= nextDay.unix()) {
          bucketEnd = nextDay.unix() - 1;
        }
        const bucketHeight = Math.min(height, yAxis(bucketEnd)!) - y;

        return {
          ...bucket,
          width: dayWidth,
          height: bucketHeight,
        };
      }),
    [buckets, xTime, timeRange.to]
  );

  if (hover) {
    const i = cells.findIndex((b) => b.time === hover.time);
    const cell = cells[i]!;
    hoverFrame = (
      <Rect
        x={cell.x - 0.5}
        y={cell.y}
        width={cell.width + 0.5}
        height={cell.height - 0.5}
        fill={'rgba(120, 120, 130, 0.2)'}
        stroke={
          cell.value > (fieldConfig.min + fieldConfig.max) / 2
            ? colorScale(fieldConfig.min)
            : colorScale(fieldConfig.max)
        }
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
                strokeEnabled={gapWidth > 0}
                strokeWidth={gapWidth}
                stroke={theme.colors.background.primary}
              />
            ))}
          </Layer>
        ),
        [cells, colorScale, unsetHover, hoverCallback, gapWidth]
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
                  timestamp={dateTime(hover?.time * 1000).toLocaleString()}
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
              fontSize={theme.typography.htmlFontSize ?? 16}
              textBaseline="top"
              wrap="word"
            />
          </Fragment>
        );
      })}
    </>
  );
};
