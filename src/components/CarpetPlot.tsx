/* eslint-disable @eslint-react/no-array-index-key -- a band is its position in the stack */
import {
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  type AbsoluteTimeRange,
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
import { SeriesLabel, XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { CarpetBand } from './CarpetBand';
import { getTimeStep, makeCells, makeSpanArea, makeTimeRangeArea, type Area, type Cell } from './makeCells';
import { countDays } from './useTimeScale';
import { traceOutline, type Box } from './traceOutline';
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

interface BandHighlight {
  cells: Array<Cell<CellValue>>;
  /** The region a selection spans, data gaps included; absent outside a selection */
  area?: Area[];
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

/** The cell covering `time`, as all its segments if it is split. */
function findCellsAt(cells: Array<Cell<CellValue>>, time: number): Array<Cell<CellValue>> {
  const cell = cells.find((c) => c.time <= time && time < c.endTime);
  return cell ? cells.filter((c) => c.time === cell.time) : [];
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
  series,
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
  const labelHeight = isStacked ? xAxisHeight : 0;
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
          />
        ))}
      {isStacked &&
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
  const bandHighlights = bandCells.map((cells): BandHighlight => {
    if (hoveredCell && selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart.time);
      const end = Math.max(hoveredCell.time, selectionStart.time);
      const selected = cells.filter((c) => c.time <= end && c.endTime > start);
      const [first, last] = [selected[0], selected.at(-1)];
      return { cells: selected, area: first && last ? makeSpanArea(first, last) : undefined };
    }
    if (hoveredCell) {
      return { cells: findCellsAt(cells, hoveredCell.time) };
    }
    if (externalHover) {
      const { time } = externalHover;
      const cell = cells.find((c) => c.endTime >= time && c.time <= time);
      return { cells: cell ? [cell] : [] };
    }
    return { cells: [] };
  });

  let tooltipBand = validTooltip?.band;
  let tooltipCell = hoveredCell;
  let tooltipPosition = validTooltip?.position;
  if (!hoveredCell && externalHover?.tooltipOrigin) {
    const { tooltipOrigin } = externalHover;
    const band = bandHighlights.findIndex((highlight) => highlight.cells.length > 0);
    const cell = bandHighlights[band]?.cells[0];
    if (cell) {
      tooltipBand = band;
      tooltipCell = cell;
      tooltipPosition = {
        x: tooltipOrigin.x + leftPadding + Math.floor(cell.right * innerWidth),
        y: tooltipOrigin.y + topPadding + bandTop(band) + Math.floor(cell.bottom * bandHeight),
      };
    }
  }
  const tooltipSeries = tooltipBand === undefined ? undefined : series[tooltipBand];

  const getOutlineColor = (cells: Array<Cell<CellValue>>) => {
    if (coloring.kind === 'categories') {
      const firstCell = cells[0];
      return firstCell && theme.colors.getContrastText(cellColor(firstCell.value));
    }
    const { min, max, color } = coloring;
    const highlightedMean = d3.mean(cells, (cell) => cell.value as number) ?? min;
    return highlightedMean > (min + max) / 2 ? color(min) : color(max);
  };
  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
      {bandHighlights.map(({ cells, area }, band) => {
        const highlightBoxes = (area ?? cells).map((a) => snapArea(a, innerWidth, bandHeight));
        const highlightOutline = traceOutline(highlightBoxes);
        return (
          <Shape
            key={band}
            y={bandTop(band)}
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
            stroke={getOutlineColor(cells)}
            dash={[4, 2]}
            strokeWidth={1}
          />
        );
      })}
      <Html>
        <VizTooltip
          position={tooltipMode === TooltipDisplayMode.None ? undefined : tooltipPosition}
          offset={{ x: 5, y: 5 }}
          content={
            tooltipCell && tooltipSeries ? (
              <VizTooltipWrapper className={styles.tooltip}>
                <VizTooltipHeader item={{ label: '', value: dateTimeFormat(tooltipCell.time * 1000, { timeZone }) }} />
                <VizTooltipContent
                  items={[
                    {
                      label: tooltipSeries.name,
                      value: formattedValueToString(
                        getDisplayProcessor({ field: tooltipSeries.valueField, theme, timeZone })(tooltipCell.value)
                      ),
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
