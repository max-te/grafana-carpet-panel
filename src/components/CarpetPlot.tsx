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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Rect, Layer, Shape } from 'react-konva';
import { Html } from 'react-konva-utils';
import { XAxisIndicator, YAxisIndicator } from './AxisLabels';
import { makeCells, type Cell } from './makeCells';
import { traceOutline } from './traceOutline';
import type { KonvaEventObject } from 'konva/lib/Node';

type ColorPalette = (t: number) => string;
interface ChartProps {
  width: number;
  height: number;

  timeField: Field<number>;
  valueField: Field<number>;
  timeZone: string;
  timeRange: TimeRange;
  colorPalette: ColorPalette;
  gapWidth: number;

  showXAxis?: boolean;
  showYAxis?: boolean;
  onHover?: (cell: Cell | null) => void;
  onChangeTimeRange?: (timeRange: AbsoluteTimeRange) => void;
  externalHoverTime?: number;
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Header and content bring their own padding; cancel VizTooltip's container padding
  tooltip: css({ margin: theme.spacing(-1) }),
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
  showXAxis,
  showYAxis,
  onHover,
  onChangeTimeRange,
  externalHoverTime,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [tooltipData, setTooltipData] = useState<{ idx: number; time: number; x: number; y: number } | null>(null);
  const [selectionStart, setSelectionStart] = useState<Pick<Cell, 'time' | 'endTime'> | null>(null);

  const handleCellMouseOver = useCallback(({ evt, currentTarget }: KonvaEventObject<MouseEvent>) => {
    evt.stopPropagation();
    const cellIdx = currentTarget.getAttr('data-idx') as number;
    const innerRect = currentTarget.getClientRect();
    const outerRect = (evt.target as Element).getBoundingClientRect();
    setTooltipData({
      idx: cellIdx,
      time: currentTarget.getAttr('data-ts') as number,
      x: innerRect.x + outerRect.x + innerRect.width,
      y: innerRect.y + outerRect.y + innerRect.height,
    });
    if (evt.buttons !== 1) {
      setSelectionStart(null);
    }
  }, []);
  const handleLayerMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);
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
      {showYAxis && <YAxisIndicator x={leftPadding} y={topPadding} height={innerHeight} width={yAxisWidth} />}
    </Layer>
  );
  const heatmapLayer = useMemo(
    () => (
      <Layer onMouseLeave={handleLayerMouseLeave} x={leftPadding} y={topPadding}>
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
      innerWidth,
      innerHeight,
      handleCellMouseDown,
      handleCellMouseOver,
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
  useEffect(() => {
    onHover?.(hoveredCell ?? null);
  }, [onHover, hoveredCell]);
  const highlightedCells: Cell[] = [];
  if (hoveredCell) {
    if (selectionStart) {
      const start = Math.min(hoveredCell.time, selectionStart.time);
      const end = Math.max(hoveredCell.time, selectionStart.time);
      highlightedCells.push(...cells.filter((c) => c.time >= start && c.time <= end));
    } else {
      highlightedCells.push(hoveredCell);
      if (hoveredCell.split) {
        const splitCell = cells[(tooltipData?.idx ?? 0) + hoveredCell.split];
        if (splitCell) {
          highlightedCells.push(splitCell);
        }
      }
    }
  } else if (externalHoverTime) {
    const nextCell = cells.find((c) => c.endTime >= externalHoverTime && c.time <= externalHoverTime);
    if (nextCell) {
      highlightedCells.push(nextCell);
      // TODO: shared tooltip (needs position of cell in client rect)
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
          position={validTooltip}
          offset={{ x: 5, y: 5 }}
          content={
            hoveredCell ? (
              <VizTooltipWrapper className={styles.tooltip}>
                <VizTooltipHeader item={{ label: '', value: dateTimeFormat(hoveredCell.time * 1000, { timeZone }) }} />
                <VizTooltipContent
                  items={[
                    {
                      label: valueField.config.displayName || valueField.config.displayNameFromDS || valueField.name,
                      value: formattedValueToString(display(hoveredCell.value)),
                      color: colorScale(hoveredCell.value),
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
