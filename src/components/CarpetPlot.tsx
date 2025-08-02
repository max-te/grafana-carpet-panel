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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Rect, Layer, Ellipse } from 'react-konva';
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

type Cell = {
  time: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
  split?: number;
};

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
    const nextDay = dateTime(dayStart).add(1, 'd');
    const nextDayX = Math.floor(xTime(nextDay));
    const dayWidth = nextDayX - x;
    let cellEndTime = time + timeStep;

    const TIME_EPS = 60;
    const cell: Cell = {
      time,
      value,
      x,
      y,
      width: dayWidth,
      height: cellEndTime < nextDay.unix() ? yAxis(cellEndTime) - y : height - y,
    };

    // Cell crosses date boundary and should be split across two columns
    // TODO: add really low resolutions a cell *could* span more than a full day
    if (cellEndTime - nextDay.unix() > TIME_EPS) {
      cell.split = 1;
      const nextDayWidth = Math.floor(xTime(dateTime(nextDay).add(1, 'd'))) - nextDayX;
      const secondCell: Cell = {
        time,
        value,
        x: nextDayX,
        y: 0,
        width: nextDayWidth,
        height: yAxis(cellEndTime),
        split: -1,
      };
      return [cell, secondCell];
    }
    return [cell];
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
  const theme = useTheme2();
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
  const cells = useCells(valueField.values, timeField.values, timeZone, timeRange, innerHeight, innerWidth);

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
          key={cell.time + (cell.split ? cell.split.toFixed(0) : '')}
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
  const splitCell = hoveredCell?.split ? cells[(tooltipData?.idx ?? 0) + hoveredCell.split] : undefined;
  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
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
      {splitCell ? ( // TODO: unify with above, signify open sides
        <Rect
          x={splitCell.x - 0.5}
          y={splitCell.y}
          width={splitCell.width + 0.5}
          height={splitCell.height - 0.5}
          fill={'rgba(120, 120, 130, 0.2)'}
          stroke={splitCell.value > (min + max) / 2 ? colorScale(min) : colorScale(max)}
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
