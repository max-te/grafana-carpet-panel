import {
  dateTimeFormat,
  formattedValueToString,
  getDisplayProcessor,
  getMinMaxAndDelta,
  type AbsoluteTimeRange,
  type Field,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
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
import { css } from '@emotion/css';
import * as d3 from 'd3';
import type Konva from 'konva';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rect, Layer, Shape } from 'react-konva';
import { Html } from 'react-konva-utils';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { makeCells, makeTimeRangeArea, type Cell } from './makeCells';
import { traceOutline } from './traceOutline';
import { useAncestorScroll } from './useAncestorScroll';
import { HourFormat } from '../types';
import type { KonvaEventObject } from 'konva/lib/Node';

type ColorPalette = (t: number) => string;

const HATCH_SPACING = 6;

export interface ExternalHover {
  time: number;
  /** Client position of the stage; present when a shared tooltip should show */
  tooltipOrigin?: { x: number; y: number };
}

interface CellHover {
  idx: number;
  time: number;
  /** Client position of the tooltip; absent while hidden */
  position?: { x: number; y: number };
}

function measureCellHover({ evt, currentTarget }: KonvaEventObject<MouseEvent>): CellHover {
  const innerRect = currentTarget.getClientRect();
  const outerRect = (evt.target as Element).getBoundingClientRect();
  return {
    idx: currentTarget.getAttr('data-idx') as number,
    time: currentTarget.getAttr('data-ts') as number,
    position: {
      x: innerRect.x + outerRect.x + innerRect.width,
      y: innerRect.y + outerRect.y + innerRect.height,
    },
  };
}

interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
  colorPalette: ColorPalette;
  gapWidth: number;
  hatchGaps?: boolean;

  showXAxis?: boolean;
  showYAxis?: boolean;
  hourFormat?: HourFormat;
  tooltipMode?: TooltipDisplayMode;
  tooltipMaxWidth?: number;
  onHover?: (cell: Cell | null) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  externalHover?: ExternalHover;
}

const getStyles = (theme: GrafanaTheme2, tooltipMaxWidth?: number) => ({
  // Header and content bring their own padding; cancel VizTooltip's container padding
  tooltip: css({ margin: theme.spacing(-1), maxWidth: tooltipMaxWidth }),
});

function useColorScale(colorPalette: ColorPalette, min: number, max: number) {
  const colorScale = useMemo(() => d3.scaleSequential(colorPalette).domain([min, max]), [min, max, colorPalette]);
  return colorScale;
}

