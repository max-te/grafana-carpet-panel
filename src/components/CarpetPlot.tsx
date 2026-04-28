import {
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  getMinMaxAndDelta,
  type AbsoluteTimeRange,
  type Field,
  type TimeRange,
} from '@grafana/data';
import { SeriesTable, useTheme2, VizTooltip } from '@grafana/ui';
import * as d3 from 'd3';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Rect, Layer } from 'react-konva';
import { Html } from 'react-konva-utils';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { makeCells, type Cell } from './makeCells';
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
  externalHoverTime?: number;
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
  externalHoverTime,
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
          timeZone={timeZone}
        />
      )}
      {showYAxis && <YAxisIndicator x={leftPadding} y={topPadding} height={innerHeight} width={yAxisWidth} />}
    </Layer>
  );
  const heatmapLayer = useMemo(
    () => (
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
    ),
    [
      cells,
      innerWidth,
      innerHeight,
      handleCellMouseDown,
      handleCellMouseOver,
      handleCellMouseUp,
      gapWidth,
      theme.colors.background.primary,
      colorScale,
      leftPadding,
      topPadding,
    ]
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
  } else if (externalHoverTime) {
    const nextCell = cells.find((c) => c.endTime >= externalHoverTime && c.time <= externalHoverTime);
    if (nextCell) {
      highlightedCells.push(nextCell);
      // TODO: shared tooltip (needs position of cell in client rect)
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
