import { describe, it, expect } from 'vitest';
import { findBoxAt, snapArea } from '../src/components/pixelBoxes';

describe('snapArea', () => {
  it('should floor every edge', () => {
    expect(snapArea({ left: 0.1, top: 0.25, right: 0.35, bottom: 0.5 }, 99, 10)).toEqual({
      x0: 9,
      y0: 2,
      x1: 34,
      y1: 5,
    });
  });
});

describe('findBoxAt', () => {
  const boxes = [
    { x0: 0, y0: 0, x1: 10, y1: 5 },
    { x0: 0, y0: 5, x1: 10, y1: 5 },
    { x0: 0, y0: 5, x1: 10, y1: 10 },
    { x0: 0, y0: 8, x1: 10, y1: 12 },
  ];

  it('should find the box covering a pixel, edges excluded on the far side', () => {
    expect(findBoxAt(boxes, 3, 0)).toBe(0);
    expect(findBoxAt(boxes, 9.9, 4.9)).toBe(0);
    expect(findBoxAt(boxes, 3, 5)).toBe(2);
  });

  it('should prefer the box drawn last where boxes overlap', () => {
    expect(findBoxAt(boxes, 3, 9)).toBe(3);
  });

  it('should find nothing outside every box', () => {
    expect(findBoxAt(boxes, 10, 3)).toBe(-1);
    expect(findBoxAt(boxes, 3, 12)).toBe(-1);
    expect(findBoxAt([], 0, 0)).toBe(-1);
  });
});
