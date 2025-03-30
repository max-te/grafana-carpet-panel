
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
  /**
   * Controls the exponent when scale is set to exponential
   */
  exponent: number;
  /**
   * Controls the color fill when in opacity mode
   */
  fill: string;
  /**
   * Sets the maximum value for the color scale
   */
  max?: number;
  /**
   * Sets the minimum value for the color scale
   */
  min?: number;
  /**
   * Sets the color mode
   */
  mode?: HeatmapColorMode;
  /**
   * Reverses the color scheme
   */
  reverse: boolean;
  /**
   * Controls the color scale
   */
  scale?: HeatmapColorScale;
  /**
   * Controls the color scheme used
   */
  scheme: string;
  /**
   * Controls the number of color steps
   */
  steps: number;
}

export interface SimpleOptions {
  timeFieldName?: string;
  valueFieldName?: string;

  color?: HeatmapColorOptions;
}
