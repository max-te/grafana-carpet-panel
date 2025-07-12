import React, { useMemo } from 'react';
import { FieldType, type PanelProps } from '@grafana/data';
import { HeatmapColorMode, HeatmapColorScale, type SimpleOptions } from '../types';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { Chart } from './Chart';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import tinycolor from 'tinycolor2';
import * as d3 from 'd3';

type Props = PanelProps<SimpleOptions>;

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
};

export const SimplePanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  timeRange,
  timeZone,
}) => {
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
  valueField.config.unit = options.valueField?.unit;
  valueField.config.min = options.color.min;
  valueField.config.max = options.color.max;

  const padding = 16;
  const theme = useTheme2();

  type ColorFn = (t: number) => string;

  // TODO: Extract color palette generation into a separate utility function for better testability
  const colorPalette: ColorFn = useMemo(() => {
    if (options.color.mode === HeatmapColorMode.Scheme) {
      // TODO: Add error handling for invalid color scheme names
      type ColorFnName = {
        [N in keyof typeof d3ScaleChromatic]: (typeof d3ScaleChromatic)[N] extends ColorFn ? N : never;
      }[keyof typeof d3ScaleChromatic];
      const colorFnName = ('interpolate' + (options.color.scheme || 'Spectral')) as ColorFnName;
      let colorFn: ColorFn = d3ScaleChromatic[colorFnName];
      if (options.color.reverse) {
        const primal = colorFn;
        colorFn = (x: number) => primal(1 - x);
      }
      return colorFn;
    } else {
      const fill = tinycolor(theme.visualization.getColorByName(options.color.fill)).toRgb();
      const background = tinycolor(theme.colors.background.primary).toRgb();

      const scaleAlpha =
        options.color.scale === HeatmapColorScale.Exponential
          ? d3
              .scalePow()
              .exponent(options.color.exponent ?? 1)
              .domain([0, 1])
              .range([0, 1])
          : d3.scaleLinear().domain([0, 1]).range([0, 1]);

      let colorFn: (t: number) => string = (t) => {
        const inter = scaleAlpha(t);
        const blend = {
          r: fill.r * inter + (1 - inter) * background.r,
          g: fill.g * inter + (1 - inter) * background.g,
          b: fill.b * inter + (1 - inter) * background.b,
          a: background.a,
        };
        return `rgba(${blend.r.toFixed(3)}, ${blend.g.toFixed(3)}, ${blend.b.toFixed(3)}, ${blend.a.toFixed(3)}`;
      };
      if (options.color.reverse) {
        const primal = colorFn;
        colorFn = (x: number) => primal(1 - x);
      }
      return colorFn;
    }
  }, [options.color, theme]);

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
      <Stage width={width} height={height}>
        <Chart
          width={width}
          height={height}
          timeRange={timeRange}
          timeField={timeField}
          valueField={valueField}
          colorPalette={colorPalette}
          timeZone={timeZone}
          gapWidth={options.gapWidth ?? 0}
          showXAxis={options.axes?.showX}
          showYAxis={options.axes?.showY}
        />
      </Stage>
    </div>
  );
};
