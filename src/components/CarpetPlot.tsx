/* eslint-disable @eslint-react/no-array-index-key -- a band is its position in the stack */
import type { AbsoluteTimeRange, TimeRange } from '@grafana/data';
import { TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import { SortOrder } from '@grafana/schema';
import React, { useMemo } from 'react';
import { Layer } from 'react-konva';
import { SeriesLabel, XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { BandHighlightShape, findBandHighlight, type BandHighlight } from './BandHighlight';
import { CarpetBand } from './CarpetBand';
import { CarpetTooltip } from './CarpetTooltip';
import { getTimeStep, makeCells, makeTimeRangeArea, type Cell } from './makeCells';
import { countDays } from './useTimeScale';
import { snapArea } from './pixelBoxes';
import { getCellColor, type CellColoring } from './useCellColoring';
import type { CellValue } from './categories';
import type { Series } from './series';
import { useCellPointer, type CellHover } from './useCellPointer';
import { useStableItems } from './useStableItems';
import { HourFormat } from '../types';

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

/** Shows the shared tooltip at the first band with a cell at the hovered time. */
function findSharedTooltipTarget(
  bandHighlights: BandHighlight[],
  stageOrigin: { x: number; y: number }
): CellHover | undefined {
  const band = bandHighlights.findIndex((highlight) => highlight.cells.length > 0);
  const cell = bandHighlights[band]?.cells[0];
  return cell && { band, cell, stageOrigin };
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
    () => bandCells.map((cells) => cells.map((cell) => getCellColor(coloring, cell.value))),
    [bandCells, coloring]
  );
  const { hover, selectionStart, layerRef, handleLayerMouseLeave, cellHandlers } = useCellPointer(
    bandCells,
    bandBoxes,
    onHover,
    onChangeTimeRange
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
    <Layer ref={layerRef} onMouseLeave={handleLayerMouseLeave} x={leftPadding} y={topPadding}>
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
          {...cellHandlers}
        />
      ))}
    </Layer>
  );

  const bandHighlights = bandCells.map((cells) =>
    findBandHighlight(cells, hover?.cell, selectionStart, externalHover?.time)
  );
  const tooltipTarget =
    hover ?? (externalHover?.tooltipOrigin && findSharedTooltipTarget(bandHighlights, externalHover.tooltipOrigin));
  /** Places the tooltip at the bottom-right corner of the cell, in client coordinates. */
  const placeTooltip = ({ band, cell, stageOrigin }: CellHover) => {
    if (!stageOrigin) {
      return undefined;
    }
    const { x1, y1 } = snapArea(cell, innerWidth, bandHeight);
    return { x: stageOrigin.x + leftPadding + x1, y: stageOrigin.y + topPadding + bandTop(band) + y1 };
  };

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
        activeBand={hover?.band}
        position={tooltipTarget && placeTooltip(tooltipTarget)}
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
