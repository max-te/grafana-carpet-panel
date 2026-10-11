import { findCellsAt, makeSpanArea, type Area, type Cell } from './makeCells';
import type { CellValue } from '../color/categories';

type Point = { x: number; y: number };
type CellSpan = Pick<Cell, 'time' | 'endTime'>;
type BandCells = Array<Array<Cell<CellValue>>>;

/** A cell picked by the pointer: its band and its index among the band's cells */
export interface At {
  band: number;
  index: number;
}

/** A hover from another panel of the dashboard */
export interface ExternalHover {
  /** Epoch milliseconds */
  time: number;
  /** Client position of the stage; present when a shared tooltip should show */
  tooltipOrigin?: Point;
}

export interface CellHover {
  band: number;
  cell: Cell<CellValue>;
  /** Client position of the stage; absent while the tooltip is hidden */
  stageOrigin?: Point;
}

export interface BandHighlight {
  cells: Array<Cell<CellValue>>;
  /** The region a selection spans, data gaps included; absent outside a selection */
  area?: Area[];
}

export interface PointerState {
  pointer: {
    at: At;
    /** Time of the cell at `at`, to notice when a data refresh puts another cell there */
    time: number;
    stageOrigin?: Point;
  } | null;
  selectionStart: CellSpan | null;
  external: ExternalHover | null;
}

export const initialPointerState: PointerState = { pointer: null, selectionStart: null, external: null };

export type PointerEvent =
  /** `dragging` is true while only the primary button is held */
  | { kind: 'move'; at?: At; dragging: boolean; stageOrigin?: Point }
  | { kind: 'down'; at?: At }
  | { kind: 'up'; at?: At }
  | { kind: 'leave' }
  /** An ancestor scrolled or the window resized, so client positions are stale */
  | { kind: 'reposition' }
  | { kind: 'externalHover'; hover: ExternalHover }
  | { kind: 'externalClear' }
  /** The cells changed */
  | { kind: 'data' };

export type PointerEffect =
  /** The hovered cell to report to the dashboard and the legend; null when nothing is hovered */
  | { kind: 'hover'; cell: Cell<CellValue> | null }
  /** A selection released over another cell, in epoch milliseconds */
  | { kind: 'timeRange'; from: number; to: number };

function cellAt(bandCells: BandCells, at: At | undefined) {
  return at && bandCells[at.band]?.[at.index];
}

/** The hovered cell, as long as the cells still hold it. */
export function selectHover({ pointer }: PointerState, bandCells: BandCells): CellHover | undefined {
  const cell = cellAt(bandCells, pointer?.at);
  return pointer && cell?.time === pointer.time
    ? { band: pointer.at.band, cell, stageOrigin: pointer.stageOrigin }
    : undefined;
}

/** Highlights a selection in progress, else the hovered time, else the time hovered in another panel. */
export function selectBandHighlights(state: PointerState, bandCells: BandCells): BandHighlight[] {
  const hoveredCell = selectHover(state, bandCells)?.cell;
  const { selectionStart, external } = state;
  return bandCells.map((cells) => {
    if (hoveredCell && selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart.time);
      const end = Math.max(hoveredCell.time, selectionStart.time);
      const selected = cells.filter((c) => c.time <= end && c.endTime > start);
      const [first, last] = [selected[0], selected.at(-1)];
      return { cells: selected, area: first && last ? makeSpanArea(first, last) : undefined };
    }
    const time = hoveredCell?.time ?? external?.time;
    return { cells: time === undefined ? [] : findCellsAt(cells, time) };
  });
}

/** The hovered cell, else the first cell at the time hovered in another panel when that shows a tooltip. */
export function selectTooltipTarget(state: PointerState, bandCells: BandCells): CellHover | undefined {
  const hover = selectHover(state, bandCells);
  const { external } = state;
  if (hover || !external?.tooltipOrigin) {
    return hover;
  }
  const band = bandCells.findIndex((cells) => findCellsAt(cells, external.time).length > 0);
  const cell = bandCells[band] && findCellsAt(bandCells[band], external.time)[0];
  return cell && { band, cell, stageOrigin: external.tooltipOrigin };
}

function transition(state: PointerState, event: PointerEvent, bandCells: BandCells): PointerState {
  switch (event.kind) {
    case 'move': {
      const selectionStart = event.dragging ? state.selectionStart : null;
      const cell = cellAt(bandCells, event.at);
      if (!event.at || !cell) {
        return { ...state, selectionStart, pointer: null };
      }
      const { pointer } = state;
      // Keeps the pointer while it stays within the cell, unless scrolling or resizing hid the tooltip
      const isSameCell =
        pointer?.at.band === event.at.band && pointer.at.index === event.at.index && pointer.time === cell.time;
      return {
        ...state,
        selectionStart,
        pointer:
          isSameCell && pointer.stageOrigin
            ? pointer
            : { at: event.at, time: cell.time, stageOrigin: event.stageOrigin },
      };
    }
    case 'down': {
      const cell = cellAt(bandCells, event.at);
      return cell ? { ...state, selectionStart: { time: cell.time, endTime: cell.endTime } } : state;
    }
    case 'up':
      return cellAt(bandCells, event.at) ? { ...state, selectionStart: null } : state;
    case 'leave':
      return { ...state, pointer: null };
    case 'reposition': {
      const { pointer, external } = state;
      return {
        ...state,
        pointer: pointer && { at: pointer.at, time: pointer.time },
        external: external && { time: external.time },
      };
    }
    case 'externalHover':
      return { ...state, external: event.hover };
    case 'externalClear':
      return { ...state, external: null };
    case 'data':
      return selectHover(state, bandCells) ? state : { ...state, pointer: null };
  }
}

/** The hover to report: the hovered cell while its tooltip shows, null once nothing is hovered. */
function reportedHover({ pointer }: PointerState) {
  return pointer && { ...pointer.at, time: pointer.time, shown: pointer.stageOrigin !== undefined };
}

/** Applies an event to the state, and lists what the plot should report because of it. */
export function step(
  state: PointerState,
  event: PointerEvent,
  bandCells: BandCells
): { state: PointerState; effects: PointerEffect[] } {
  const next = transition(state, event, bandCells);
  const effects: PointerEffect[] = [];

  const start = state.selectionStart;
  const end = event.kind === 'up' ? cellAt(bandCells, event.at) : undefined;
  if (start && end && start.time !== end.time) {
    effects.push({
      kind: 'timeRange',
      from: Math.min(start.time, end.time),
      to: Math.max(start.endTime, end.endTime),
    });
  }

  // Hiding keeps synced tooltips hidden; showing again reports again so they reappear
  const [before, after] = [reportedHover(state), reportedHover(next)];
  const changed =
    before?.band !== after?.band ||
    before?.index !== after?.index ||
    before?.time !== after?.time ||
    before?.shown !== after?.shown;
  if (changed && (!after || after.shown)) {
    effects.push({ kind: 'hover', cell: (after && cellAt(bandCells, after)) ?? null });
  }

  return { state: next, effects };
}
