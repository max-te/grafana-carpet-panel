import { css } from '@emotion/css';
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
    borderRadius: theme.shape.radius.default,
  }),
});

// TODO: Mark the hovered cell's value on the gradient
export const ColorLegend: React.FC<Props> = ({ colorScale, valueField, timeZone, placement, height }) => {
  'use memo';
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const minMax = getMinMaxAndDelta(valueField);
  const display = getDisplayProcessor({ field: valueField, theme, timeZone });
  const minLabel = formattedValueToString(display(minMax.min ?? 0));
  const maxLabel = formattedValueToString(display(minMax.max ?? 1));
  const stops = sampleGradientStops(colorScale).join(',');

  // VizLayout moves every legend to the bottom on narrow screens
  const isVertical = placement === 'right' && document.body.clientWidth >= theme.breakpoints.values.lg;
  if (isVertical) {
    return (
      <div className={styles.right} style={{ height }}>
        <span className={styles.label}>{maxLabel}</span>
        <div className={styles.bar} style={{ background: `linear-gradient(0deg, ${stops})` }} />
        <span className={styles.label}>{minLabel}</span>
      </div>
    );
  }
  return (
    <div className={styles.bottom}>
      <span className={styles.label}>{minLabel}</span>
      <div className={styles.bar} style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <span className={styles.label}>{maxLabel}</span>
    </div>
  );
};
