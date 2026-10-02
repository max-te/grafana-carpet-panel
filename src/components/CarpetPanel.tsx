import React, { useCallback, useEffect, useRef } from 'react';
import type Konva from 'konva';
import {
  FieldType,
  type PanelProps,
  type Field,
  DataHoverEvent,
  DataHoverClearEvent,
  DashboardCursorSync,
} from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { usePanelContext } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { CarpetPlot, type ExternalHover } from './CarpetPlot';
import { useAncestorScroll } from './useAncestorScroll';
import { useColorScale } from './useColorScale';
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
  useAncestorScroll(stageRef, hideIncomingTooltip);
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
  const dpr = useKonvaDpr();
  const colorScale = useColorScale(options.color);
  const stageRef = useRef<Konva.Stage>(null);
  const { setGlobalHover, incomingHover } = useDashboardHoverEvents(stageRef);
  width = Math.trunc(width);
  height = Math.trunc(height);

  const onHover = React.useCallback(
    (cell: { time: number } | null) => {
      setGlobalHover(cell?.time ? cell.time * 1000 : null);
    },
    [setGlobalHover]
  );

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
  let timeField: Field<number> | undefined = undefined;
  let valueField: Field<number> | undefined = undefined;
  for (const frame of data.series) {
    timeField = options.timeFieldName
      ? frame.fields.find(
          (f) => f.name === options.timeFieldName || f.config.displayNameFromDS === options.timeFieldName
        )
      : frame.fields.find((f) => f.type === FieldType.time);

    valueField = options.valueField?.name
      ? frame.fields.find(
          (f) => f.name === options.valueField?.name || f.config.displayNameFromDS === options.valueField?.name
        )
      : frame.fields.find((f) => f.type === FieldType.number);
    if (valueField) {
      break;
    }
  }

  if (timeField === undefined || valueField === undefined) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsTimeField={timeField === undefined}
        needsNumberField={valueField === undefined}
      />
    );
  }
  if (timeField.type !== FieldType.time) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsTimeField />;
  }

  const displayedValueField: Field<number> = {
    ...valueField,
    config: {
      ...valueField.config,
      unit: options.valueField?.unit || valueField.config.unit,
      decimals: options.valueField?.decimals ?? valueField.config.decimals,
      min: options.color.min,
      max: options.color.max,
    },
  };

  return (
    <Stage width={width} height={height} key={dpr} ref={stageRef}>
      <CarpetPlot
        width={width}
        height={height}
        timeRange={timeRange}
        timeField={timeField}
        valueField={displayedValueField}
        colorPalette={colorScale.call}
        timeZone={timeZone}
        gapWidth={options.gapWidth ?? 0}
        hatchGaps={options.hatchGaps ?? true}
        showXAxis={options.axes?.showX}
        showYAxis={options.axes?.showY}
        hourFormat={options.axes?.hourFormat}
        tooltipMode={options.tooltip.mode}
        tooltipMaxWidth={options.tooltip.maxWidth}
        onHover={onHover}
        onChangeTimeRange={onChangeTimeRange}
        externalHover={incomingHover ?? undefined}
      />
    </Stage>
  );
};
