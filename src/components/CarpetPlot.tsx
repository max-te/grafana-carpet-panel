/* eslint-disable @eslint-react/no-array-index-key -- a band is its position in the stack */
import type { AbsoluteTimeRange, TimeRange } from '@grafana/data';
import { TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import { SortOrder } from '@grafana/schema';
import type Konva from 'konva';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer } from 'react-konva';
import { SeriesLabel, XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { BandHighlightShape, findBandHighlight } from './BandHighlight';
import { CarpetBand } from './CarpetBand';
import { CarpetTooltip } from './CarpetTooltip';
import { getTimeStep, makeCells, makeTimeRangeArea, type Cell } from './makeCells';
import { countDays } from './useTimeScale';
import type { Box } from './traceOutline';
import { findBoxAt, snapArea } from './pixelBoxes';
import { getCellColor, type CellColoring } from './useCellColoring';
import type { CellValue } from './categories';
import type { Series } from './series';
import { useClientPositionChange } from './useClientPositionChange';
import { useStableItems } from './useStableItems';
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
  band: number;
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
function measureCellHover(node: Konva.Node, band: number, idx: number, time: number, box: Box): CellHover {
  const origin = node.getAbsolutePosition();
  const container = node.getStage()?.container().getBoundingClientRect();
  return {
    band,
    idx,
    time,
    position: container && { x: container.x + origin.x + box.x1, y: container.y + origin.y + box.y1 },
  };
}

interface ChartProps {
  width: number;
  height: number;

  /** One band each, stacked top to bottom */
  series: Series[];
  timeZone: string;
  timeRange: TimeRange;
  coloring: CellColoring;
  gapWidth: number;
  hatchGaps?: boolean;

  showXAxis?: boolean;
  showYAxis?: boolean;
  hourFormat?: HourFormat;
  /** Labels each band when there are several */
  showSeriesNames?: boolean;
  tooltipMode?: TooltipDisplayMode;
  /** Order of the series in the tooltip listing all of them */
  tooltipSort?: SortOrder;
  tooltipMaxWidth?: number;
  tooltipMaxHeight?: number;
  onHover?: (cell: Cell<CellValue> | null) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  externalHover?: ExternalHover;
}

export const CarpetPlot: React.FC<ChartProps> = ({
  width,
  height,
  timeRange,
  series,
  coloring,
  timeZone,
  gapWidth,
  hatchGaps,
  showXAxis,
  showYAxis,
  hourFormat = HourFormat.Auto,
  showSeriesNames = true,
  tooltipMode = TooltipDisplayMode.Single,
  tooltipSort = SortOrder.None,
  tooltipMaxWidth,
  tooltipMaxHeight,
  onHover,
  onChangeTimeRange,
  externalHover,
}) => {
  const theme = useTheme2();
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
    setTooltipData((hover) => (hover?.position ? { band: hover.band, idx: hover.idx, time: hover.time } : hover));
  }, []);
  useClientPositionChange(heatmapLayerRef, hideTooltip);

  const cellColor = useCallback((value: CellValue) => getCellColor(coloring, value), [coloring]);

  const padding = theme.typography.fontSize / 2;
  const topPadding = showYAxis ? padding : 0;

  const yAxisWidth = theme.typography.fontSize * 3;
  const leftPadding = showYAxis ? yAxisWidth : padding;
  const xAxisHeight = theme.typography.fontSize * 1.5;
  const bottomPadding = showXAxis ? xAxisHeight : showYAxis ? padding : 0;

  const innerWidth = width - leftPadding;
  const innerHeight = height - bottomPadding - topPadding;

  // A lone series needs no label, and keeps the whole plot to itself
  const isStacked = series.length > 1;
  const isLabelled = isStacked && showSeriesNames;
  const labelHeight = isLabelled ? xAxisHeight : 0;
  const bandSpacing = isStacked ? padding : 0;
  const bandHeight = Math.max(
    0,
    Math.floor((innerHeight - (series.length - 1) * bandSpacing) / series.length - labelHeight)
  );
  const bandTop = (band: number) => band * (labelHeight + bandHeight + bandSpacing) + labelHeight;

  // The series are rebuilt on every render, so the memos track their values
  const timeLists = useStableItems(series.map((s) => s.timeField.values));
  const valueLists = useStableItems(series.map((s) => s.valueField.values));
  const bandCells = useMemo(
    () => valueLists.map((values, band) => makeCells(values, timeLists[band] ?? [], timeZone, timeRange)),
    [valueLists, timeLists, timeZone, timeRange]
  );
  const timeRangeArea = useMemo(() => makeTimeRangeArea(timeZone, timeRange), [timeZone, timeRange]);

  const numDays = useMemo(() => countDays(timeRange, timeZone), [timeRange, timeZone]);
  const bandRowsPerDay = useMemo(() => timeLists.map((times) => SECONDS_PER_DAY / getTimeStep(times)), [timeLists]);
  const gapX = fitGap(innerWidth / numDays, gapWidth);
  const bandGapY = bandRowsPerDay.map((rowsPerDay) =>
    Number.isInteger(rowsPerDay) ? fitGap(bandHeight / rowsPerDay, gapWidth) : gapWidth
  );
  const bandBoxes = useMemo(
    () => bandCells.map((cells) => cells.map((cell) => snapArea(cell, innerWidth, bandHeight))),
    [bandCells, innerWidth, bandHeight]
  );
  const bandColors = useMemo(
    () => bandCells.map((cells) => cells.map((cell) => cellColor(cell.value))),
    [bandCells, cellColor]
  );

  const handleCellsMouseMove = useCallback(
    (band: number, { evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      if (evt.buttons !== 1 && selectionStartRef.current) {
        updateSelectionStart(null);
      }
      const cellBoxes = bandBoxes[band] ?? [];
      const idx = findCellUnderPointer(currentTarget, cellBoxes);
      const cell = bandCells[band]?.[idx];
      const box = cellBoxes[idx];
      if (!cell || !box) {
        setTooltipData(null);
        return;
      }
      evt.stopPropagation();
      // Keeps the state while the pointer stays within the cell, unless scrolling or resizing hid the tooltip
      setTooltipData((hover) =>
        hover?.band === band && hover.idx === idx && hover.time === cell.time && hover.position
          ? hover
          : measureCellHover(currentTarget, band, idx, cell.time, box)
      );
    },
    [bandCells, bandBoxes, updateSelectionStart]
  );
  const handleCellsMouseDown = useCallback(
    (band: number, { evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const cell = bandCells[band]?.[findCellUnderPointer(currentTarget, bandBoxes[band] ?? [])];
      if (!cell) {
        return;
      }
      evt.stopPropagation();
      updateSelectionStart({ time: cell.time, endTime: cell.endTime });
    },
    [bandCells, bandBoxes, updateSelectionStart]
  );
  const handleCellsMouseUp = useCallback(
    (band: number, { evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const end = bandCells[band]?.[findCellUnderPointer(currentTarget, bandBoxes[band] ?? [])];
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
    [bandCells, bandBoxes, onChangeTimeRange, updateSelectionStart]
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
      {showYAxis &&
        series.map((_, band) => (
          <YAxisIndicator
            key={band}
            x={leftPadding}
            y={topPadding + bandTop(band)}
            height={bandHeight}
            width={yAxisWidth}
            hourFormat={hourFormat}
            showEndLabel={band === series.length - 1}
          />
        ))}
      {isLabelled &&
        series.map(({ name }, band) => (
          <SeriesLabel
            key={band}
            x={leftPadding}
            y={topPadding + bandTop(band) - labelHeight / 2}
            width={innerWidth}
            name={name}
          />
        ))}
    </Layer>
  );
  const heatmapLayer = (
    <Layer ref={heatmapLayerRef} onMouseLeave={handleLayerMouseLeave} x={leftPadding} y={topPadding}>
      {bandCells.map((cells, band) => (
        <CarpetBand
          key={band}
          band={band}
          y={bandTop(band)}
          width={innerWidth}
          height={bandHeight}
          cells={cells}
          cellBoxes={bandBoxes[band] ?? []}
          cellColors={bandColors[band] ?? []}
          timeRangeArea={timeRangeArea}
          gapWidth={gapWidth}
          gapX={gapX}
          gapY={bandGapY[band] ?? gapWidth}
          hatchGaps={hatchGaps}
          onCellsMouseMove={handleCellsMouseMove}
          onCellsMouseDown={handleCellsMouseDown}
          onCellsMouseUp={handleCellsMouseUp}
        />
      ))}
    </Layer>
  );

  // A data refresh under a resting cursor can move another cell to the stored index
  const validTooltip =
    tooltipData && bandCells[tooltipData.band]?.[tooltipData.idx]?.time === tooltipData.time ? tooltipData : undefined;
  const hoveredCell = validTooltip ? bandCells[validTooltip.band]?.[validTooltip.idx] : undefined;
  const tooltipShown = validTooltip?.position !== undefined;
  useEffect(() => {
    // Hiding keeps synced tooltips hidden; showing again resends so they reappear
    if (tooltipShown || !hoveredCell) {
      onHover?.(hoveredCell ?? null);
    }
  }, [onHover, hoveredCell, tooltipShown]);
  const bandHighlights = bandCells.map((cells) =>
    findBandHighlight(cells, hoveredCell, selectionStart, externalHover?.time)
  );

  let tooltipTarget = hoveredCell && validTooltip && { band: validTooltip.band, cell: hoveredCell };
  let tooltipPosition = validTooltip?.position;
  if (!hoveredCell && externalHover?.tooltipOrigin) {
    const { tooltipOrigin } = externalHover;
    const band = bandHighlights.findIndex((highlight) => highlight.cells.length > 0);
    const cell = bandHighlights[band]?.cells[0];
    if (cell) {
      tooltipTarget = { band, cell };
      tooltipPosition = {
        x: tooltipOrigin.x + leftPadding + Math.floor(cell.right * innerWidth),
        y: tooltipOrigin.y + topPadding + bandTop(band) + Math.floor(cell.bottom * bandHeight),
      };
    }
  }

  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
      {bandHighlights.map((highlight, band) => (
        <BandHighlightShape
          key={band}
          y={bandTop(band)}
          width={innerWidth}
          height={bandHeight}
          coloring={coloring}
          {...highlight}
        />
      ))}
      <CarpetTooltip
        series={series}
        bandCells={bandCells}
        target={tooltipTarget}
        activeBand={validTooltip?.band}
        position={tooltipPosition}
        coloring={coloring}
        timeZone={timeZone}
        mode={tooltipMode}
        sort={tooltipSort}
        maxWidth={tooltipMaxWidth}
        maxHeight={tooltipMaxHeight}
      />
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
