import React, { useMemo } from 'react';
import { type PanelProps } from '@grafana/data';
import { HeatmapColorMode, HeatmapColorScale, type SimpleOptions } from '../types';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';
import { Stage } from 'react-konva';
import { Chart } from './Chart';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import tinycolor from 'tinycolor2';
import * as d3 from 'd3';

interface Props extends PanelProps<SimpleOptions> {}

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

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }
  const frames = data.series.map((frame) => {
    const timeField = options.timeFieldName
      ? frame.fields.find((f) => f.name === options.timeFieldName)
      : frame.fields.find((f) => f.type === 'time');

    const valueField = options.valueField?.name
      ? frame.fields.find((f) => f.name === options.valueField?.name)
      : frame.fields.find((f) => f.type === 'number');
    valueField!.config.unit = options.valueField?.unit;
    valueField!.config.min = options.color?.min;
    valueField!.config.max = options.color?.max;

    return { timeField, valueField, fields: frame.fields };
  });
  const padding = 16;
  const theme = useTheme2();

  const colorPalette = useMemo(() => {
    if (options.color?.mode === HeatmapColorMode.Scheme) {
      const colorFnName = 'interpolate' + (options.color?.scheme || 'Spectral');
      let colorFn: (t: number) => string = (d3ScaleChromatic as any)[colorFnName] ?? d3ScaleChromatic.interpolateGreys;
      if (options.color?.reverse) {
        const primal = colorFn;
        colorFn = (x: number) => primal(1 - x);
      }
      return colorFn;
    } else {
      const fill = tinycolor(theme.visualization.getColorByName(options.color?.fill!)).toRgb();
      const background = tinycolor(theme.colors.background.primary).toRgb();

      const scaleAlpha =
        options.color?.scale === HeatmapColorScale.Exponential
          ? d3.scalePow().exponent(options.color.exponent).domain([0, 1]).range([0, 1])
          : d3.scaleLinear().domain([0, 1]).range([0, 1]);

      let colorFn: (t: number) => string = (t) => {
        const inter = scaleAlpha(t)!;
        const blend = {
          r: fill.r * inter + (1 - inter) * background.r,
          g: fill.g * inter + (1 - inter) * background.g,
          b: fill.b * inter + (1 - inter) * background.b,
          a: background.a,
        };
        return `rgba(${blend.r}, ${blend.g}, ${blend.b}, ${blend.a}`;
      };
      if (options.color?.reverse) {
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
          x={padding}
          y={padding}
          width={width - 2 * padding}
          height={height - 2 * padding}
          timeRange={timeRange}
          timeField={frames[0]!.timeField!}
          valueField={frames[0]!.valueField!}
          colorPalette={colorPalette}
          timeZone={timeZone}
        />
      </Stage>
    </div>
  );
};
