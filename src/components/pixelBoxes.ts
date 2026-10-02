import type { Area } from './makeCells';
import type { Box } from './traceOutline';

/** Scales an area to pixels, flooring its edges so that neighbouring areas tile without seams. */
export function snapArea(area: Area, width: number, height: number): Box {
  return {
    x0: Math.floor(area.left * width),
    y0: Math.floor(area.top * height),
    x1: Math.floor(area.right * width),
    y1: Math.floor(area.bottom * height),
  };
}

/** Index of the topmost box, i.e. the last one drawn, covering the pixel at (x, y); -1 if none does. */
export function findBoxAt(boxes: Box[], x: number, y: number): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  for (let i = boxes.length - 1; i >= 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const { x0, y0, x1, y1 } = boxes[i]!;
    if (px >= x0 && px < x1 && py >= y0 && py < y1) {
      return i;
    }
  }
  return -1;
}
