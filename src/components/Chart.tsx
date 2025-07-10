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
import React, { Fragment, useCallback, useMemo, useState } from 'react';
import { Rect, Line, Text, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import Konva from 'konva';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';

interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
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
      const bucket = currentTarget.getAttr('data-bucket') as Bucket;
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
  const yAxisWidth = 42;

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
    return valueField.values.flatMap((value, i) => {
      const date = dateTime(timeField.values[i]);
      const time = date.unix();
      const dayStart = dateTime(date).startOf('d');

      const x = Math.floor(xTime(dayStart));
      const y = Math.floor(yAxis(time));
      const bucket = { time, value, x, y, dayStart };

      // TODO: Buckets which cross a date boundary should be split for rendering proportionally in either days' column.
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

      return [bucket];
    });
  }, [valueField.values, timeField.values, xTime, yAxis]);

  const cells: (Bucket & { width: number; height: number })[] = useMemo(
    () =>
      buckets.map((bucket, i) => {
        const { x, y, dayStart } = bucket;
        const nextDay = dateTime(dayStart).add(1, 'd');
        const nextDayX = Math.floor(xTime(nextDay));
        const dayWidth = nextDayX - x;
        let bucketEnd = timeRange.to.unix();
        if (i + 1 < buckets.length) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          bucketEnd = buckets[i + 1]!.time - 1;
        }
        if (bucketEnd >= nextDay.unix()) {
          bucketEnd = nextDay.unix() - 1;
        }
        const bucketHeight = Math.min(height, yAxis(bucketEnd)) - y;

        return {
          ...bucket,
          width: dayWidth,
          height: bucketHeight,
        };
      }),
    [buckets, xTime, timeRange.to]
  );

  const hoverCell = cells.find((b) => b.time === hover?.time);
  if (hoverCell) {
    hoverFrame = (
      <Rect
        x={hoverCell.x - 0.5}
        y={hoverCell.y}
        width={hoverCell.width + 0.5}
        height={hoverCell.height - 0.5}
        fill={'rgba(120, 120, 130, 0.2)'}
        stroke={
          hoverCell.value > (fieldConfig.min + fieldConfig.max) / 2
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
          <Layer onMouseOut={unsetHover} x={yAxisWidth} y={8}>
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
      <Layer listening={false} y={8}>
        <XAxis x={yAxisWidth} y={height} height={16} width={width} scale={xTime} />
        <YAxis x={yAxisWidth} y={0} height={height} width={32} />
      </Layer>
      <Layer listening={false} x={yAxisWidth} y={8}>
        {hoverFrame}
        <Html>
          <VizTooltip
            position={hover ?? undefined}
            offset={{ x: 5, y: 5 }}
            content={
              hover ? (
                <SeriesTable
                  // TODO: Check how Grafana does datetime formatting
                  timestamp={dateTime(hover.time * 1000).toLocaleString()}
                  series={[
                    {
                      label: valueField.name,
                      value: formattedValueToString(display(hover.value)),
                      color: display(hover.value).color,
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
        const tickX = scale(date) + x;
        const label = date.toLocaleDateString(navigator.language, { month: '2-digit', day: '2-digit' });
        return (
          <Fragment key={label}>
            <Line points={[tickX, y, tickX, y + 4]} stroke={colorGrid} strokeWidth={1} />
            <Text
              text={label}
              x={tickX - spacing / 2}
              y={y + 5}
              fill={colorText}
              align="center"
              fontFamily={theme.typography.fontFamily}
              width={spacing}
              fontSize={theme.typography.htmlFontSize ?? 16}
              wrap="word"
            />
          </Fragment>
        );
      })}
    </>
  );
};

const YAxis: React.FC<{ x: number; y: number; height: number; width: number }> = ({ x, y, width, height }) => {
  const ticks = Array.from({ length: 25 }, (_, i) => i);
  const theme = useTheme2();
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  const fontSize = theme.typography.htmlFontSize ?? 16;
  const tickMod = Math.ceil(fontSize / (height / 24));
  // TODO ceil to next divisor of 24
  return (
    <>
      <Line points={[x, y, x, y + height]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((hour) => {
        const tickY = y + (hour * height) / 24;
        const label = `${hour.toString()}h`;
        return (
          <Fragment key={label}>
            <Line points={[x, tickY, x - 2, tickY]} stroke={colorGrid} strokeWidth={1} />
            {hour % tickMod === 0 && (
              <>
                <Line points={[x, tickY, x - 4, tickY]} stroke={colorGrid} strokeWidth={1} />
                <Text
                  text={label}
                  x={x - width}
                  y={tickY - fontSize / 2}
                  fill={colorText}
                  align="right"
                  width={width - 5}
                  fontFamily={theme.typography.fontFamily}
                  fontSize={theme.typography.htmlFontSize ?? 16}
                  textBaseline="middle"
                />
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
};
