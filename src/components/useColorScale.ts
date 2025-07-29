import { useMemo } from 'react';
import { HeatmapColorMode, HeatmapColorScale, type CarpetPanelOptions } from '../types';
import { useTheme2 } from '@grafana/ui';
import * as d3ScaleChromatic from 'd3-scale-chromatic';
import tinycolor from 'tinycolor2';
import * as d3 from 'd3';


export type ColorFn = (t: number) => string;
type D3ColorFnName = {
  [N in keyof typeof d3ScaleChromatic]: (typeof d3ScaleChromatic)[N] extends ColorFn ? N : never;
}[keyof typeof d3ScaleChromatic];

function reverseColorFn(colorFn: ColorFn): ColorFn {
  const reversedColorFn = (t: number) => colorFn(1 - t);
  reversedColorFn.name = 'reverse_' + colorFn.name;
  return reversedColorFn;
}

export function useColorScale(options: CarpetPanelOptions) {
  const theme = useTheme2();
  
  const colorPalette: ColorFn = useMemo(() => {
    switch (options.color.mode) {
    case HeatmapColorMode.Scheme: {
      const colorFnName = (`interpolate${options.color.scheme || 'Spectral'}`) as D3ColorFnName;
      const colorFn = d3ScaleChromatic[colorFnName];
      if (typeof colorFn !== 'function') {
        throw new Error('Invalid color scheme: ' + colorFnName);
      }

      if (options.color.reverse) {
        return reverseColorFn(colorFn);
      } else {
        return colorFn;
      }
    }
    case HeatmapColorMode.Opacity: {
      const fill = tinycolor(theme.visualization.getColorByName(options.color.fill)).toRgb();
      const background = tinycolor(theme.colors.background.primary).toRgb();

      const scaleAlpha = options.color.scale === HeatmapColorScale.Exponential
        ? d3
          .scalePow()
          .exponent(options.color.exponent ?? 1)
          .domain([0, 1])
          .range([0, 1])
        : d3.scaleLinear().domain([0, 1]).range([0, 1]);

      let alphaColorInterpolate: (t: number) => string = (t) => {
        const alphaValue = scaleAlpha(t);
        const blend = {
          r: fill.r * alphaValue + (1 - alphaValue) * background.r,
          g: fill.g * alphaValue + (1 - alphaValue) * background.g,
          b: fill.b * alphaValue + (1 - alphaValue) * background.b,
          a: background.a,
        };
        return `rgba(${blend.r.toFixed(3)}, ${blend.g.toFixed(3)}, ${blend.b.toFixed(3)}, ${blend.a.toFixed(3)}`;
      };
      if (options.color.reverse) {
        const originalColorFn = alphaColorInterpolate;
        alphaColorInterpolate = (x: number) => originalColorFn(1 - x);
      }
      return alphaColorInterpolate;
    }
    default: {
      const mode = (options.color.mode satisfies never) as string;
      throw new Error(`Unexpected color mode: ${mode}`)
    }
    }
  }, [options.color, theme]);
  return colorPalette;
}

