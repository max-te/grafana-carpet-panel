import { describe, it, expect } from 'vitest';
import type { Cell } from '../src/plot/makeCells';
import type { CellValue } from '../src/color/categories';
import {
  initialPointerState,
  selectBandHighlights,
  selectHover,
  selectTooltipTarget,
  step,
  type PointerEffect,
  type PointerEvent,
  type PointerState,
} from '../src/plot/pointerInteraction';

const HOUR = 3_600_000;
const origin = { x: 10, y: 20 };

/** An hourly cell starting at the given hour of the first day */
const cell = (hour: number, value: CellValue = hour, split?: number): Cell<CellValue> => ({
  time: hour * HOUR,
  endTime: (hour + 1) * HOUR,
  value,
  left: 0,
  top: hour / 24,
  right: 1,
  bottom: (hour + 1) / 24,
  split,
});

/** Two bands holding cells at the same hours, 0 to 5 */
const twoBands = [[0, 1, 2, 3, 4, 5].map((h) => cell(h)), [0, 1, 2, 3, 4, 5].map((h) => cell(h, h * 10))];

/** Feeds events through step, collecting the effects of each */
function run(events: PointerEvent[], bandCells = twoBands, state: PointerState = initialPointerState) {
  const effects: PointerEffect[][] = [];
  for (const event of events) {
    const result = step(state, event, bandCells);
    state = result.state;
    effects.push(result.effects);
  }
  return { state, effects };
}

const move = (band: number, index: number, dragging = false): PointerEvent => ({
  kind: 'move',
  at: { band, index },
  dragging,
  stageOrigin: origin,
});

