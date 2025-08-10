import {
  dateTime,
  dateTimeForTimeZone,
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  getMinMaxAndDelta,
  type AbsoluteTimeRange,
  type DateTimeInput,
  type Field,
  type TimeRange,
} from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import * as d3 from 'd3';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Rect, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { makeTimeScale } from './useTimeScale';
import type { KonvaEventObject } from 'konva/lib/Node';

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
  onHover?: (cell: Cell | null) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
}

type Cell = {
  time: number;
  value: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  split?: number;
};

function makeCells(
  values: (number | null)[],
  timeValues: number[],
  timeZone: string,
  timeRange: TimeRange,
  height: number = 1,
  width: number = 1
): Cell[] {
  const xTime = makeTimeScale(timeRange, width);
  const yAxis = (t: DateTimeInput) => {
    const timeInMs = typeof t === 'number' ? t * 1000 : t;
    const time = dateTimeForTimeZone(timeZone, timeInMs);
    const dayStart = dateTime(time).startOf('d');
    const tSecondsInDay = time.diff(dayStart, 's', false);
    const dayEnd = dateTime(time).endOf('d');
    const daySeconds = dayEnd.diff(dayStart, 's', false);

    return (height * tSecondsInDay) / daySeconds;
  };

  const timeStep = getTimeStep(timeValues);
  const cells: Cell[] = [];

  let dayStart = dateTime(0),
    nextDay = dayStart;
  let dayWidth = 0,
    x = 0,
    nextDayX = 0;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === null || value === undefined) continue;
    const date = dateTime(timeValues[i]);
    const time = date.unix();

    while (time >= nextDay.unix()) {
      dayStart = dayStart === nextDay ? dateTime(date).startOf('d') : nextDay;
      nextDay = dateTime(dayStart).add(1, 'd');
      x = nextDayX;
      nextDayX = xTime(nextDay);
      dayWidth = nextDayX - x;
    }

    const y = yAxis(time);
    const cellEndTime = time + timeStep;

    const TIME_EPS = 60;
    const cell: Cell = {
      time,
      value,
      left: x,
      top: y,
      right: x + dayWidth,
      bottom: cellEndTime < nextDay.unix() ? yAxis(cellEndTime) : height,
    };
    cells.push(cell);

    // Cell crosses date boundary and should be split across two columns
    // TODO: add really low resolutions a cell *could* span more than a full day
    if (cellEndTime - nextDay.unix() > TIME_EPS) {
      cell.split = 1;
      dayStart = nextDay;
      nextDay = dateTime(dayStart).add(1, 'd');
      x = nextDayX;
      nextDayX = xTime(nextDay);
      dayWidth = nextDayX - x;

      const secondCell: Cell = {
        time,
        value,
        left: x,
        top: 0,
        right: x + dayWidth,
        bottom: yAxis(cellEndTime),
        split: -1,
      };
      cells.push(secondCell);
    }
  }

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
  onHover,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();
  const [tooltipData, setTooltipData] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);

  const handleCellMouseOver = useCallback(({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
    evt.stopPropagation();
    const cellIdx = currentTarget.getAttr('data-idx') as number;
    const innerRect = currentTarget.getClientRect();
    const outerRect = (evt.target as Element).getBoundingClientRect();
    setTooltipData({
      idx: cellIdx,
      x: innerRect.x + outerRect.x + innerRect.width,
      y: innerRect.y + outerRect.y + innerRect.height,
    });
    if (evt.buttons !== 1) setSelectionStart(null);
  }, []);
  const handleCellMouseOut = useCallback(() => {
    setTooltipData(null);
  }, []);
  const handleCellMouseDown = useCallback(({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
    evt.stopPropagation();
    const cellTs = currentTarget.getAttr('data-ts') as number;
    setSelectionStart(cellTs);
  }, []);
  const handleCellMouseUp = useCallback(({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
    evt.stopPropagation();
    const end = currentTarget.getAttr('data-ts') as number;
    setSelectionStart((start) => {
      if (typeof start === 'number' && typeof end === 'number' && start != end) {
        onChangeTimeRange?.({
          from: Math.min(start, end) * 1000,
          to: Math.max(start, end) * 1000,
        });
      }
      return null;
    });
  }, []);

  const minMax = getMinMaxAndDelta(valueField);
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  const colorScale = useColorScale(colorPalette, min, max);
  const display = getDisplayProcessor({
    field: valueField,
    theme,
    timeZone,
  });

  const padding = theme.typography.fontSize / 2;
  const topPadding = showYAxis ? padding : 0;

  const yAxisWidth = theme.typography.fontSize * 3;
  const leftPadding = showYAxis ? yAxisWidth : padding;
  const xAxisHeight = theme.typography.fontSize * 1.5;
  const bottomPadding = showXAxis ? xAxisHeight : showYAxis ? padding : 0;

  const innerWidth = width - leftPadding;
  const innerHeight = height - bottomPadding - topPadding;
  const cells = useMemo(
    () => makeCells(valueField.values, timeField.values, timeZone, timeRange),
    [valueField.values, timeField.values, timeZone, timeRange]
  );

  const axesLayer = (
    <Layer listening={false}>
      {showXAxis && (
        <XAxisIndicator
          x={leftPadding}
          y={innerHeight + topPadding}
          height={xAxisHeight}
          width={innerWidth}
          range={timeRange}
        />
      )}
      {showYAxis && <YAxisIndicator x={leftPadding} y={topPadding} height={innerHeight} width={yAxisWidth} />}
    </Layer>
  );
  const heatmapLayer = (
    <Layer onMouseOut={handleCellMouseOut} x={leftPadding} y={topPadding}>
      {cells.map((cell, idx) => (
        <Rect
          key={cell.time.toFixed(0) + (cell.split ? cell.split.toFixed(0) : '')}
          x={Math.floor(cell.left * innerWidth)}
          y={Math.floor(cell.top * innerHeight)}
          width={Math.floor(cell.right * innerWidth) - Math.floor(cell.left * innerWidth)}
          height={Math.floor(cell.bottom * innerHeight) - Math.floor(cell.top * innerHeight)}
          fill={colorScale(cell.value)}
          data-ts={cell.time}
          data-idx={idx}
          onMouseOver={handleCellMouseOver}
          onMouseDown={handleCellMouseDown}
          onMouseUp={handleCellMouseUp}
          perfectDrawEnabled={true}
          strokeEnabled={gapWidth > 0}
          strokeWidth={gapWidth}
          stroke={theme.colors.background.primary}
        />
      ))}
    </Layer>
  );

  const hoveredCell = tooltipData ? cells[tooltipData.idx] : undefined;
  useEffect(() => {
    onHover?.(hoveredCell ?? null);
  }, [onHover, hoveredCell]);
  const highlightedCells: Cell[] = [];
  if (hoveredCell) {
    if (selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart);
      const end = Math.max(hoveredCell.time, selectionStart);
      highlightedCells.push(...cells.filter((c) => c.time >= start && c.time <= end));
    } else {
      highlightedCells.push(hoveredCell);
      if (hoveredCell.split) {
        const splitCell = cells[(tooltipData?.idx ?? 0) + hoveredCell.split];
        if (splitCell) highlightedCells.push(splitCell);
      }
    }
  }
  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
      {highlightedCells.map((cell) => (
        <Rect
          key={cell.time.toFixed(0) + (cell.split ? cell.split.toFixed(0) : '')}
          x={cell.left * innerWidth - 0.5}
          y={cell.top * innerHeight}
          width={innerWidth * (cell.right - cell.left) + 0.5}
          height={innerHeight * (cell.bottom - cell.top) - 0.5}
          fill={'rgba(120, 120, 130, 0.2)'}
          stroke={cell.value > (min + max) / 2 ? colorScale(min) : colorScale(max)}
          dash={[4, 2]}
          strokeWidth={1}
        />
      ))}
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
