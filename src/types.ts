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
  scheme?: string;
}

/**
 * Clock convention of the hour labels; `Auto` follows the browser locale
 */
export enum HourFormat {
  Auto = 'auto',
  H12 = '12h',
  H24 = '24h',
}

export interface CarpetPanelOptions {
  timeFieldName?: string;
  valueField?: {
    name?: string;
    unit?: string;
    decimals?: number;
  };
  axes?: {
    showX?: boolean;
    showY?: boolean;
    hourFormat?: HourFormat;
  };

  color: HeatmapColorOptions;
  gapWidth?: number;
  hatchGaps?: boolean;
  // TODO: Add tooltip configuration options (show/hide, format, etc.)
  // TODO: Add legend configuration options
}
