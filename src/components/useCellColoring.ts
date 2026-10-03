import { useMemo } from 'react';
import {
  FieldColorModeId,
  FieldType,
  getMinMaxAndDelta,
  getScaleCalculator,
  ThresholdsMode,
  type Field,
  type GrafanaTheme2,
  type NumericRange,
  type ThresholdsConfig,
} from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import * as d3 from 'd3';
import { HeatmapColorMode, type HeatmapColorOptions } from '../types';
import { isNumberField, makeCategoryColors, type CellValue } from './categories';
import { makeColorPalette, sampleGradientStops } from './useColorScale';
import { useStableItems } from './useStableItems';

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

/** Colors like Grafana's thresholds color mode, with hard stops at the threshold steps */
function makeThresholdColoring(
  thresholds: ThresholdsConfig | undefined,
  min: number,
  max: number,
  theme: GrafanaTheme2
): ContinuousColoring {
  // A fresh field has no state.range, so percentages refer to [min, max] as well
  const scale = getScaleCalculator(
    {
      name: '',
      type: FieldType.number,
      values: [],
      config: { thresholds, min, max, color: { mode: FieldColorModeId.Thresholds } },
    },
    theme
  );
  const color = (value: number) => scale(value).color;

  const isPercentage = thresholds?.mode === ThresholdsMode.Percentage;
  const boundaries = (thresholds?.steps ?? [])
    .map((step) => (isPercentage ? step.value / 100 : (step.value - min) / (max - min)))
    .filter((fraction) => fraction > 0 && fraction < 1)
    .sort((a, b) => a - b);
  const edges = [0, ...boundaries, 1];
  const gradientStops = edges.slice(1).flatMap((end, i) => {
    const start = edges[i] ?? 0;
    const bandColor = color(min + ((start + end) / 2) * (max - min));
    return [`${bandColor} ${(start * 100).toFixed(2)}%`, `${bandColor} ${(end * 100).toFixed(2)}%`];
  });
  return { kind: 'continuous', min, max, color, gradientStops };
}

/** One coloring for all fields, which share type and config. */
export function useCellColoring(colorOptions: HeatmapColorOptions, valueFields: Array<Field<CellValue>>): CellColoring {
  const theme = useTheme2();
  // The fields are rebuilt on every render, so the memo tracks only what decides the colors
  const valueLists = useStableItems(valueFields.map((field) => field.values));
  const type = valueFields[0]?.type;
  const { mappings, type: typeConfig, thresholds } = valueFields[0]?.config ?? {};
  const ranges: Array<Partial<NumericRange>> = valueFields.filter(isNumberField).map(getMinMaxAndDelta);
  const min = d3.min(ranges, (range) => range.min ?? undefined) ?? 0;
  const max = d3.max(ranges, (range) => range.max ?? undefined) ?? 1;
  return useMemo(() => {
    if (type !== FieldType.number) {
      return {
        kind: 'categories',
        colors: makeCategoryColors(
          { type: type ?? FieldType.other, values: valueLists.flat(), config: { mappings, type: typeConfig } },
          theme
        ),
      };
    }
    const { mode } = colorOptions;
    if (mode === HeatmapColorMode.Thresholds) {
      return makeThresholdColoring(thresholds, min, max, theme);
    }
    const palette = makeColorPalette({ ...colorOptions, mode }, theme);
    return {
      kind: 'continuous',
      min,
      max,
      color: d3.scaleSequential(palette.call).domain([min, max]),
      gradientStops: sampleGradientStops(palette),
    };
  }, [type, valueLists, mappings, typeConfig, thresholds, theme, colorOptions, min, max]);
}
