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
    // TODO: Add decimals configuration for value formatting
  };
  axes?: {
    showX?: boolean;
    showY?: boolean;
    // TODO: Add configuration for axis labels, tick density, and formatting
  }

  color: HeatmapColorOptions;
  gapWidth?: number;
  // TODO: Add tooltip configuration options (show/hide, format, etc.)
  // TODO: Add legend configuration options
}
