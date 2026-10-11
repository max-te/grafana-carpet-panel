import { VizLayout } from '@grafana/ui';
import type Konva from 'konva';
import React, { useRef } from 'react';
import { Stage } from 'react-konva';
import type { CellValue } from '../color/categories';
import { CategoryLegend } from '../color/CategoryLegend';
import { ColorLegend } from '../color/ColorLegend';
import { useCellColoring } from '../color/useCellColoring';
import { CarpetPlot } from '../plot/CarpetPlot';
import type { Series } from '../series';
import type { Props } from './CarpetPanel';
import { useDashboardHoverEvents } from './useDashboardHoverEvents';
import { useKonvaDpr } from './useKonvaDpr';

type ViewProps = Pick<Props, 'options' | 'width' | 'height' | 'timeRange' | 'timeZone' | 'onChangeTimeRange'> & {
  /** At least one; all share the value type */
  series: Series[];
};
export const CarpetView: React.FC<ViewProps> = ({
  options,
  series,
  width,
  height,
  timeRange,
  timeZone,
  onChangeTimeRange,
}) => {
  const dpr = useKonvaDpr();
  const coloring = useCellColoring(
    options.color,
    series.map((s) => s.valueField)
  );
  // The legend formats values like every series, as they share the unit options
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- never empty
  const { valueField } = series[0]!;
  const stageRef = useRef<Konva.Stage>(null);
  const { setGlobalHover, incomingHover } = useDashboardHoverEvents(stageRef);
  const [hoveredValue, setHoveredValue] = React.useState<CellValue>();
  width = Math.trunc(width);
  height = Math.trunc(height);

  const onHover = React.useCallback(
    (cell: { time: number; value: CellValue } | null) => {
      setGlobalHover(cell ? cell.time : null);
      setHoveredValue(cell?.value);
    },
    [setGlobalHover]
  );

  const legend = options.legend?.show ? (
    <VizLayout.Legend placement={options.legend.placement ?? 'bottom'}>
      {coloring.kind === 'continuous' ? (
        <ColorLegend
          coloring={coloring}
          valueField={valueField}
          timeZone={timeZone}
          placement={options.legend.placement ?? 'bottom'}
          height={height}
          markedValue={typeof hoveredValue === 'number' ? hoveredValue : undefined}
        />
      ) : (
        <CategoryLegend
          colors={coloring.colors}
          valueField={valueField}
          timeZone={timeZone}
          placement={options.legend.placement ?? 'bottom'}
          markedValue={hoveredValue}
        />
      )}
    </VizLayout.Legend>
  ) : null;

  return (
    <VizLayout width={width} height={height} legend={legend}>
      {(vizWidth, vizHeight) => (
        <Stage width={Math.trunc(vizWidth)} height={Math.trunc(vizHeight)} key={dpr} ref={stageRef}>
          <CarpetPlot
            width={Math.trunc(vizWidth)}
            height={Math.trunc(vizHeight)}
            timeRange={timeRange}
            series={series}
            coloring={coloring}
            timeZone={timeZone}
            gapWidth={options.gapWidth ?? 0}
            hatchGaps={options.hatchGaps ?? true}
            showXAxis={options.axes?.showX}
            showYAxis={options.axes?.showY}
            hourFormat={options.axes?.hourFormat}
            showSeriesNames={options.axes?.showSeriesNames}
            tooltipMode={options.tooltip.mode}
            tooltipSort={options.tooltip.sort}
            tooltipMaxWidth={options.tooltip.maxWidth}
            tooltipMaxHeight={options.tooltip.maxHeight}
            onHover={onHover}
            onChangeTimeRange={onChangeTimeRange}
            externalHover={incomingHover ?? undefined}
          />
        </Stage>
      )}
    </VizLayout>
  );
};
