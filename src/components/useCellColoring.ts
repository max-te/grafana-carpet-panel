import { useMemo } from 'react';
import { getMinMaxAndDelta, type Field } from '@grafana/data';
import * as d3 from 'd3';
import type { HeatmapColorOptions } from '../types';
import { sampleGradientStops, useColorScale } from './useColorScale';

/** How the cells, their tooltip and the legend color values */
export type CellColoring = {
  kind: 'continuous';
  min: number;
  max: number;
  color: (value: number) => string;
  /** CSS gradient color stops from `min` to `max` */
  gradientStops: string[];
};

export function useCellColoring(colorOptions: HeatmapColorOptions, valueField: Field<number>): CellColoring {
  const palette = useColorScale(colorOptions);
  const minMax = getMinMaxAndDelta(valueField);
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  return useMemo(
    () => ({
      kind: 'continuous',
      min,
      max,
      color: d3.scaleSequential(palette.call).domain([min, max]),
      gradientStops: sampleGradientStops(palette),
    }),
    [palette, min, max]
  );
}
