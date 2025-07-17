import React from 'react';
import { FieldType, type PanelProps } from '@grafana/data';
import { type CarpetPanelOptions } from '../types';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { CarpetPlot } from './CarpetPlot';
import { useColorScale } from './useColorScale';
import { useDevicePixelRatio } from 'use-device-pixel-ratio';
import Konva from 'konva';

type Props = PanelProps<CarpetPanelOptions>;

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
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
  const dpr = Math.ceil(useDevicePixelRatio({ round: false, maxDpr: 4, defaultDpr: 2 }));
  Konva.pixelRatio = dpr;
  const styles = useStyles2(getStyles);

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
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsTimeField
      />
    );
  }

  valueField.config.unit = options.valueField?.unit;
  valueField.config.min = options.color.min;
  valueField.config.max = options.color.max;

  const colorScale = useColorScale(options);

  return (
    <div
      className={cx(
        styles.wrapper,
        css`
          width: ${width}px;
          height: ${height}px;
        `
      )}
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
