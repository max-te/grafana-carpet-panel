import React, { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import { FieldType, type PanelProps, DataHoverEvent, DataHoverClearEvent, DashboardCursorSync } from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { usePanelContext, VizLayout } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { CarpetPlot, type ExternalHover } from './CarpetPlot';
import { CategoryLegend } from './CategoryLegend';
import { ColorLegend } from './ColorLegend';
import { isCategoricalField, type CellValue } from './categories';
import { findSeries, findTimeField, type Series } from './series';
import { useClientPositionChange } from './useClientPositionChange';
import { useCellColoring } from './useCellColoring';
import { useKonvaDpr } from './useKonvaDpr';

type Props = PanelProps<CarpetPanelOptions>;

// Like Grafana's own panels, show a synced tooltip only while the whole plot is on screen
function getVisibleClientOrigin(stage: Konva.Stage | null) {
  const rect = stage?.container().getBoundingClientRect();
  if (!rect || rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
    return undefined;
  }
  return { x: rect.x, y: rect.y };
}

const useDashboardHoverEvents = (stageRef: React.RefObject<Konva.Stage | null>) => {
  const { eventBus, sync } = usePanelContext();
  const syncMode = sync ? sync() : DashboardCursorSync.Off;
  const [incomingHover, setIncomingHover] = React.useState<ExternalHover | null>(null);
  const setGlobalHover = useCallback(
    (time: number | null) => {
      if (syncMode !== DashboardCursorSync.Off) {
        if (time) {
          const event = new DataHoverEvent({
            point: { time: time },
          });
          eventBus.publish(event);
        } else {
          eventBus.publish(new DataHoverClearEvent());
        }
      }
    },
    [eventBus, syncMode]
  );
  useEffect(() => {
    const sub = eventBus.getStream(DataHoverEvent).subscribe((ev) => {
      const time = ev.payload.point.time;
      setIncomingHover(
        time
          ? {
              time: time / 1000,
              tooltipOrigin:
                syncMode === DashboardCursorSync.Tooltip ? getVisibleClientOrigin(stageRef.current) : undefined,
            }
          : null
      );
    });
    return () => {
      sub.unsubscribe();
    };
  }, [eventBus, syncMode, stageRef]);

  useEffect(() => {
    const sub = eventBus.getStream(DataHoverClearEvent).subscribe(() => {
      setIncomingHover(null);
    });
    return () => {
      sub.unsubscribe();
    };
  }, [eventBus]);

  const hideIncomingTooltip = useCallback(() => {
    setIncomingHover((hover) => (hover?.tooltipOrigin ? { time: hover.time } : hover));
  }, []);
  useClientPositionChange(stageRef, hideIncomingTooltip);
  return {
    setGlobalHover,
    incomingHover: syncMode === DashboardCursorSync.Off ? null : incomingHover,
  };
};

export const CarpetPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  timeRange,
  timeZone,
  onChangeTimeRange,
}) => {
  if (data.series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        message="No series"
        needsTimeField
        needsNumberField
      />
    );
  }
  const series = findSeries(data.series, options);
  if (series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsTimeField={!data.series.some((frame) => findTimeField(frame, options.timeFieldName))}
        needsNumberField={
          !data.series.some((frame) => frame.fields.some((f) => f.type === FieldType.number || isCategoricalField(f)))
        }
      />
    );
  }
  if (series.some(({ timeField }) => timeField.type !== FieldType.time)) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsTimeField />;
  }

  const displayedSeries = series.map(({ valueField, ...rest }) => ({
    ...rest,
    valueField: {
      ...valueField,
      config: {
        ...valueField.config,
        unit: options.valueField?.unit || valueField.config.unit,
        decimals: options.valueField?.decimals ?? valueField.config.decimals,
        min: options.color.min,
        max: options.color.max,
      },
    },
  }));

  return (
    <CarpetView
      options={options}
      series={displayedSeries}
      width={width}
      height={height}
      timeRange={timeRange}
      timeZone={timeZone}
      onChangeTimeRange={onChangeTimeRange}
    />
  );
};

type ViewProps = Pick<Props, 'options' | 'width' | 'height' | 'timeRange' | 'timeZone' | 'onChangeTimeRange'> & {
  /** At least one; all share the value type */
  series: Series[];
};

const CarpetView: React.FC<ViewProps> = ({
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
      setGlobalHover(cell?.time ? cell.time * 1000 : null);
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
