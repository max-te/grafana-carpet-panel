type SeriesSize = "sm" | "md" | "lg";

export interface SimpleOptions {
  // Dimensions
  timeFieldName?: string;
  valueFieldName?: string;

  text: string;
  seriesCountSize: SeriesSize;
}
