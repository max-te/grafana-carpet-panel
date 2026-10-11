/* eslint-disable @eslint-react/no-array-index-key -- a band is its position in the stack */
import type { AbsoluteTimeRange, TimeRange } from '@grafana/data';
import { TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import { SortOrder } from '@grafana/schema';
import React, { useMemo } from 'react';
import { Layer } from 'react-konva';
import { SeriesLabel, XAxisIndicator, YAxisIndicator } from '../axes/AxisLabels';
import { BandHighlightShape } from './BandHighlight';
import { CarpetBand } from './CarpetBand';
import { CarpetTooltip } from './CarpetTooltip';
import { makeCells, makeTimeRangeArea, type Cell } from './makeCells';
import { makeCalendar } from '../time/calendar';
import { makePlotLayout } from './plotLayout';
import { getCellColor, type CellColoring } from '../color/useCellColoring';
import type { CellValue } from '../color/categories';
import type { Series } from '../series';
import { useCellPointer } from './useCellPointer';
import {
  selectBandHighlights,
  selectHover,
  selectTooltipTarget,
  type CellHover,
  type ExternalHover,
} from './pointerInteraction';
import { useStableItems } from '../hooks/useStableItems';
import { HourFormat } from '../types';

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

  const calendar = useMemo(() => makeCalendar(timeRange, timeZone), [timeRange, timeZone]);
  // The series are rebuilt on every render, so the memos track their values
  const timeLists = useStableItems(series.map((s) => s.timeField.values));
  const valueLists = useStableItems(series.map((s) => s.valueField.values));
  const bandCells = useMemo(
    () => valueLists.map((values, band) => makeCells(values, timeLists[band] ?? [], calendar)),
    [valueLists, timeLists, calendar]
  );
  const timeRangeArea = useMemo(() => makeTimeRangeArea(calendar), [calendar]);

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
  const {
    state: pointerState,
    layerRef,
    layerHandlers,
  } = useCellPointer(bandCells, layout, externalHover, onHover, onChangeTimeRange);

  const axesLayer = (
    <Layer listening={false} x={heatmap.x} y={heatmap.y}>
      {showXAxis && (
        <XAxisIndicator
          x={0}
          y={heatmap.height}
          height={layout.xAxisHeight}
          width={heatmap.width}
          calendar={calendar}
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

  const hover = selectHover(pointerState, bandCells);
  const bandHighlights = selectBandHighlights(pointerState, bandCells);
  const tooltipTarget = selectTooltipTarget(pointerState, bandCells);
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
