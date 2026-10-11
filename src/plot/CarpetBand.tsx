import React from 'react';
import { useTheme2 } from '@grafana/ui';
import { Group, Shape } from 'react-konva';
import type { Area } from './makeCells';
import type { BandLayout } from './plotLayout';

const HATCH_SPACING = 6;

interface BandProps {
  layout: BandLayout;
  /** Fill of each cell; undefined leaves it unpainted */
  cellColors: Array<string | undefined>;
  timeRangeArea: Area[];
  /** Whether the painted cells leave gaps between them */
  hasGaps: boolean;
  hatchGaps?: boolean;
}

/** The cells of one series, over hatching that marks where the time range has no data. */
export const CarpetBand: React.FC<BandProps> = React.memo(
  ({ layout, cellColors, timeRangeArea, hasGaps, hatchGaps }) => {
    const theme = useTheme2();
    const { y, width, height, cells, snap } = layout;
    return (
      <Group y={y}>
        {/* Hatches the whole time range; cells paint over it, leaving data gaps hatched */}
        <Shape
          visible={hatchGaps}
          listening={false}
          sceneFunc={(context, shape) => {
            context.save();
            context.beginPath();
            for (const area of timeRangeArea) {
              const { x0, y0, x1, y1 } = snap(area);
              context.rect(x0, y0, x1 - x0, y1 - y0);
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
        {/* Keeps the hatching out of the gaps between cells */}
        <Shape
          visible={hasGaps}
          listening={false}
          sceneFunc={(context, shape) => {
            context.beginPath();
            for (const { hit } of cells) {
              context.rect(hit.x0, hit.y0, hit.x1 - hit.x0, hit.y1 - hit.y0);
            }
            context.fillShape(shape);
          }}
          fill={theme.colors.background.primary}
        />
        {/* All cells in one shape; the heatmap layer picks the cell an event is about */}
        <Shape
          sceneFunc={(context) => {
            cells.forEach(({ paint }, i) => {
              const color = cellColors[i];
              // The color scale maps NaN to undefined; such cells stay unpainted
              if (!color) {
                return;
              }
              context.fillStyle = color;
              context.fillRect(paint.x0, paint.y0, paint.x1 - paint.x0, paint.y1 - paint.y0);
            });
          }}
          // Spans gaps between cells too, so the cursor never falls between them
          hitFunc={(context, shape) => {
            context.beginPath();
            context.rect(0, 0, width, height);
            context.fillShape(shape);
          }}
        />
      </Group>
    );
  }
);
CarpetBand.displayName = 'CarpetBand';
