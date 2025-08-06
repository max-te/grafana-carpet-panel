import React from 'react';
import { FieldType, type PanelProps, type Field } from '@grafana/data';
import type { CarpetPanelOptions } from '../types';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { CarpetPlot } from './CarpetPlot';
import { useColorScale } from './useColorScale';
import { useKonvaDpr } from './useKonvaDpr';

type Props = PanelProps<CarpetPanelOptions>;

const getStyles = () => {
  return {
    wrapper: css`
      position: relative;
    `,
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
  const styles = useStyles2(getStyles);
  const colorScale = useColorScale(options.color);

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
    <div
      className={styles.wrapper}
      style={{
        width: `${width.toFixed(0)}px`,
        height: `${height.toFixed(0)}px`,
      }}
    >
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
        />
      </Stage>
    </div>
  );
};
