import React, { useMemo } from "react";
import type { PanelProps } from "@grafana/data";
import type { SimpleOptions } from "../types";
import { css, cx } from "@emotion/css";
import { useStyles2 } from "@grafana/ui";
import { PanelDataErrorView } from "@grafana/runtime";
import { Stage, Layer } from "react-konva";
import { Chart } from "./Chart";
import * as d3ScaleChromatic from 'd3-scale-chromatic';

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
}) => {
  const styles = useStyles2(getStyles);

  if (data.series.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsStringField
      />
    );
  }
  const frames = data.series.map((frame) => {
      const timeField = options.timeFieldName
        ? frame.fields.find((f) => f.name === options.timeFieldName)
        : frame.fields.find((f) => f.type === 'time');

      const valueField = options.valueFieldName
        ? frame.fields.find((f) => f.name === options.valueFieldName)
        : frame.fields.find((f) => f.type === 'number');

      return { timeField, valueField, fields: frame.fields };
    });
  const padding = 16;

  const colorPalette = useMemo(() => {
    const colorFnName = "interpolate" + (options.color?.scheme || 'Spectral');
    let colorFn: (t: number) => string = (d3ScaleChromatic as any)[colorFnName] ?? d3ScaleChromatic.interpolateGreys;
    if (options.color?.reverse) {
      const primal = colorFn;
      colorFn = (x: number) => primal(1 - x);
    }
    return colorFn;
  }, [options.color?.reverse, options.color?.scheme]);  

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
      <Stage
        width={width}
        height={height}
      >
        <Layer>
          <Chart
            x={padding} y={padding}
            width={width - 2 * padding}
            height={height - 2 * padding}
            timeRange={timeRange}
            timeField={frames[0]!.timeField!}
            valueField={frames[0]!.valueField!}
            colorPalette={colorPalette}
            />
        </Layer>
      </Stage>
    </div>
  );
};
