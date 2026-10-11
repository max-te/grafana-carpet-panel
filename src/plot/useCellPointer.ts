import type { AbsoluteTimeRange } from '@grafana/data';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Cell } from './makeCells';
import type { CellValue } from '../color/categories';
import type { PlotLayout } from './plotLayout';
import { initialPointerState, step, type BandCells, type ExternalHover, type PointerEvent } from './pointerInteraction';
import { useClientPositionChange } from '../hooks/useClientPositionChange';

function getStageOrigin(node: Konva.Node) {
  const rect = node.getStage()?.container().getBoundingClientRect();
  return rect && { x: rect.x, y: rect.y };
}

/** Feeds the heatmap layer's mouse events, data refreshes and other panels' hover into the pointer interaction. */
export function useCellPointer(
  bandCells: BandCells,
  layout: PlotLayout,
  externalHover: ExternalHover | undefined,
  onHover?: (cell: Cell<CellValue> | null) => void,
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void
) {
  const [state, setState] = useState(initialPointerState);
  const stateRef = useRef(initialPointerState);
  // Keeps the handlers stable while they read the latest props
  const latestRef = useRef({ bandCells, onHover, onChangeTimeRange });
  useLayoutEffect(() => {
    latestRef.current = { bandCells, onHover, onChangeTimeRange };
  });

  const dispatch = useCallback((event: PointerEvent) => {
    const latest = latestRef.current;
    const result = step(stateRef.current, event, latest.bandCells);
    if (result.state !== stateRef.current) {
      stateRef.current = result.state;
      setState(result.state);
    }
    for (const effect of result.effects) {
      if (effect.kind === 'hover') {
        latest.onHover?.(effect.cell);
      } else {
        latest.onChangeTimeRange?.({ from: effect.from, to: effect.to });
      }
    }
  }, []);

  useEffect(() => {
    dispatch({ kind: 'data' });
  }, [dispatch, bandCells]);
  useEffect(() => {
    dispatch(externalHover ? { kind: 'externalHover', hover: externalHover } : { kind: 'externalClear' });
  }, [dispatch, externalHover]);

  useEffect(() => {
    // The window hears a mouseup after the layer does, so a release over a cell reports its range first
    const release = () => {
      dispatch({ kind: 'release' });
    };
    window.addEventListener('mouseup', release);
    return () => {
      window.removeEventListener('mouseup', release);
    };
  }, [dispatch]);

  const layerRef = useRef<Konva.Layer>(null);
  const reposition = useCallback(() => {
    dispatch({ kind: 'reposition' });
  }, [dispatch]);
  useClientPositionChange(layerRef, reposition);

  /** The cell under the pointer, given the heatmap layer. */
  const pick = useCallback(
    (layer: Konva.Node) => {
      const position = layer.getRelativePointerPosition();
      return position ? layout.pick(position) : undefined;
    },
    [layout]
  );

  const onMouseMove = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const at = pick(currentTarget);
      dispatch({ kind: 'move', at, dragging: evt.buttons === 1, stageOrigin: at && getStageOrigin(currentTarget) });
      if (at) {
        evt.stopPropagation();
      }
    },
    [pick, dispatch]
  );
  const onMouseDown = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const at = pick(currentTarget);
      dispatch({ kind: 'down', at });
      if (at) {
        evt.stopPropagation();
      }
    },
    [pick, dispatch]
  );
  const onMouseUp = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      const at = pick(currentTarget);
      dispatch({ kind: 'up', at });
      if (at) {
        evt.stopPropagation();
      }
    },
    [pick, dispatch]
  );
  const onMouseLeave = useCallback(() => {
    dispatch({ kind: 'leave' });
  }, [dispatch]);

  return { state, layerRef, layerHandlers: { onMouseMove, onMouseDown, onMouseUp, onMouseLeave } };
}
