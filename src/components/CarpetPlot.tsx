import {
  dateTime,
  dateTimeForTimeZone,
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  getMinMaxAndDelta,
  type DateTime,
  type DateTimeInput,
  type Field,
  type TimeRange,
} from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import * as d3 from 'd3';
import React, { useCallback, useMemo, useState } from 'react';
import { Rect, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { useTimeScale } from './useTimeScale';

type ColorPalette = (t: number) => string;
interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
  colorPalette: ColorPalette;
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

function useCells(
  values: (number | null)[],
  timeValues: number[],
  timeZone: string,
  timeRange: TimeRange,
  height: number,
  width: number
): Cell[] {
  'use memo';
  const xTime = useTimeScale(timeRange, width);
  const yAxis = (t: DateTimeInput) => {
    const RANGE_START = 1;
    const RANGE_END = height;
    const timeInMs = typeof t === 'number' ? t * 1000 : t;
    const time = dateTimeForTimeZone(timeZone, timeInMs);
    const dayStart = dateTime(time).startOf('d');
    const tSecondsInDay = time.diff(dayStart, 's', false);
    const dayEnd = dateTime(time).endOf('d');
    const daySeconds = dayEnd.diff(dayStart, 's', false);

    return RANGE_START + ((RANGE_END - RANGE_START) * tSecondsInDay) / daySeconds;
  };

  const timeStep = getTimeStep(timeValues);

  const cells = values.flatMap((value, i) => {
    if (value === null) return [];
    const date = dateTime(timeValues[i]);
    const time = date.unix();
    const dayStart = dateTime(date).startOf('d');

    const x = Math.floor(xTime(dayStart));
    const y = Math.floor(yAxis(time));

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

    const nextDay = dateTime(dayStart).add(1, 'd');
    const nextDayX = Math.floor(xTime(nextDay));
    const dayWidth = nextDayX - x;
    let cellEndTime = time + timeStep;
    if (cellEndTime >= nextDay.unix()) {
      cellEndTime = nextDay.unix() - 1;
    }
    const cellHeight = Math.min(height, yAxis(cellEndTime)) - y;

    return [
      {
        time,
        value,
        x,
        y,
        dayStart,
        width: dayWidth,
        height: cellHeight,
      },
    ];
  });

  return cells;
}

function getTimeStep(timeValues: number[]): number {
  let minInterval = Infinity;
  for (let i = 1; i < timeValues.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Range check above
    const interval = timeValues[i]! - timeValues[i - 1]!;
    if (interval < minInterval) {
      minInterval = interval;
    }
  }
  return minInterval / 1000;
}

function useColorScale(colorPalette: ColorPalette, min: number, max: number) {
  const colorScale = useMemo(() => d3.scaleSequential(colorPalette).domain([min, max]), [min, max, colorPalette]);
  return colorScale;
}

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
  'use memo';
  const [tooltipData, setTooltipData] = useState<{ idx: number; x: number; y: number } | null>(null);

  const handleCellMouseOver = useCallback(({ evt, currentTarget }: { evt: MouseEvent; currentTarget: Konva.Node }) => {
    const cellIdx = currentTarget.getAttr('data-idx') as number;
    const innerRect = currentTarget.getClientRect();
    const outerRect = (evt.target as Element).getBoundingClientRect();
    setTooltipData({
      idx: cellIdx,
      x: innerRect.x + outerRect.x + innerRect.width,
      y: innerRect.y + outerRect.y + innerRect.height,
    });
    evt.stopPropagation();
  }, []);
  const handleCellMouseOut = useCallback(() => {
    setTooltipData(null);
  }, []);

  const yAxisWidth = showYAxis ? 42 : 0;
  const xAxisHeight = showXAxis ? 16 : 0;
  // TODO: Reintroduce a padding of ca. fontSize/2 around the chart.
  // TODO: Make padding configurable in the panel options?

  const minMax = getMinMaxAndDelta(valueField);
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  const colorScale = useColorScale(colorPalette, min, max);
  const theme = useTheme2();
  const display = getDisplayProcessor({
    field: valueField,
    theme,
    timeZone,
  });

  const innerWidth = width - yAxisWidth;
  const innerHeight = height - xAxisHeight;
  const cells = useCells(valueField.values, timeField.values, timeZone, timeRange, innerHeight, innerWidth);

  const axesLayer = (
    <Layer listening={false}>
      {showXAxis && (
        <XAxisIndicator x={yAxisWidth} y={innerHeight} height={xAxisHeight} width={innerWidth} range={timeRange} />
      )}
      {showYAxis && <YAxisIndicator x={yAxisWidth} y={0} height={innerHeight} width={yAxisWidth} />}
    </Layer>
  );
  const heatmapLayer = (
    <Layer onMouseOut={handleCellMouseOut} x={yAxisWidth}>
      {cells.map((cell, idx) => (
        <Rect
          key={cell.time}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          fill={colorScale(cell.value)}
          data-ts={cell.time}
          data-idx={idx}
          onMouseOver={handleCellMouseOver}
          perfectDrawEnabled={true}
          strokeEnabled={gapWidth > 0}
          strokeWidth={gapWidth}
          stroke={theme.colors.background.primary}
        />
      ))}
    </Layer>
  );

  const hoveredCell = tooltipData ? cells[tooltipData?.idx] : undefined;
  const hoverLayer = (
    <Layer listening={false} x={yAxisWidth}>
      {hoveredCell ? (
        <Rect
          x={hoveredCell.x - 0.5}
          y={hoveredCell.y}
          width={hoveredCell.width + 0.5}
          height={hoveredCell.height - 0.5}
          fill={'rgba(120, 120, 130, 0.2)'}
          stroke={hoveredCell.value > (min + max) / 2 ? colorScale(min) : colorScale(max)}
          dash={[4, 2]}
          strokeWidth={1}
        />
      ) : null}
      <Html>
        <VizTooltip
          position={tooltipData ?? undefined}
          offset={{ x: 5, y: 5 }}
          content={
            hoveredCell ? (
              <SeriesTable
                timestamp={dateTimeFormat(hoveredCell.time * 1000, { timeZone })}
                series={[
                  {
                    label: valueField.config.displayName || valueField.config.displayNameFromDS || valueField.name,
                    value: formattedValueToString(display(hoveredCell.value)),
                    color: colorScale(max),
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
