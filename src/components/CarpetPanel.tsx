import React from 'react';
import { FieldType, type PanelProps } from '@grafana/data';
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
      font-family: 'Inter','Helvetica','Arial',sans-serif;
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
  const colorScale = useColorScale(options);

  const frame = data.series[0]; // TODO: Handle multiple series (?)
  if (frame === undefined) {
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
  const timeField = options.timeFieldName
    ? frame.fields.find((f) => f.name === options.timeFieldName)
    : frame.fields.find((f) => f.type === FieldType.time);

  const valueField = options.valueField?.name
    ? frame.fields.find((f) => f.name === options.valueField?.name)
    : frame.fields.find((f) => f.type === FieldType.number);

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
