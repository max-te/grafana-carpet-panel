import { describe, it, expect } from 'vitest';
import { traceOutline, type Segment } from '../src/components/traceOutline';

const sortSegments = (segments: Segment[]) => [...segments].sort((a, b) => a.join().localeCompare(b.join()));

describe('traceOutline', () => {
  it('outlines a single box', () => {
    expect(sortSegments(traceOutline([{ x0: 0, y0: 0, x1: 2, y1: 3 }]))).toEqual(
      sortSegments([
        [0, 0, 0, 3],
        [2, 0, 2, 3],
        [0, 0, 2, 0],
        [0, 3, 2, 3],
      ])
    );
  });

  it('merges stacked cells into one rectangle', () => {
    const column = [
      { x0: 0, y0: 0, x1: 2, y1: 1 },
      { x0: 0, y0: 1, x1: 2, y1: 2 },
      { x0: 0, y0: 2, x1: 2, y1: 3 },
    ];
    expect(sortSegments(traceOutline(column))).toEqual(
      sortSegments([
        [0, 0, 0, 3],
        [2, 0, 2, 3],
        [0, 0, 2, 0],
        [0, 3, 2, 3],
      ])
    );
  });

  it('traces a selection spanning midnight as a staircase', () => {
    const selection = [
      { x0: 0, y0: 2, x1: 1, y1: 4 },
      { x0: 1, y0: 0, x1: 2, y1: 4 },
      { x0: 2, y0: 0, x1: 3, y1: 1 },
    ];
    expect(sortSegments(traceOutline(selection))).toEqual(
      sortSegments([
        [0, 2, 0, 4],
        [1, 0, 1, 2],
        [2, 1, 2, 4],
        [3, 0, 3, 1],
        [1, 0, 3, 0],
        [2, 1, 3, 1],
        [0, 2, 1, 2],
        [0, 4, 2, 4],
      ])
    );
  });

  it('keeps the outline around missing cells', () => {
    const withGap = [
      { x0: 0, y0: 0, x1: 1, y1: 1 },
      { x0: 0, y0: 2, x1: 1, y1: 3 },
    ];
    expect(traceOutline(withGap)).toHaveLength(8);
  });

  it('ignores degenerate boxes', () => {
    expect(traceOutline([{ x0: 1, y0: 0, x1: 1, y1: 5 }])).toEqual([]);
  });
});
