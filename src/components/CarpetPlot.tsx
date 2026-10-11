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
import { makeCells, makeTimeRangeArea, type Cell } from './makeCells';
import { makePlotLayout } from './plotLayout';
import { getCellColor, type CellColoring } from './useCellColoring';
import type { CellValue } from './categories';
import type { Series } from './series';
import { useCellPointer, type CellHover } from './useCellPointer';
import { useStableItems } from './useStableItems';
import { HourFormat } from '../types';

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
  showXAxis = false,
  showYAxis = false,
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

  // The series are rebuilt on every render, so the memos track their values
  const timeLists = useStableItems(series.map((s) => s.timeField.values));
  const valueLists = useStableItems(series.map((s) => s.valueField.values));
  const bandCells = useMemo(
    () => valueLists.map((values, band) => makeCells(values, timeLists[band] ?? [], timeZone, timeRange)),
    [valueLists, timeLists, timeZone, timeRange]
  );
  const timeRangeArea = useMemo(() => makeTimeRangeArea(timeZone, timeRange), [timeZone, timeRange]);

  const fontSize = theme.typography.fontSize;
  const layout = useMemo(
    () =>
      makePlotLayout({
        width,
        height,
        fontSize,
        showXAxis,
        showYAxis,
        showSeriesNames,
        gapWidth,
        bandCells,
      }),
    [width, height, fontSize, showXAxis, showYAxis, showSeriesNames, gapWidth, bandCells]
  );
  const { heatmap } = layout;
  const bandColors = useMemo(
    () => bandCells.map((cells) => cells.map((cell) => getCellColor(coloring, cell.value))),
    [bandCells, coloring]
  );
  const { hover, selectionStart, layerRef, layerHandlers } = useCellPointer(
    bandCells,
    layout,
    onHover,
    onChangeTimeRange
  );

  const axesLayer = (
    <Layer listening={false} x={heatmap.x} y={heatmap.y}>
      {showXAxis && (
        <XAxisIndicator
          x={0}
          y={heatmap.height}
          height={layout.xAxisHeight}
          width={heatmap.width}
          range={timeRange}
          timeZone={timeZone}
        />
      )}
      {showYAxis &&
        layout.bands.map((bandLayout, band) => (
          <YAxisIndicator
            key={band}
            x={0}
            y={bandLayout.y}
            height={bandLayout.height}
            width={layout.yAxisWidth}
            hourFormat={hourFormat}
            showEndLabel={band === layout.bands.length - 1}
          />
        ))}
      {layout.bands.map(
        ({ labelY, width }, band) =>
          labelY !== undefined && (
            <SeriesLabel key={band} x={0} y={labelY} width={width} name={series[band]?.name ?? ''} />
          )
      )}
    </Layer>
  );
  const heatmapLayer = (
    <Layer ref={layerRef} {...layerHandlers} x={heatmap.x} y={heatmap.y}>
      {layout.bands.map((bandLayout, band) => (
        <CarpetBand
          key={band}
          layout={bandLayout}
          cellColors={bandColors[band] ?? []}
          timeRangeArea={timeRangeArea}
          hasGaps={gapWidth > 0}
          hatchGaps={hatchGaps}
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
    const anchor = layout.anchorOf(band, cell);
    return anchor && { x: stageOrigin.x + anchor.x, y: stageOrigin.y + anchor.y };
  };

  const hoverLayer = (
    <Layer listening={false} x={heatmap.x} y={heatmap.y}>
      {layout.bands.map((bandLayout, band) => {
        const highlight = bandHighlights[band];
        return highlight && <BandHighlightShape key={band} layout={bandLayout} coloring={coloring} {...highlight} />;
      })}
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
