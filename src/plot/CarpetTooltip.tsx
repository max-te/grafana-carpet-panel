import React from 'react';
import { css } from '@emotion/css';
import { dateTimeFormat, formattedValueToString, getDisplayProcessor, type GrafanaTheme2 } from '@grafana/data';
import {
  TooltipDisplayMode,
  useStyles2,
  useTheme2,
  VizTooltip,
  VizTooltipColorIndicator,
  VizTooltipColorPlacement,
  VizTooltipContent,
  VizTooltipHeader,
  VizTooltipWrapper,
} from '@grafana/ui';
import { SortOrder } from '@grafana/schema';
import * as d3 from 'd3';
import { Html } from 'react-konva-utils';
import { findCellsAt, type Cell } from './makeCells';
import { getCellColor, type CellColoring } from '../color/useCellColoring';
import type { CellValue } from '../color/categories';
import type { Series } from '../series';

interface TooltipRow {
  band: number;
  cell: Cell<CellValue>;
}

/** The given cell, and in multi mode the cell at the same time in every other band. */
function listTooltipRows(
  bandCells: Array<Array<Cell<CellValue>>>,
  { band, cell }: TooltipRow,
  mode: TooltipDisplayMode,
  sort: SortOrder,
  coloring: CellColoring
): TooltipRow[] {
  if (mode !== TooltipDisplayMode.Multi) {
    return [{ band, cell }];
  }
  const rows = bandCells.flatMap((cells, rowBand) => {
    const rowCell = rowBand === band ? cell : findCellsAt(cells, cell.time)[0];
    return rowCell ? [{ band: rowBand, cell: rowCell }] : [];
  });
  if (coloring.kind === 'continuous' && sort !== SortOrder.None) {
    const order = sort === SortOrder.Descending ? d3.descending : d3.ascending;
    rows.sort((a, b) => order(a.cell.value, b.cell.value));
  }
  return rows;
}

const getStyles = (theme: GrafanaTheme2, maxWidth?: number) => ({
  // Header and content bring their own padding; cancel VizTooltip's container padding
  tooltip: css({ margin: theme.spacing(-1), maxWidth }),
});

interface TooltipProps {
  series: Series[];
  bandCells: Array<Array<Cell<CellValue>>>;
  /** The cell the tooltip is about; absent when there is none */
  target?: TooltipRow;
  /** Band under the pointer, marked among the others */
  activeBand?: number;
  /** Client position of the tooltip; absent while hidden */
  position?: { x: number; y: number };
  coloring: CellColoring;
  timeZone: string;
  mode: TooltipDisplayMode;
  sort: SortOrder;
  maxWidth?: number;
  maxHeight?: number;
}

export const CarpetTooltip: React.FC<TooltipProps> = ({
  series,
  bandCells,
  target,
  activeBand,
  position,
  coloring,
  timeZone,
  mode,
  sort,
  maxWidth,
  maxHeight,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles, maxWidth);
  const rows = target ? listTooltipRows(bandCells, target, mode, sort, coloring) : [];
  const items = rows.flatMap(({ band, cell }) => {
    const bandSeries = series[band];
    if (!bandSeries) {
      return [];
    }
    const display = getDisplayProcessor({ field: bandSeries.valueField, theme, timeZone });
    return [
      {
        label: bandSeries.name,
        value: formattedValueToString(display(cell.value)),
        color: getCellColor(coloring, cell.value),
        colorIndicator: VizTooltipColorIndicator.value,
        colorPlacement: VizTooltipColorPlacement.trailing,
        isActive: rows.length > 1 && band === activeBand,
      },
    ];
  });

  return (
    <Html>
      <VizTooltip
        position={mode === TooltipDisplayMode.None ? undefined : position}
        offset={{ x: 5, y: 5 }}
        content={
          target && items.length > 0 ? (
            <VizTooltipWrapper className={styles.tooltip}>
              <VizTooltipHeader item={{ label: '', value: dateTimeFormat(target.cell.time, { timeZone }) }} />
              <VizTooltipContent
                items={items}
                scrollable={mode === TooltipDisplayMode.Multi && maxHeight !== undefined}
                maxHeight={maxHeight}
              />
            </VizTooltipWrapper>
          ) : undefined
        }
      />
    </Html>
  );
};
