import React from 'react';
import type { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import * as d3 from 'd3';
import { Shape } from 'react-konva';
import { findCellsAt, makeSpanArea, type Area, type Cell } from './makeCells';
import { traceOutline } from './traceOutline';
import type { BandLayout } from './plotLayout';
import { getCellColor, type CellColoring } from '../color/useCellColoring';
import type { CellValue } from '../color/categories';

export interface BandHighlight {
  cells: Array<Cell<CellValue>>;
  /** The region a selection spans, data gaps included; absent outside a selection */
  area?: Area[];
}

/** Highlights a selection in progress, else the hovered time, else the time hovered in another panel. */
export function findBandHighlight(
  cells: Array<Cell<CellValue>>,
  hoveredCell: Cell<CellValue> | undefined,
  selectionStart: Pick<Cell, 'time'> | null,
  externalHoverTime: number | undefined
): BandHighlight {
  if (hoveredCell && selectionStart) {
    const start = Math.min(hoveredCell.time, selectionStart.time);
    const end = Math.max(hoveredCell.time, selectionStart.time);
    const selected = cells.filter((c) => c.time <= end && c.endTime > start);
    const [first, last] = [selected[0], selected.at(-1)];
    return { cells: selected, area: first && last ? makeSpanArea(first, last) : undefined };
  }
  const time = hoveredCell?.time ?? externalHoverTime;
  return { cells: time === undefined ? [] : findCellsAt(cells, time) };
}

/** Contrasts with the highlighted cells, so the outline stands out against them. */
function pickOutlineColor(coloring: CellColoring, cells: Array<Cell<CellValue>>, theme: GrafanaTheme2) {
  if (coloring.kind === 'categories') {
    const firstCell = cells[0];
    return firstCell && theme.colors.getContrastText(getCellColor(coloring, firstCell.value));
  }
  const { min, max, color } = coloring;
  const highlightedMean = d3.mean(cells, (cell) => cell.value as number) ?? min;
  return highlightedMean > (min + max) / 2 ? color(min) : color(max);
}

interface HighlightProps extends BandHighlight {
  layout: BandLayout;
  coloring: CellColoring;
}

/** A translucent fill with a dashed outline over the highlighted cells of one band. */
export const BandHighlightShape: React.FC<HighlightProps> = ({ layout, cells, area, coloring }) => {
  const theme = useTheme2();
  const boxes = (area ?? cells).map(layout.snap);
  const outline = traceOutline(boxes);
  return (
    <Shape
      y={layout.y}
      sceneFunc={(context, shape) => {
        // One fill for all boxes, so the translucency does not stack where they touch
        context.beginPath();
        for (const { x0, y0, x1, y1 } of boxes) {
          context.rect(x0, y0, x1 - x0, y1 - y0);
        }
        context.fillShape(shape);

        // Centers the 1px stroke on a pixel row for a crisp line
        context.beginPath();
        for (const [x0, y0, x1, y1] of outline) {
          context.moveTo(x0 - 0.5, y0 - 0.5);
          context.lineTo(x1 - 0.5, y1 - 0.5);
        }
        context.strokeShape(shape);
      }}
      fill={'rgba(120, 120, 130, 0.2)'}
      stroke={pickOutlineColor(coloring, cells, theme)}
      dash={[4, 2]}
      strokeWidth={1}
    />
  );
};
