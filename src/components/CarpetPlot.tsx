import {
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  type AbsoluteTimeRange,
  type Field,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
import {
  TooltipDisplayMode,
  useStyles2,
  useTheme2,
  VizTooltip,
  VizTooltipColorIndicator,
  VizTooltipColorPlacement,
  VizTooltipContent,
  VizTooltipHeader,
  VizTooltipWrapper,
} from '@grafana/ui';
import { css } from '@emotion/css';
import * as d3 from 'd3';
import type Konva from 'konva';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Shape } from 'react-konva';
import { Html } from 'react-konva-utils';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { CarpetBand } from './CarpetBand';
import { getTimeStep, makeCells, makeSpanArea, makeTimeRangeArea, type Area, type Cell } from './makeCells';
import { countDays } from './useTimeScale';
import { traceOutline, type Box } from './traceOutline';
import { findBoxAt, snapArea } from './pixelBoxes';
import { getCellColor, type CellColoring } from './useCellColoring';
import type { CellValue } from './categories';
import { useClientPositionChange } from './useClientPositionChange';
import { HourFormat } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

const SECONDS_PER_DAY = 86400;

/** Widens or narrows `gap` so that the cells between gaps span whole pixels. */
function fitGap(pitch: number, gap: number): number {
  return Math.max(0, pitch - Math.max(1, Math.round(pitch - gap)));
}

export interface ExternalHover {
  time: number;
  /** Client position of the stage; present when a shared tooltip should show */
  tooltipOrigin?: { x: number; y: number };
}

type CellSpan = Pick<Cell, 'time' | 'endTime'>;

interface CellHover {
  idx: number;
  time: number;
  /** Client position of the tooltip; absent while hidden */
  position?: { x: number; y: number };
}

/** Index of the cell under the pointer, from the cells' pixel boxes in the coordinates of `node`; -1 if none. */
function findCellUnderPointer(node: Konva.Node, cellBoxes: Box[]): number {
  const pointer = node.getRelativePointerPosition();
  return pointer ? findBoxAt(cellBoxes, pointer.x, pointer.y) : -1;
}

/** Places the tooltip at the bottom-right corner of the cell's box, in client coordinates. */
function measureCellHover(node: Konva.Node, idx: number, time: number, box: Box): CellHover {
  const origin = node.getAbsolutePosition();
  const container = node.getStage()?.container().getBoundingClientRect();
  return {
    idx,
    time,
    position: container && { x: container.x + origin.x + box.x1, y: container.y + origin.y + box.y1 },
  };
}

interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<CellValue>;
  timeZone: string;
  timeRange: TimeRange;
  coloring: CellColoring;
  gapWidth: number;
  hatchGaps?: boolean;

  showXAxis?: boolean;
  showYAxis?: boolean;
  hourFormat?: HourFormat;
  tooltipMode?: TooltipDisplayMode;
  tooltipMaxWidth?: number;
  onHover?: (cell: Cell<CellValue> | null) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  externalHover?: ExternalHover;
}

const getStyles = (theme: GrafanaTheme2, tooltipMaxWidth?: number) => ({
  // Header and content bring their own padding; cancel VizTooltip's container padding
  tooltip: css({ margin: theme.spacing(-1), maxWidth: tooltipMaxWidth }),
});

