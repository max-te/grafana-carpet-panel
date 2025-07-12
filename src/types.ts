export enum HeatmapColorMode {
  Opacity = 'opacity',
  Scheme = 'scheme',
}
/**
 * Controls the color scale of the heatmap
 */
export enum HeatmapColorScale {
  Exponential = 'exponential',
  Linear = 'linear',
}

/**
 * Controls various color options
 */
export interface HeatmapColorOptions {
  exponent?: number;
  fill: string;
  max?: number;
  min?: number;
  mode: HeatmapColorMode;
  reverse: boolean;
  scale?: HeatmapColorScale;
  scheme: string;
}

export interface SimpleOptions {
  timeFieldName?: string;
  valueField?: {
    name?: string;
    unit?: string;
  };
  axes?: {
    showX?: boolean;
    showY?: boolean;
  }

  color: HeatmapColorOptions;
  gapWidth?: number;
}
