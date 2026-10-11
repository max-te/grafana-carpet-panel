import { describe, it, expect } from 'vitest';
import type { Area } from '../src/plot/makeCells';
import { makePlotLayout, type PlotLayoutInput } from '../src/plot/plotLayout';

/** Two days of four six-hour rows, as makeCells lays them out */
const twoDaysOfQuarters: Area[] = [0, 1].flatMap((day) =>
  [0, 1, 2, 3].map((row) => ({ left: day / 2, top: row / 4, right: (day + 1) / 2, bottom: (row + 1) / 4 }))
);

/** Without axes, the heatmap sits at (5, 0) and spans 100 × 100 pixels. */
function layout(input: Partial<PlotLayoutInput> = {}) {
  return makePlotLayout({
    width: 105,
    height: 100,
    fontSize: 10,
    showXAxis: false,
    showYAxis: false,
    showSeriesNames: true,
    gapWidth: 0,
    bandCells: [twoDaysOfQuarters],
    ...input,
  });
}

describe('makePlotLayout', () => {
  it('should give a lone band the whole heatmap', () => {
    const { heatmap, bands } = layout();
    expect(heatmap).toEqual({ x: 5, y: 0, width: 100, height: 100 });
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ y: 0, width: 100, height: 100, labelY: undefined });
  });

  it('should make room for the axes', () => {
    const { heatmap, xAxisHeight, yAxisWidth } = layout({ width: 400, height: 300, showXAxis: true, showYAxis: true });
    expect(xAxisHeight).toBe(15);
    expect(yAxisWidth).toBe(30);
    expect(heatmap).toEqual({ x: 30, y: 5, width: 370, height: 280 });
  });

  it('should stack bands with a label strip above each', () => {
    const { bands } = layout({ bandCells: [twoDaysOfQuarters, twoDaysOfQuarters] });
    // (100 - 5 spacing) / 2 - 15 label = 32.5, floored
    expect(bands.map(({ y, height, labelY }) => ({ y, height, labelY }))).toEqual([
      { y: 15, height: 32, labelY: 7.5 },
      { y: 67, height: 32, labelY: 59.5 },
    ]);
  });

  it('should stack bands without label strips when series names are hidden', () => {
    const { bands } = layout({
      bandCells: [twoDaysOfQuarters, twoDaysOfQuarters],
      showSeriesNames: false,
    });
    expect(bands.map(({ y, height, labelY }) => ({ y, height, labelY }))).toEqual([
      { y: 0, height: 47, labelY: undefined },
      { y: 52, height: 47, labelY: undefined },
    ]);
  });

  it('should paint cells over their whole hit box without gaps', () => {
    const cell = layout().bands[0]?.cells[0];
    expect(cell?.hit).toEqual({ x0: 0, y0: 0, x1: 50, y1: 25 });
    expect(cell?.paint).toEqual(cell?.hit);
  });

  it('should inset the painted box by the gap but keep the hit box whole', () => {
    const cell = layout({ gapWidth: 4 }).bands[0]?.cells[0];
    expect(cell?.hit).toEqual({ x0: 0, y0: 0, x1: 50, y1: 25 });
    expect(cell?.paint).toEqual({ x0: 2, y0: 2, x1: 48, y1: 23 });
  });

  it('should fit the gap so that painted cells span whole pixels, on short days too', () => {
    // A 23 h day: its column is 23/24 as wide, and it has 23 hourly rows
    const shortDay = Array.from({ length: 23 }, (_, row) => ({
      left: 0.5,
      top: row / 23,
      right: 0.5 + 23 / 48,
      bottom: (row + 1) / 23,
    }));
    const cells =
      layout({ gapWidth: 1, bandCells: [[...twoDaysOfQuarters.slice(0, 4), ...shortDay]] }).bands[0]?.cells ?? [];
    for (const { paint } of cells) {
      const [paintWidth, paintHeight] = [paint.x1 - paint.x0, paint.y1 - paint.y0];
      expect(paintWidth).toBeCloseTo(Math.round(paintWidth));
      expect(paintHeight).toBeCloseTo(Math.round(paintHeight));
    }
  });

  it('should keep the plain gap on the segments of a split cell', () => {
    const segment = { left: 0, top: 0.9, right: 0.5, bottom: 1, split: 1 };
    const cell = layout({ gapWidth: 4, bandCells: [[segment]] }).bands[0]?.cells[0];
    expect(cell?.paint).toEqual({ x0: 2, y0: 92, x1: 48, y1: 98 });
  });

  it('should snap areas so that neighbours tile without seams', () => {
    const band = layout().bands[0];
    const left = band?.snap({ left: 0, top: 0, right: 1 / 3, bottom: 0.5 });
    const right = band?.snap({ left: 1 / 3, top: 0.5, right: 2 / 3, bottom: 1 });
    expect(left).toEqual({ x0: 0, y0: 0, x1: 33, y1: 50 });
    expect(right?.x0).toBe(left?.x1);
    expect(right?.y0).toBe(left?.y1);
  });

  describe('pick', () => {
    it('should find the cell under a point', () => {
      expect(layout().pick({ x: 60, y: 30 })).toEqual({ band: 0, index: 5 });
    });

    it('should find the cell whose gap holds the point', () => {
      expect(layout({ gapWidth: 4 }).pick({ x: 49.5, y: 0.5 })).toEqual({ band: 0, index: 0 });
    });

    it("should leave a box's far edges to its neighbours", () => {
      const { pick } = layout();
      expect(pick({ x: 49.9, y: 24.9 })).toEqual({ band: 0, index: 0 });
      expect(pick({ x: 50, y: 24.9 })).toEqual({ band: 0, index: 4 });
      expect(pick({ x: 49.9, y: 25 })).toEqual({ band: 0, index: 1 });
    });

    it('should prefer the cell drawn last where hit boxes overlap', () => {
      const overlapping = [
        { left: 0, top: 0, right: 1, bottom: 0.5 },
        { left: 0, top: 0.25, right: 1, bottom: 1 },
      ];
      expect(layout({ bandCells: [overlapping] }).pick({ x: 10, y: 30 })).toEqual({ band: 0, index: 1 });
    });

    it('should find the band under the point', () => {
      const { pick } = layout({ bandCells: [twoDaysOfQuarters, twoDaysOfQuarters] });
      // The second band starts at 67 and is 32 pixels tall, so 8 pixels per row
      expect(pick({ x: 10, y: 67 + 9 })).toEqual({ band: 1, index: 1 });
    });

    it('should find nothing between bands or outside every cell', () => {
      const { pick } = layout({ bandCells: [twoDaysOfQuarters, twoDaysOfQuarters] });
      expect(pick({ x: 10, y: 5 })).toBeUndefined();
      expect(pick({ x: 10, y: 50 })).toBeUndefined();
      expect(layout({ bandCells: [[]] }).pick({ x: 10, y: 10 })).toBeUndefined();
    });
  });

  it("should anchor an area at its hit box's bottom-right corner on the stage", () => {
    const { anchorOf } = layout({ bandCells: [twoDaysOfQuarters, twoDaysOfQuarters] });
    expect(anchorOf(1, { left: 0, top: 0, right: 0.5, bottom: 0.25 })).toEqual({ x: 5 + 50, y: 67 + 8 });
    expect(anchorOf(2, { left: 0, top: 0, right: 0.5, bottom: 0.25 })).toBeUndefined();
  });
});
