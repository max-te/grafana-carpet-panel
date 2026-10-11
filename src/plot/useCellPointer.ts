import type { AbsoluteTimeRange } from '@grafana/data';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Cell } from './makeCells';
import type { CellValue } from '../color/categories';
import type { PlotLayout } from './plotLayout';
import { useClientPositionChange } from '../hooks/useClientPositionChange';

type Point = { x: number; y: number };
type CellSpan = Pick<Cell, 'time' | 'endTime'>;

export interface CellHover {
  band: number;
  cell: Cell<CellValue>;
  /** Client position of the stage; absent while the tooltip is hidden */
  stageOrigin?: Point;
}

interface PointerPosition {
  band: number;
  idx: number;
  /** Time of the cell at `idx`, to notice when a data refresh puts another cell there */
  time: number;
  stageOrigin?: Point;
}

function getStageOrigin(node: Konva.Node): Point | undefined {
  const rect = node.getStage()?.container().getBoundingClientRect();
  return rect && { x: rect.x, y: rect.y };
}

/** Tracks the cell under the pointer, and turns a drag from one cell to another into a time range. */
export function useCellPointer(
  bandCells: Array<Array<Cell<CellValue>>>,
  layout: PlotLayout,
  onHover?: (cell: Cell<CellValue> | null) => void,
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void
) {
  const [pointer, setPointer] = useState<PointerPosition | null>(null);
  const [selectionStart, setSelectionStart] = useState<CellSpan | null>(null);
  const selectionStartRef = useRef<CellSpan | null>(null);
  const updateSelectionStart = useCallback((start: CellSpan | null) => {
    selectionStartRef.current = start;
    setSelectionStart(start);
  }, []);

  const layerRef = useRef<Konva.Layer>(null);
  const onMouseLeave = useCallback(() => {
    setPointer(null);
  }, []);
  const hideTooltip = useCallback(() => {
    setPointer((p) => (p?.stageOrigin ? { band: p.band, idx: p.idx, time: p.time } : p));
  }, []);
  useClientPositionChange(layerRef, hideTooltip);

  /** The cell under the pointer, given the heatmap layer. */
  const pickCell = useCallback(
    (layer: Konva.Node) => {
      const position = layer.getRelativePointerPosition();
      const picked = position && layout.pick(position);
      const cell = picked && bandCells[picked.band]?.[picked.index];
      return cell && { band: picked.band, idx: picked.index, cell };
    },
    [bandCells, layout]
  );

  const onMouseMove = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      if (evt.buttons !== 1 && selectionStartRef.current) {
        updateSelectionStart(null);
      }
      const picked = pickCell(currentTarget);
      if (!picked) {
        setPointer(null);
        return;
      }
      evt.stopPropagation();
      const { band, idx, cell } = picked;
      // Keeps the state while the pointer stays within the cell, unless scrolling or resizing hid the tooltip
      setPointer((p) =>
        p?.band === band && p.idx === idx && p.time === cell.time && p.stageOrigin
          ? p
          : { band, idx, time: cell.time, stageOrigin: getStageOrigin(currentTarget) }
      );
    },
    [pickCell, updateSelectionStart]
  );
  const onMouseDown = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const start = pickCell(currentTarget)?.cell;
      if (!start) {
        return;
      }
      evt.stopPropagation();
      updateSelectionStart({ time: start.time, endTime: start.endTime });
    },
    [pickCell, updateSelectionStart]
  );
  const onMouseUp = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const end = pickCell(currentTarget)?.cell;
      if (!end) {
        return;
      }
      evt.stopPropagation();
      const start = selectionStartRef.current;
      if (start && start.time !== end.time) {
        onChangeTimeRange?.({
          from: Math.min(start.time, end.time) * 1000,
          to: Math.max(start.endTime, end.endTime) * 1000,
        });
      }
      updateSelectionStart(null);
    },
    [pickCell, onChangeTimeRange, updateSelectionStart]
  );

  const pointedCell = pointer ? bandCells[pointer.band]?.[pointer.idx] : undefined;
  const hover: CellHover | undefined =
    pointer && pointedCell?.time === pointer.time
      ? { band: pointer.band, cell: pointedCell, stageOrigin: pointer.stageOrigin }
      : undefined;

  const hoveredCell = hover?.cell;
  const tooltipShown = hover?.stageOrigin !== undefined;
  useEffect(() => {
    // Hiding keeps synced tooltips hidden; showing again resends so they reappear
    if (tooltipShown || !hoveredCell) {
      onHover?.(hoveredCell ?? null);
    }
  }, [onHover, hoveredCell, tooltipShown]);

  return {
    hover,
    selectionStart,
    layerRef,
    layerHandlers: { onMouseMove, onMouseDown, onMouseUp, onMouseLeave },
  };
}
