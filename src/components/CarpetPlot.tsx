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
import React, { useCallback, useMemo, useState } from 'react';
import { Rect, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';

interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
  colorPalette: (t: number) => string;
  gapWidth: number;

  showXAxis?: boolean;
  showYAxis?: boolean;
}

type CellData = {
  time: number;
  value: number;
  x: number;
  y: number;
  dayStart: DateTime;
};

type Cell = CellData & { width: number; height: number };

// TODO: Consider extracting this hook into a separate file for better code organization and testability
const useCells = (
  valueField: Field<number | null>,
  timeField: Field<number>,
  xTime: ScaleTime<number, number>,
  timeZone: string,
  timeRange: TimeRange,
  // TODO(cleanup): Remove height parameter, use 0-1 coordinates and scale when drawing
  height: number
): Cell[] => {
  const yAxis = useMemo(() => {
    const RANGE_START = 1;
    const RANGE_END = height;
    return (t: DateTimeInput) => {
      const timeInMs = typeof t === 'number' ? t * 1000 : t;
      const time = dateTimeForTimeZone(timeZone, timeInMs);
      const dayStart = dateTime(time).startOf('d');
      const tSecondsInDay = time.diff(dayStart, 's', false);
      const dayEnd = dateTime(time).endOf('d');
      const daySeconds = dayEnd.diff(dayStart, 's', false);

      return RANGE_START + ((RANGE_END - RANGE_START) * tSecondsInDay) / daySeconds;
    };
  }, [height, timeZone]);

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

  const timeStep: number = getMinInterval(buckets);
  const cells = useMemo(
    // TODO: Merge these `useMemo`s
    () =>
      buckets
        .map((bucket) => {
          const { x, y, dayStart } = bucket;
          const nextDay = dateTime(dayStart).add(1, 'd');
          const nextDayX = Math.floor(xTime(nextDay));
          const dayWidth = nextDayX - x;
          let bucketEnd = bucket.time + timeStep;
          if (bucketEnd >= nextDay.unix()) {
            bucketEnd = nextDay.unix() - 1;
          }
          const bucketHeight = Math.min(height, yAxis(bucketEnd)) - y;

          return {
            ...bucket,
            width: dayWidth,
            height: bucketHeight,
          };
        })
        .filter((cell) => cell.value !== null),
    [buckets, xTime, timeRange.to, height]
  ) as Cell[];

  return cells;
};

const getMinInterval = (points: { time: number }[]) => {
  let minInterval = Infinity;
  for (let i = 1; i < points.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const interval = points[i]!.time - points[i - 1]!.time;
    if (interval < minInterval) {
      minInterval = interval;
    }
  }
  return minInterval;
};

const useStableDateTimeValue = (dt: DateTime): DateTime => {
  const dtVal = dt.valueOf();
  return useMemo(() => Object.freeze(dateTime(dtVal)), [dtVal]);
};

const useTimeScale = (timeRange: TimeRange, width: number): ScaleTime<number, number> => {
  const dayFromValue = useStableDateTimeValue(timeRange.from);
  const dayToValue = useStableDateTimeValue(timeRange.to);
  const dayFrom = useMemo(() => dateTime(dayFromValue).startOf('day').toDate(), [dayFromValue]);
  const dayTo = useMemo(() => dateTime(dayToValue).endOf('day').toDate(), [dayToValue]);
  const numDays = useMemo(() => 1 + d3.timeDay.count(dayFrom, dayTo), [dayFrom, dayTo]);
  if (numDays <= 0) {
    throw new Error('Negative time range');
  }

  const xTime = useMemo(() => d3.scaleUtc().domain([dayFrom, dayTo]).range([0, width]), [dayFrom, dayTo, width]);

  return xTime;
};

