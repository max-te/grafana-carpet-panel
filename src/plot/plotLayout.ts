import type { Area, Cell } from './makeCells';
import type { Box } from './traceOutline';

type Point = { x: number; y: number };

export interface PlotLayoutInput {
  width: number;
  height: number;
  /** Base font size of the theme, which sizes the axes and paddings */
  fontSize: number;
  showXAxis: boolean;
  showYAxis: boolean;
  /** Labels each band when there are several */
  showSeriesNames: boolean;
  gapWidth: number;
  /** The cells of each band, top to bottom */
  bandCells: Array<Array<Pick<Cell, keyof Area | 'split'>>>;
}

interface CellBoxes {
  /**
   * Where the pointer resolves to this cell. It spans the gaps around the cell,
   * so the pointer never falls between cells, however small the painted box.
   */
  hit: Box;
  /** Where the cell is filled: the cell inset by the gap, fitted so that it spans whole pixels */
  paint: Box;
}

/** One band, in pixels relative to its top-left corner unless noted otherwise. */
export interface BandLayout {
  /** Top of the band within the heatmap */
  y: number;
  width: number;
  height: number;
  /** Middle of the strip above the band that holds its name, within the heatmap; absent when unlabelled */
  labelY?: number;
  cells: CellBoxes[];
  /** Scales an area to pixels, flooring its edges so that neighbouring areas tile without seams. */
  snap: (area: Area) => Box;
}

export interface PlotLayout {
  /** Where the bands sit on the stage; the axes and band labels are placed relative to it too */
  heatmap: { x: number; y: number; width: number; height: number };
  xAxisHeight: number;
  yAxisWidth: number;
  bands: BandLayout[];
  /** The band and cell index under a point within the heatmap, if any */
  pick: (point: Point) => { band: number; index: number } | undefined;
  /** The bottom-right corner of an area of a band, on the stage */
  anchorOf: (band: number, area: Area) => Point | undefined;
}

/** Widens or narrows `gap` so that the cells between gaps span whole pixels. */
function fitGap(pitch: number, gap: number): number {
  return Math.max(0, pitch - Math.max(1, Math.round(pitch - gap)));
}

/** Index of the topmost box, i.e. the last one drawn, covering the pixel at (x, y); -1 if none does. */
function findBoxAt(cells: CellBoxes[], x: number, y: number): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  for (let i = cells.length - 1; i >= 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const { x0, y0, x1, y1 } = cells[i]!.hit;
    if (px >= x0 && px < x1 && py >= y0 && py < y1) {
      return i;
    }
  }
  return -1;
}

/** Places the axes, the bands and every cell of a carpet plot in pixels. */
export function makePlotLayout({
  width,
  height,
  fontSize,
  showXAxis,
  showYAxis,
  showSeriesNames,
  gapWidth,
  bandCells,
}: PlotLayoutInput): PlotLayout {
  const padding = fontSize / 2;
  const topPadding = showYAxis ? padding : 0;
  const yAxisWidth = fontSize * 3;
  const leftPadding = showYAxis ? yAxisWidth : padding;
  const xAxisHeight = fontSize * 1.5;
  const bottomPadding = showXAxis ? xAxisHeight : showYAxis ? padding : 0;
  const heatmap = {
    x: leftPadding,
    y: topPadding,
    width: width - leftPadding,
    height: height - bottomPadding - topPadding,
  };

  // A lone band needs no label, and keeps the whole heatmap to itself
  const numBands = bandCells.length;
  const isStacked = numBands > 1;
  const labelHeight = isStacked && showSeriesNames ? xAxisHeight : 0;
  const bandSpacing = isStacked ? padding : 0;
  const bandHeight = Math.max(0, Math.floor((heatmap.height - (numBands - 1) * bandSpacing) / numBands - labelHeight));

  const bands = bandCells.map((cells, band): BandLayout => {
    const snap = (area: Area): Box => ({
      x0: Math.floor(area.left * heatmap.width),
      y0: Math.floor(area.top * bandHeight),
      x1: Math.floor(area.right * heatmap.width),
      y1: Math.floor(area.bottom * bandHeight),
    });
    const y = band * (labelHeight + bandHeight + bandSpacing) + labelHeight;
    return {
      y,
      width: heatmap.width,
      height: bandHeight,
      labelY: labelHeight > 0 ? y - labelHeight / 2 : undefined,
      cells: cells.map((cell) => {
        const hit = snap(cell);
        if (gapWidth <= 0) {
          return { hit, paint: hit };
        }
        // A cell spans one day column and one time step, so its own size is the pitch of its day
        const x0 = cell.left * heatmap.width;
        const x1 = cell.right * heatmap.width;
        const y0 = cell.top * bandHeight;
        const y1 = cell.bottom * bandHeight;
        const gapX = fitGap(x1 - x0, gapWidth);
        // A segment of a split cell is shorter than the pitch
        const gapY = cell.split ? gapWidth : fitGap(y1 - y0, gapWidth);
        return { hit, paint: { x0: x0 + gapX / 2, y0: y0 + gapY / 2, x1: x1 - gapX / 2, y1: y1 - gapY / 2 } };
      }),
      snap,
    };
  });

  return {
    heatmap,
    xAxisHeight,
    yAxisWidth,
    bands,
    pick: ({ x, y }) => {
      const band = bands.findIndex((b) => y >= b.y && y < b.y + b.height);
      const bandLayout = bands[band];
      const index = bandLayout ? findBoxAt(bandLayout.cells, x, y - bandLayout.y) : -1;
      return index >= 0 ? { band, index } : undefined;
    },
    anchorOf: (band, area) => {
      const bandLayout = bands[band];
      if (!bandLayout) {
        return undefined;
      }
      const { x1, y1 } = bandLayout.snap(area);
      return { x: heatmap.x + x1, y: heatmap.y + bandLayout.y + y1 };
    },
  };
}
