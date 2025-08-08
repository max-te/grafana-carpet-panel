import React, { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react';
import {
  FieldType,
  type PanelProps,
  type Field,
  DataHoverEvent,
  DataHoverClearEvent,
  type DataFrame,
} from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { css } from '@emotion/css';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { CarpetPlot } from './CarpetPlot';
import { useColorScale } from './useColorScale';
import { useKonvaDpr } from './useKonvaDpr';

type Props = PanelProps<CarpetPanelOptions>;

const useDashboardHoverEvents = () => {
  const { eventBus } = usePanelContext();
  const setGlobalHover = useCallback(
    (time: number | null) => {
      if (time) {
        const event = new DataHoverEvent({
          point: { time: time },
        });
        eventBus.publish(event);
      } else {
        eventBus.publish(new DataHoverClearEvent());
      }
    },
    [eventBus]
  );
  return {
    setGlobalHover,
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
}) => {
  const dpr = useKonvaDpr();
  const colorScale = useColorScale(options.color);
  const { setGlobalHover } = useDashboardHoverEvents();

  const onHover = React.useCallback(
    (cell: { time: number } | null) => setGlobalHover(cell?.time ? cell.time * 1000 : null),
    [setGlobalHover]
  );

  if (data.series.length == 0) {
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
    if (valueField) break;
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

  valueField.config.unit = options.valueField?.unit;
  valueField.config.min = options.color.min;
  valueField.config.max = options.color.max;

  return (
    <Stage width={width} height={height} key={dpr}>
      <CarpetPlot
        width={width}
        height={height}
        timeRange={timeRange}
        timeField={timeField}
        valueField={valueField}
        colorPalette={colorScale}
        timeZone={timeZone}
        gapWidth={options.gapWidth ?? 0}
        showXAxis={options.axes?.showX}
        showYAxis={options.axes?.showY}
        onHover={onHover}
      />
    </Stage>
  );
};