export const CarpetPlot: React.FC<ChartProps> = ({
  width,
  height,
  timeRange,
  timeField,
  valueField,
  colorPalette,
  timeZone,
  gapWidth,
  showXAxis,
  showYAxis,
}) => {
  const [hoveredCellData, setHoveredCellData] = useState<CellData | null>(null);

  const handleCellMouseOver = useCallback(({ evt, currentTarget }: { evt: MouseEvent; currentTarget: Konva.Node }) => {
    const cellData = currentTarget.getAttr('data-bucket') as CellData;
    const innerRect = currentTarget.getClientRect();
    const outerRect = (evt.target as Element).getBoundingClientRect();
    setHoveredCellData({
      ...cellData,
      x: innerRect.x + outerRect.x + innerRect.width,
      y: innerRect.y + outerRect.y + innerRect.height,
    });
    evt.stopPropagation();
  }, []);
  const handleCellMouseOut = useCallback(() => {
    setHoveredCellData(null);
  }, []);

  const yAxisWidth = showYAxis ? 42 : 0;
  const xAxisHeight = showXAxis ? 16 : 0;
  // TODO: Reintroduce a padding of ca. fontSize/2 around the chart.
  // TODO: Make padding configurable in the panel options?

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

  const xTime = useTimeScale(timeRange, width - yAxisWidth);

  const axesLayer = (
    <Layer listening={false}>
      {showXAxis && (
        <XAxisIndicator
          x={yAxisWidth}
          y={height - xAxisHeight}
          height={xAxisHeight}
          width={width - yAxisWidth}
          scale={xTime}
        />
      )}
      {showYAxis && <YAxisIndicator x={yAxisWidth} y={0} height={height - xAxisHeight} width={yAxisWidth} />}
    </Layer>
  );

  const cells = useCells(valueField, timeField, xTime, timeZone, timeRange, height - xAxisHeight);

  const heatmapLayer = useMemo(
    () => (
      <Layer onMouseOut={handleCellMouseOut} x={yAxisWidth} width={width - yAxisWidth} height={height - xAxisHeight}>
        {cells.map((cell) => (
          <Rect
            key={cell.time}
            x={cell.x}
            y={cell.y}
            width={cell.width}
            height={cell.height}
            fill={colorScale(cell.value)}
            data-bucket={cell}
            onMouseOver={handleCellMouseOver}
            perfectDrawEnabled={true}
            strokeEnabled={gapWidth > 0}
            strokeWidth={gapWidth}
            stroke={theme.colors.background.primary}
          />
        ))}
      </Layer>
    ),
    [cells, colorScale, handleCellMouseOut, handleCellMouseOver, gapWidth]
  );

  const hoveredCell = cells.find((b) => b.time === hoveredCellData?.time);
  const hoverLayer = (
    <Layer listening={false} x={yAxisWidth}>
      {hoveredCell ? (
        <Rect
          x={hoveredCell.x - 0.5}
          y={hoveredCell.y}
          width={hoveredCell.width + 0.5}
          height={hoveredCell.height - 0.5}
          fill={'rgba(120, 120, 130, 0.2)'}
          stroke={
            hoveredCell.value > (fieldConfig.min + fieldConfig.max) / 2
              ? colorScale(fieldConfig.min)
              : colorScale(fieldConfig.max)
          }
          dash={[4, 2]}
          strokeWidth={1}
        />
      ) : null}
      <Html>
        <VizTooltip
          position={hoveredCellData ?? undefined}
          offset={{ x: 5, y: 5 }}
          content={
            hoveredCellData ? (
              <SeriesTable
                // TODO: Check how Grafana does datetime formatting
                timestamp={dateTime(hoveredCellData.time * 1000)
                  .toDate()
                  .toLocaleString(undefined, {
                    // timeZone: timeZone,
                    timeStyle: 'long',
                    dateStyle: 'medium',
                  })}
                series={[
                  {
                    label: valueField.name,
                    value: formattedValueToString(display(hoveredCellData.value)),
                    color: display(hoveredCellData.value).color,
                  },
                ]}
              />
            ) : undefined
          }
        />
      </Html>
    </Layer>
  );

  return (
    <>
      {heatmapLayer}
      {axesLayer}
      {hoverLayer}
    </>
  );
};
