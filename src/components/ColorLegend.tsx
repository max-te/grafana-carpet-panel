import { css, cx } from '@emotion/css';
import {
  formattedValueToString,
  getDisplayProcessor,
  getMinMaxAndDelta,
  type Field,
  type GrafanaTheme2,
} from '@grafana/data';
import { type LegendPlacement, useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';
import { sampleGradientStops, type ColorFn } from './useColorScale';

interface Props {
  colorScale: ColorFn;
  valueField: Field<number>;
  timeZone: string;
  placement: LegendPlacement;
  markedValue?: number;
  /** Needed for the right placement, where VizLayout does not stretch the legend */
  height: number;
}

const getStyles = (theme: GrafanaTheme2) => ({
  bottom: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
  }),
  right: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
  }),
  label: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  bar: css({
    flexGrow: 1,
    minWidth: 8,
    minHeight: 8,
    position: 'relative',
    borderRadius: theme.shape.radius.default,
  }),
  // A glyph is positioned at subpixels without being blurred like a box.
  // Grafana's Inter subset covers | and —, but not box drawing characters.
  marker: css({
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: theme.typography.fontFamily,
    fontSize: 16,
    lineHeight: 1,
    color: theme.colors.text.primary,
    pointerEvents: 'none',
    userSelect: 'none',
  }),
  bottomMarker: css({
    top: 0,
    bottom: 0,
    width: '1em',
    transform: 'translateX(-50%)',
    textShadow: `-1px 0 ${theme.colors.background.primary}, 1px 0 ${theme.colors.background.primary}`,
  }),
  rightMarker: css({
    left: 0,
    right: 0,
    height: '1em',
    transform: 'translateY(50%)',
    textShadow: `0 -1px ${theme.colors.background.primary}, 0 1px ${theme.colors.background.primary}`,
  }),
});

// Mirrors d3.scaleSequential, which colors the cells
function getScaleFraction(value: number, min: number, max: number) {
  if (min === max) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export const ColorLegend: React.FC<Props> = ({ colorScale, valueField, timeZone, placement, height, markedValue }) => {
  'use memo';
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const minMax = getMinMaxAndDelta(valueField);
  const display = getDisplayProcessor({ field: valueField, theme, timeZone });
  const min = minMax.min ?? 0;
  const max = minMax.max ?? 1;
  const minLabel = formattedValueToString(display(min));
  const maxLabel = formattedValueToString(display(max));
  const stops = sampleGradientStops(colorScale).join(',');
  // Keeps the marker's stem inside the bar at both ends
  const markerOffset =
    markedValue === undefined
      ? undefined
      : `calc(1px + (100% - 2px) * ${getScaleFraction(markedValue, min, max).toFixed(4)})`;

  // VizLayout moves every legend to the bottom on narrow screens
  const isVertical = placement === 'right' && document.body.clientWidth >= theme.breakpoints.values.lg;
  if (isVertical) {
    return (
      <div className={styles.right} style={{ height }}>
        <span className={styles.label}>{maxLabel}</span>
        <div className={styles.bar} style={{ background: `linear-gradient(0deg, ${stops})` }}>
          {markerOffset && (
            <div className={cx(styles.marker, styles.rightMarker)} style={{ bottom: markerOffset }}>
              ——
            </div>
          )}
        </div>
        <span className={styles.label}>{minLabel}</span>
      </div>
    );
  }
  return (
    <div className={styles.bottom}>
      <span className={styles.label}>{minLabel}</span>
      <div className={styles.bar} style={{ background: `linear-gradient(90deg, ${stops})` }}>
        {markerOffset && (
          <div className={cx(styles.marker, styles.bottomMarker)} style={{ left: markerOffset }}>
            |
          </div>
        )}
      </div>
      <span className={styles.label}>{maxLabel}</span>
    </div>
  );
};