export const CarpetPlot: React.FC<ChartProps> = ({
  width,
  height,
  timeRange,
  timeField,
  valueField,
  colorPalette,
  timeZone,
  gapWidth,
  hatchGaps,
  showXAxis,
  showYAxis,
  hourFormat = HourFormat.Auto,
  tooltipMode = TooltipDisplayMode.Single,
  tooltipMaxWidth,
  onHover,
  onChangeTimeRange,
  externalHover,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles, tooltipMaxWidth);
  const [tooltipData, setTooltipData] = useState<CellHover | null>(null);
  const [selectionStart, setSelectionStart] = useState<Pick<Cell, 'time' | 'endTime'> | null>(null);
  const heatmapLayerRef = useRef<Konva.Layer>(null);

  const handleCellMouseOver = useCallback((event: KonvaEventObject<MouseEvent>) => {
    event.evt.stopPropagation();
    setTooltipData(measureCellHover(event));
    if (event.evt.buttons !== 1) {
      setSelectionStart(null);
    }
  }, []);
  // Restores a tooltip hidden by scrolling without leaving the cell
  const handleCellMouseMove = useCallback((event: KonvaEventObject<MouseEvent>) => {
    setTooltipData((hover) => (hover?.position ? hover : measureCellHover(event)));
  }, []);
  const handleLayerMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);
  const hideTooltip = useCallback(() => {
    setTooltipData((hover) => (hover?.position ? { idx: hover.idx, time: hover.time } : hover));
  }, []);
  useAncestorScroll(heatmapLayerRef, hideTooltip);
  const handleCellMouseDown = useCallback(({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
    evt.stopPropagation();
    setSelectionStart({
      time: currentTarget.getAttr('data-ts') as number,
      endTime: currentTarget.getAttr('data-end-ts') as number,
    });
  }, []);
  const handleCellMouseUp = useCallback(
    ({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
      evt.stopPropagation();
      const end = {
        time: currentTarget.getAttr('data-ts') as number,
        endTime: currentTarget.getAttr('data-end-ts') as number,
      };
      if (selectionStart && selectionStart.time !== end.time) {
        onChangeTimeRange?.({
          from: Math.min(selectionStart.time, end.time) * 1000,
          to: Math.max(selectionStart.endTime, end.endTime) * 1000,
        });
      }
      setSelectionStart(null);
    },
    [onChangeTimeRange, selectionStart]
  );

  const minMax = getMinMaxAndDelta(valueField);
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  const colorScale = useColorScale(colorPalette, min, max);
  const display = getDisplayProcessor({
    field: valueField,
    theme,
    timeZone,
  });

  const padding = theme.typography.fontSize / 2;
  const topPadding = showYAxis ? padding : 0;

  const yAxisWidth = theme.typography.fontSize * 3;
  const leftPadding = showYAxis ? yAxisWidth : padding;
  const xAxisHeight = theme.typography.fontSize * 1.5;
  const bottomPadding = showXAxis ? xAxisHeight : showYAxis ? padding : 0;

  const innerWidth = width - leftPadding;
  const innerHeight = height - bottomPadding - topPadding;
  const cells = useMemo(
    () => makeCells(valueField.values, timeField.values, timeZone, timeRange),
    [valueField.values, timeField.values, timeZone, timeRange]
  );
  const timeRangeArea = useMemo(() => makeTimeRangeArea(timeZone, timeRange), [timeZone, timeRange]);

  const axesLayer = (
    <Layer listening={false}>
      {showXAxis && (
        <XAxisIndicator
          x={leftPadding}
          y={innerHeight + topPadding}
          height={xAxisHeight}
          width={innerWidth}
          range={timeRange}
          timeZone={timeZone}
        />
      )}
      {showYAxis && (
        <YAxisIndicator
          x={leftPadding}
          y={topPadding}
          height={innerHeight}
          width={yAxisWidth}
          hourFormat={hourFormat}
        />
      )}
    </Layer>
  );
  const heatmapLayer = useMemo(
    () => (
      <Layer ref={heatmapLayerRef} onMouseLeave={handleLayerMouseLeave} x={leftPadding} y={topPadding}>
        {/* Hatches the whole time range; cells paint over it, leaving data gaps hatched */}
        <Shape
          visible={hatchGaps}
          listening={false}
          sceneFunc={(context, shape) => {
            context.save();
            context.beginPath();
            for (const box of timeRangeArea) {
              const x0 = Math.floor(box.left * innerWidth);
              const y0 = Math.floor(box.top * innerHeight);
              context.rect(x0, y0, Math.floor(box.right * innerWidth) - x0, Math.floor(box.bottom * innerHeight) - y0);
            }
            context.clip();
            context.beginPath();
            for (let x = -innerHeight; x < innerWidth; x += HATCH_SPACING) {
              context.moveTo(x, innerHeight);
              context.lineTo(x + innerHeight, 0);
            }
            context.strokeShape(shape);
            context.restore();
          }}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
        />
        {cells.map((cell, idx) => (
          <Rect
            key={cell.time.toFixed(0) + (cell.split ? cell.split.toFixed(0) : '')}
            x={Math.floor(cell.left * innerWidth)}
            y={Math.floor(cell.top * innerHeight)}
            width={Math.floor(cell.right * innerWidth) - Math.floor(cell.left * innerWidth)}
            height={Math.floor(cell.bottom * innerHeight) - Math.floor(cell.top * innerHeight)}
            fill={colorScale(cell.value)}
            data-ts={cell.time}
            data-end-ts={cell.endTime}
            data-idx={idx}
            onMouseOver={handleCellMouseOver}
            onMouseMove={handleCellMouseMove}
            onMouseDown={handleCellMouseDown}
            onMouseUp={handleCellMouseUp}
            perfectDrawEnabled={true}
            strokeEnabled={gapWidth > 0}
            strokeWidth={gapWidth}
            stroke={theme.colors.background.primary}
          />
        ))}
      </Layer>
    ),
    [
      cells,
      timeRangeArea,
      hatchGaps,
      theme.colors.border.medium,
      innerWidth,
      innerHeight,
      handleCellMouseDown,
      handleCellMouseOver,
      handleCellMouseMove,
      handleCellMouseUp,
      handleLayerMouseLeave,
      gapWidth,
      theme.colors.background.primary,
      colorScale,
      leftPadding,
      topPadding,
    ]
  );

  // A data refresh under a resting cursor can move another cell to the stored index
  const validTooltip = tooltipData && cells[tooltipData.idx]?.time === tooltipData.time ? tooltipData : undefined;
  const hoveredCell = validTooltip ? cells[validTooltip.idx] : undefined;
  const tooltipShown = validTooltip?.position !== undefined;
  useEffect(() => {
    // Hiding keeps synced tooltips hidden; showing again resends so they reappear
    if (tooltipShown || !hoveredCell) {
      onHover?.(hoveredCell ?? null);
    }
  }, [onHover, hoveredCell, tooltipShown]);
  const highlightedCells: Cell[] = [];
  let tooltipCell = hoveredCell;
  let tooltipPosition = validTooltip?.position;
  if (hoveredCell) {
    if (selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart.time);
      const end = Math.max(hoveredCell.time, selectionStart.time);
      highlightedCells.push(...cells.filter((c) => c.time >= start && c.time <= end));
    } else if (hoveredCell.split) {
      highlightedCells.push(...cells.filter((c) => c.time === hoveredCell.time));
    } else {
      highlightedCells.push(hoveredCell);
    }
  } else if (externalHover) {
    const { time, tooltipOrigin } = externalHover;
    const nextCell = cells.find((c) => c.endTime >= time && c.time <= time);
    if (nextCell) {
      highlightedCells.push(nextCell);
      if (tooltipOrigin) {
        tooltipCell = nextCell;
        tooltipPosition = {
          x: tooltipOrigin.x + leftPadding + Math.floor(nextCell.right * innerWidth),
          y: tooltipOrigin.y + topPadding + Math.floor(nextCell.bottom * innerHeight),
        };
      }
    }
  }
  const highlightBoxes = highlightedCells.map((cell) => ({
    x0: Math.floor(cell.left * innerWidth),
    y0: Math.floor(cell.top * innerHeight),
    x1: Math.floor(cell.right * innerWidth),
    y1: Math.floor(cell.bottom * innerHeight),
  }));
  const highlightOutline = traceOutline(highlightBoxes);
  const highlightedMean = d3.mean(highlightedCells, (cell) => cell.value) ?? min;
  const hoverLayer = (
    <Layer listening={false} x={leftPadding} y={topPadding}>
      <Shape
        sceneFunc={(context, shape) => {
          // One fill for all boxes, so the translucency does not stack where they touch
          context.beginPath();
          for (const { x0, y0, x1, y1 } of highlightBoxes) {
            context.rect(x0, y0, x1 - x0, y1 - y0);
          }
          context.fillShape(shape);

          // Centers the 1px stroke on a pixel row for a crisp line
          context.beginPath();
          for (const [x0, y0, x1, y1] of highlightOutline) {
            context.moveTo(x0 - 0.5, y0 - 0.5);
            context.lineTo(x1 - 0.5, y1 - 0.5);
          }
          context.strokeShape(shape);
        }}
        fill={'rgba(120, 120, 130, 0.2)'}
        stroke={highlightedMean > (min + max) / 2 ? colorScale(min) : colorScale(max)}
        dash={[4, 2]}
        strokeWidth={1}
      />
      <Html>
        <VizTooltip
          position={tooltipMode === TooltipDisplayMode.None ? undefined : tooltipPosition}
          offset={{ x: 5, y: 5 }}
          content={
            tooltipCell ? (
              <VizTooltipWrapper className={styles.tooltip}>
                <VizTooltipHeader item={{ label: '', value: dateTimeFormat(tooltipCell.time * 1000, { timeZone }) }} />
                <VizTooltipContent
                  items={[
                    {
                      label: valueField.config.displayName || valueField.config.displayNameFromDS || valueField.name,
                      value: formattedValueToString(display(tooltipCell.value)),
                      color: colorScale(tooltipCell.value),
                      colorIndicator: VizTooltipColorIndicator.value,
                      colorPlacement: VizTooltipColorPlacement.trailing,
                    },
                  ]}
                />
              </VizTooltipWrapper>
            ) : undefined
          }
        />
      </Html>
    </Layer>
  );

  return (
    <>
      {heatmapLayer}
      {axesLayer}
      {hoverLayer}
    </>
  );
};