describe('step', () => {
  describe('hovering', () => {
    it('should report each cell the pointer enters, and nothing once it leaves', () => {
      const { effects } = run([move(0, 1), move(0, 1), move(0, 2), { kind: 'leave' }]);
      expect(effects).toEqual([
        [{ kind: 'hover', cell: twoBands[0]?.[1] }],
        [],
        [{ kind: 'hover', cell: twoBands[0]?.[2] }],
        [{ kind: 'hover', cell: null }],
      ]);
    });

    it('should report nothing hovered when the pointer is over no cell', () => {
      const { state, effects } = run([move(0, 1), { kind: 'move', dragging: false }]);
      expect(selectHover(state, twoBands)).toBeUndefined();
      expect(effects.at(-1)).toEqual([{ kind: 'hover', cell: null }]);
    });

    it('should hide the tooltip on reposition without reporting, and report again on the next move', () => {
      const { state, effects } = run([move(0, 1), { kind: 'reposition' }]);
      expect(effects.at(-1)).toEqual([]);
      expect(selectTooltipTarget(state, twoBands)).toEqual({ band: 0, cell: twoBands[0]?.[1], stageOrigin: undefined });

      const again = run([move(0, 1)], twoBands, state);
      expect(again.effects).toEqual([[{ kind: 'hover', cell: twoBands[0]?.[1] }]]);
      expect(selectTooltipTarget(again.state, twoBands)?.stageOrigin).toEqual(origin);
    });

    it('should forget a hovered cell that a data refresh removes', () => {
      const { state } = run([move(0, 2)]);
      const refreshed = [[cell(0), cell(1), cell(7)], twoBands[1] ?? []];

      const result = step(state, { kind: 'data' }, refreshed);

      expect(result.effects).toEqual([{ kind: 'hover', cell: null }]);
      expect(selectHover(result.state, refreshed)).toBeUndefined();
    });

    it('should keep a hovered cell that a data refresh keeps', () => {
      const { state } = run([move(0, 2)]);
      expect(step(state, { kind: 'data' }, twoBands).effects).toEqual([]);
    });

    it('should highlight the hovered time in every band, and every segment of a split cell', () => {
      const split = [[cell(0), cell(1, 1, 1), cell(1, 1, 2), cell(2)], twoBands[1] ?? []];
      const { state } = run([move(0, 2)], split);
      expect(selectBandHighlights(state, split).map(({ cells }) => cells)).toEqual([
        [split[0]?.[1], split[0]?.[2]],
        [twoBands[1]?.[1]],
      ]);
    });
  });

  describe('selecting', () => {
    it('should select the cells between the start and the pointer, and report the range on release', () => {
      const { state, effects } = run([move(0, 1), { kind: 'down', at: { band: 0, index: 1 } }, move(0, 3, true)]);
      expect(selectBandHighlights(state, twoBands)[0]?.cells).toEqual(twoBands[0]?.slice(1, 4));

      const released = run([{ kind: 'up', at: { band: 0, index: 3 } }], twoBands, state);
      expect(effects.flat().filter((e) => e.kind === 'timeRange')).toEqual([]);
      expect(released.effects).toEqual([[{ kind: 'timeRange', from: 1 * HOUR, to: 4 * HOUR }]]);
      expect(released.state.selectionStart).toBeNull();
    });

    it('should report the same range when dragging backwards', () => {
      const { effects } = run([
        { kind: 'down', at: { band: 0, index: 3 } },
        { kind: 'up', at: { band: 0, index: 1 } },
      ]);
      expect(effects.at(-1)).toEqual([{ kind: 'timeRange', from: 1 * HOUR, to: 4 * HOUR }]);
    });

    it('should select across bands', () => {
      const { effects } = run([
        { kind: 'down', at: { band: 0, index: 1 } },
        { kind: 'up', at: { band: 1, index: 2 } },
      ]);
      expect(effects.at(-1)).toEqual([{ kind: 'timeRange', from: 1 * HOUR, to: 3 * HOUR }]);
    });

    it('should report nothing when released over the start cell', () => {
      const { state, effects } = run([
        { kind: 'down', at: { band: 0, index: 2 } },
        { kind: 'up', at: { band: 1, index: 2 } },
      ]);
      expect(effects.flat()).toEqual([]);
      expect(state.selectionStart).toBeNull();
    });

    it('should forget the start when the pointer moves without the button held', () => {
      const { state } = run([{ kind: 'down', at: { band: 0, index: 1 } }, move(0, 2)]);
      expect(state.selectionStart).toBeNull();
    });

    it('should keep the start when released outside every cell', () => {
      const { state } = run([{ kind: 'down', at: { band: 0, index: 1 } }, { kind: 'up' }]);
      expect(state.selectionStart).toEqual({ time: 1 * HOUR, endTime: 2 * HOUR });
    });
  });

  describe('hovering in another panel', () => {
    it('should highlight the time and show the tooltip at the first band holding a cell there', () => {
      const bands = [[cell(0)], [cell(0), cell(1, 1, 1), cell(1, 1, 2)]];
      const { state } = run([{ kind: 'externalHover', hover: { time: 1.5 * HOUR, tooltipOrigin: origin } }], bands);
      expect(selectBandHighlights(state, bands).map(({ cells }) => cells.length)).toEqual([0, 2]);
      expect(selectTooltipTarget(state, bands)).toEqual({ band: 1, cell: bands[1]?.[1], stageOrigin: origin });
    });

    it('should show no tooltip without an origin, or after a reposition', () => {
      const withoutOrigin = run([{ kind: 'externalHover', hover: { time: HOUR } }]);
      expect(selectTooltipTarget(withoutOrigin.state, twoBands)).toBeUndefined();

      const repositioned = run([
        { kind: 'externalHover', hover: { time: HOUR, tooltipOrigin: origin } },
        { kind: 'reposition' },
      ]);
      expect(selectTooltipTarget(repositioned.state, twoBands)).toBeUndefined();
      expect(selectBandHighlights(repositioned.state, twoBands)[0]?.cells).toHaveLength(1);
    });

    it('should prefer the local hover, and clear on request', () => {
      const { state } = run([{ kind: 'externalHover', hover: { time: HOUR, tooltipOrigin: origin } }, move(0, 3)]);
      expect(selectTooltipTarget(state, twoBands)?.cell).toBe(twoBands[0]?.[3]);

      const cleared = run([{ kind: 'externalHover', hover: { time: HOUR } }, { kind: 'externalClear' }]);
      expect(selectBandHighlights(cleared.state, twoBands)[0]?.cells).toEqual([]);
    });

    it('should never report the hover of another panel', () => {
      const { effects } = run([
        { kind: 'externalHover', hover: { time: HOUR, tooltipOrigin: origin } },
        { kind: 'externalClear' },
      ]);
      expect(effects.flat()).toEqual([]);
    });
  });
});