export const CarpetPlot: React.FC<ChartProps> = ({
  width,
  height,
  timeRange,
  timeField,
  valueField,
  coloring,
  timeZone,
  gapWidth,
  hatchGaps,
  showXAxis,
  showYAxis,
  hourFormat = HourFormat.Auto,
  tooltipMode = TooltipDisplayMode.Single,
  tooltipMaxWidth,
  onHover,
  onChangeTimeRange,
  externalHover,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles, tooltipMaxWidth);
  const [tooltipData, setTooltipData] = useState<CellHover | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellSpan | null>(null);
  // Keeps the cell handlers stable, so starting a selection does not redraw the cells
  const selectionStartRef = useRef<CellSpan | null>(null);
  const updateSelectionStart = useCallback((start: CellSpan | null) => {
    selectionStartRef.current = start;
    setSelectionStart(start);
  }, []);
  const heatmapLayerRef = useRef<Konva.Layer>(null);

  const handleLayerMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);
  const hideTooltip = useCallback(() => {
    setTooltipData((hover) => (hover?.position ? { idx: hover.idx, time: hover.time } : hover));
  }, []);
  useClientPositionChange(heatmapLayerRef, hideTooltip);

  const cellColor = useCallback((value: CellValue) => getCellColor(coloring, value), [coloring]);
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
  const timeRangeArea = useMemo(() => makeTimeRangeArea(timeZone, timeRange), [timeZone, timeRange]);

  const numDays = useMemo(() => countDays(timeRange, timeZone), [timeRange, timeZone]);
  const rowsPerDay = useMemo(() => SECONDS_PER_DAY / getTimeStep(timeField.values), [timeField.values]);
  const gapX = fitGap(innerWidth / numDays, gapWidth);
  const gapY = Number.isInteger(rowsPerDay) ? fitGap(innerHeight / rowsPerDay, gapWidth) : gapWidth;
  const cellBoxes = useMemo(
    () => cells.map((cell) => snapArea(cell, innerWidth, innerHeight)),
    [cells, innerWidth, innerHeight]
  );
  const cellColors = useMemo(() => cells.map((cell) => cellColor(cell.value)), [cells, cellColor]);

  const handleCellsMouseMove = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      if (evt.buttons !== 1 && selectionStartRef.current) {
        updateSelectionStart(null);
      }
      const idx = findCellUnderPointer(currentTarget, cellBoxes);
      const cell = cells[idx];
      const box = cellBoxes[idx];
      if (!cell || !box) {
        setTooltipData(null);
        return;
      }
      evt.stopPropagation();
      // Keeps the state while the pointer stays within the cell, unless scrolling or resizing hid the tooltip
      setTooltipData((hover) =>
        hover?.idx === idx && hover.time === cell.time && hover.position
          ? hover
          : measureCellHover(currentTarget, idx, cell.time, box)
      );
    },
    [cells, cellBoxes, updateSelectionStart]
  );
  const handleCellsMouseDown = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const cell = cells[findCellUnderPointer(currentTarget, cellBoxes)];
      if (!cell) {
        return;
      }
      evt.stopPropagation();
      updateSelectionStart({ time: cell.time, endTime: cell.endTime });
    },
    [cells, cellBoxes, updateSelectionStart]
  );
  const handleCellsMouseUp = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const end = cells[findCellUnderPointer(currentTarget, cellBoxes)];
      if (!end) {
        return;
      }
      evt.stopPropagation();
      const start = selectionStartRef.current;
      if (start && start.time !== end.time) {
        onChangeTimeRange?.({
          from: Math.min(start.time, end.time) * 1000,
          to: Math.max(start.endTime, end.endTime) * 1000,
        });
      }
      updateSelectionStart(null);
    },
    [cells, cellBoxes, onChangeTimeRange, updateSelectionStart]
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
      {showYAxis && (
        <YAxisIndicator
          x={leftPadding}
          y={topPadding}
          height={innerHeight}
          width={yAxisWidth}
          hourFormat={hourFormat}
        />
      )}
    </Layer>
  );
  const heatmapLayer = (
    <Layer ref={heatmapLayerRef} onMouseLeave={handleLayerMouseLeave} x={leftPadding} y={topPadding}>
      <CarpetBand
        y={0}
        width={innerWidth}
        height={innerHeight}
        cells={cells}
        cellBoxes={cellBoxes}
        cellColors={cellColors}
        timeRangeArea={timeRangeArea}
        gapWidth={gapWidth}
        gapX={gapX}
        gapY={gapY}
        hatchGaps={hatchGaps}
        onCellsMouseMove={handleCellsMouseMove}
        onCellsMouseDown={handleCellsMouseDown}
        onCellsMouseUp={handleCellsMouseUp}
      />
    </Layer>
  );

  // A data refresh under a resting cursor can move another cell to the stored index
  const validTooltip = tooltipData && cells[tooltipData.idx]?.time === tooltipData.time ? tooltipData : undefined;
  const hoveredCell = validTooltip ? cells[validTooltip.idx] : undefined;
  const tooltipShown = validTooltip?.position !== undefined;
  useEffect(() => {
    // Hiding keeps synced tooltips hidden; showing again resends so they reappear
    if (tooltipShown || !hoveredCell) {
      onHover?.(hoveredCell ?? null);
    }
  }, [onHover, hoveredCell, tooltipShown]);
  const highlightedCells: Array<Cell<CellValue>> = [];
  // The selection covers its whole interval, data gaps included
  let selectionArea: Area[] | undefined;
  let tooltipCell = hoveredCell;
  let tooltipPosition = validTooltip?.position;
  if (hoveredCell) {
    if (selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart.time);
      const end = Math.max(hoveredCell.time, selectionStart.time);
      highlightedCells.push(...cells.filter((c) => c.time >= start && c.time <= end));
      const [first, last] = [highlightedCells[0], highlightedCells.at(-1)];
      selectionArea = first && last ? makeSpanArea(first, last) : undefined;
    } else if (hoveredCell.split) {
      highlightedCells.push(...cells.filter((c) => c.time === hoveredCell.time));
    } else {
      highlightedCells.push(hoveredCell);
    }
  } else if (externalHover) {
    const { time, tooltipOrigin } = externalHover;
    const nextCell = cells.find((c) => c.endTime >= time && c.time <= time);
    if (nextCell) {
      highlightedCells.push(nextCell);
      if (tooltipOrigin) {
        tooltipCell = nextCell;
        tooltipPosition = {
          x: tooltipOrigin.x + leftPadding + Math.floor(nextCell.right * innerWidth),
          y: tooltipOrigin.y + topPadding + Math.floor(nextCell.bottom * innerHeight),
        };
      }
    }
  }
  const highlightBoxes = (selectionArea ?? highlightedCells).map((area) => snapArea(area, innerWidth, innerHeight));
  const highlightOutline = traceOutline(highlightBoxes);
  let outlineColor: string | undefined;
  if (coloring.kind === 'categories') {
    const firstCell = highlightedCells[0];
    outlineColor = firstCell && theme.colors.getContrastText(cellColor(firstCell.value));
  } else {
    const { min, max, color } = coloring;
    const highlightedMean = d3.mean(highlightedCells, (cell) => cell.value as number) ?? min;
    outlineColor = highlightedMean > (min + max) / 2 ? color(min) : color(max);
  }
  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
      <Shape
        sceneFunc={(context, shape) => {
          // One fill for all boxes, so the translucency does not stack where they touch
          context.beginPath();
          for (const { x0, y0, x1, y1 } of highlightBoxes) {
            context.rect(x0, y0, x1 - x0, y1 - y0);
          }
          context.fillShape(shape);

          // Centers the 1px stroke on a pixel row for a crisp line
          context.beginPath();
          for (const [x0, y0, x1, y1] of highlightOutline) {
            context.moveTo(x0 - 0.5, y0 - 0.5);
            context.lineTo(x1 - 0.5, y1 - 0.5);
          }
          context.strokeShape(shape);
        }}
        fill={'rgba(120, 120, 130, 0.2)'}
        stroke={outlineColor}
        dash={[4, 2]}
        strokeWidth={1}
      />
      <Html>
        <VizTooltip
          position={tooltipMode === TooltipDisplayMode.None ? undefined : tooltipPosition}
          offset={{ x: 5, y: 5 }}
          content={
            tooltipCell ? (
              <VizTooltipWrapper className={styles.tooltip}>
                <VizTooltipHeader item={{ label: '', value: dateTimeFormat(tooltipCell.time * 1000, { timeZone }) }} />
                <VizTooltipContent
                  items={[
                    {
                      label: valueField.config.displayName || valueField.config.displayNameFromDS || valueField.name,
                      value: formattedValueToString(display(tooltipCell.value)),
                      color: cellColor(tooltipCell.value),
                      colorIndicator: VizTooltipColorIndicator.value,
                      colorPlacement: VizTooltipColorPlacement.trailing,
                    },
                  ]}
                />
              </VizTooltipWrapper>
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
