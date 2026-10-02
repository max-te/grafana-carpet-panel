import { useMemo } from 'react';
import { FieldType, getMinMaxAndDelta, type Field, type NumericRange } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import * as d3 from 'd3';
import type { HeatmapColorOptions } from '../types';
import { isNumberField, makeCategoryColors, type CellValue } from './categories';
import { sampleGradientStops, useColorScale } from './useColorScale';

export type ContinuousColoring = {
  kind: 'continuous';
  min: number;
  max: number;
  color: (value: number) => string;
  /** CSS gradient color stops from `min` to `max` */
  gradientStops: string[];
};

export type CategoryColoring = {
  kind: 'categories';
  /** Every distinct value of the field, in legend order */
  colors: Map<CellValue, string>;
};

/** How the cells, their tooltip and the legend color values */
export type CellColoring = ContinuousColoring | CategoryColoring;

export function getCellColor(coloring: CellColoring, value: CellValue): string {
  return coloring.kind === 'categories'
    ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- colors cover every value
      coloring.colors.get(value)!
    : coloring.color(value as number);
}

export function useCellColoring(colorOptions: HeatmapColorOptions, valueField: Field<CellValue>): CellColoring {
  const theme = useTheme2();
  const palette = useColorScale(colorOptions);
  // valueField is rebuilt on every render, so the memo tracks only what decides the colors
  const { type, values } = valueField;
  const { mappings, type: typeConfig } = valueField.config;
  const minMax: Partial<NumericRange> = isNumberField(valueField) ? getMinMaxAndDelta(valueField) : {};
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  return useMemo(() => {
    if (type !== FieldType.number) {
      return {
        kind: 'categories',
        colors: makeCategoryColors({ type, values, config: { mappings, type: typeConfig } }, theme),
      };
    }
    return {
      kind: 'continuous',
      min,
      max,
      color: d3.scaleSequential(palette.call).domain([min, max]),
      gradientStops: sampleGradientStops(palette),
    };
  }, [type, values, mappings, typeConfig, theme, palette, min, max]);
}
