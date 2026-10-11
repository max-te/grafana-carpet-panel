export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Segment = [x0: number, y0: number, x1: number, y1: number];

type Interval = { from: number; to: number; side: 'before' | 'after' };

/**
 * Returns the boundary of the union of axis-aligned boxes as line segments.
 * Edges are compared exactly, so coordinates should be snapped to integer pixels.
 */
export function traceOutline(boxes: Box[]): Segment[] {
  const verticalEdges = new Map<number, Interval[]>();
  const horizontalEdges = new Map<number, Interval[]>();
  const addEdge = (edges: Map<number, Interval[]>, at: number, interval: Interval) => {
    const intervals = edges.get(at) ?? [];
    intervals.push(interval);
    edges.set(at, intervals);
  };
  for (const { x0, y0, x1, y1 } of boxes) {
    if (x0 >= x1 || y0 >= y1) {
      continue;
    }
    addEdge(verticalEdges, x0, { from: y0, to: y1, side: 'after' });
    addEdge(verticalEdges, x1, { from: y0, to: y1, side: 'before' });
    addEdge(horizontalEdges, y0, { from: x0, to: x1, side: 'after' });
    addEdge(horizontalEdges, y1, { from: x0, to: x1, side: 'before' });
  }

  const segments: Segment[] = [];
  for (const [x, intervals] of verticalEdges) {
    for (const [from, to] of findUncoveredSpans(intervals)) {
      segments.push([x, from, x, to]);
    }
  }
  for (const [y, intervals] of horizontalEdges) {
    for (const [from, to] of findUncoveredSpans(intervals)) {
      segments.push([from, y, to, y]);
    }
  }
  return segments;
}

/** Spans along a line that are covered on exactly one side of it. */
function findUncoveredSpans(intervals: Interval[]): Array<[number, number]> {
  const events = intervals.flatMap(({ from, to, side }) => [
    { at: from, side, delta: 1 },
    { at: to, side, delta: -1 },
  ]);
  events.sort((a, b) => a.at - b.at);

  const coverage = { before: 0, after: 0 };
  const spans: Array<[number, number]> = [];
  let spanStart: number | undefined;
  for (let i = 0; i < events.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- range checked above
    const event = events[i]!;
    coverage[event.side] += event.delta;
    if (events[i + 1]?.at === event.at) {
      continue;
    }
    const isBoundary = coverage.before > 0 !== coverage.after > 0;
    if (isBoundary && spanStart === undefined) {
      spanStart = event.at;
    } else if (!isBoundary && spanStart !== undefined) {
      spans.push([spanStart, event.at]);
      spanStart = undefined;
    }
  }
  return spans;
}
