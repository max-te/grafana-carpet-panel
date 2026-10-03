import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { Group, Shape } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Area, Cell } from './makeCells';
import type { Box } from './traceOutline';
import type { CellValue } from './categories';

const HATCH_SPACING = 6;

type CellsMouseHandler = (event: KonvaEventObject<MouseEvent>) => void;

interface BandProps {
  y: number;
  width: number;
  height: number;
  cells: Array<Cell<CellValue>>;
  /** Pixel box of each cell */
  cellBoxes: Box[];
  /** Fill of each cell; undefined leaves it unpainted */
  cellColors: Array<string | undefined>;
  timeRangeArea: Area[];
  gapWidth: number;
  gapX: number;
  gapY: number;
  hatchGaps?: boolean;
  onCellsMouseMove: CellsMouseHandler;
  onCellsMouseDown: CellsMouseHandler;
  onCellsMouseUp: CellsMouseHandler;
}

/** The cells of one series, over hatching that marks where the time range has no data. */
export const CarpetBand: React.FC<BandProps> = React.memo(
  ({
    y,
    width,
    height,
    cells,
    cellBoxes,
    cellColors,
    timeRangeArea,
    gapWidth,
    gapX,
    gapY,
    hatchGaps,
    onCellsMouseMove,
    onCellsMouseDown,
    onCellsMouseUp,
  }) => {
    const theme = useTheme2();
    return (
      <Group y={y}>
        {/* Hatches the whole time range; cells paint over it, leaving data gaps hatched */}
        <Shape
          visible={hatchGaps}
          listening={false}
          sceneFunc={(context, shape) => {
            context.save();
            context.beginPath();
            for (const box of timeRangeArea) {
              const x0 = Math.floor(box.left * width);
              const y0 = Math.floor(box.top * height);
              context.rect(x0, y0, Math.floor(box.right * width) - x0, Math.floor(box.bottom * height) - y0);
            }
            context.clip();
            context.beginPath();
            for (let x = -height; x < width; x += HATCH_SPACING) {
              context.moveTo(x, height);
              context.lineTo(x + height, 0);
            }
            context.strokeShape(shape);
            context.restore();
          }}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
        />
        {/* One path, so anti-aliased edges between neighbouring cells leave no seams for the hatching */}
        <Shape
          visible={gapWidth > 0}
          listening={false}
          sceneFunc={(context, shape) => {
            context.beginPath();
            for (const cell of cells) {
              context.rect(
                cell.left * width,
                cell.top * height,
                (cell.right - cell.left) * width,
                (cell.bottom - cell.top) * height
              );
            }
            context.fillShape(shape);
          }}
          fill={theme.colors.background.primary}
        />
        {/* All cells in one shape; the pointer position tells which cell an event is about */}
        <Shape
          sceneFunc={(context) => {
            cells.forEach((cell, i) => {
              const color = cellColors[i];
              // The color scale maps NaN to undefined; such cells stay unpainted
              if (!color) {
                return;
              }
              context.fillStyle = color;
              if (gapWidth > 0) {
                context.fillRect(
                  cell.left * width + gapX / 2,
                  cell.top * height + gapY / 2,
                  (cell.right - cell.left) * width - gapX,
                  (cell.bottom - cell.top) * height - gapY
                );
              } else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- one box per cell
                const { x0, y0, x1, y1 } = cellBoxes[i]!;
                context.fillRect(x0, y0, x1 - x0, y1 - y0);
              }
            });
          }}
          // Spans gaps between cells too, so the cursor never falls between them
          hitFunc={(context, shape) => {
            context.beginPath();
            context.rect(0, 0, width, height);
            context.fillShape(shape);
          }}
          onMouseMove={onCellsMouseMove}
          onMouseDown={onCellsMouseDown}
          onMouseUp={onCellsMouseUp}
        />
      </Group>
    );
  }
);
CarpetBand.displayName = 'CarpetBand';
