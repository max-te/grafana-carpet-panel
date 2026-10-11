import { css, cx } from '@emotion/css';
import { getDisplayProcessor, type Field, type GrafanaTheme2 } from '@grafana/data';
import { type LegendPlacement, useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';
import type { CellValue } from './categories';

interface Props {
  colors: Map<CellValue, string>;
  valueField: Field<CellValue>;
  timeZone: string;
  placement: LegendPlacement;
  markedValue?: CellValue;
}

const getStyles = (theme: GrafanaTheme2) => ({
  bottom: css({
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: theme.spacing(2),
    paddingTop: theme.spacing(1),
  }),
  right: css({
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(1),
  }),
  item: css({
    ...theme.typography.bodySmall,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  markedItem: css({
    color: theme.colors.text.primary,
  }),
  swatch: css({
    width: 10,
    height: 10,
    flexShrink: 0,
    borderRadius: theme.shape.radius.default,
  }),
});

export const CategoryLegend: React.FC<Props> = ({ colors, valueField, timeZone, placement, markedValue }) => {
  'use memo';
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const display = getDisplayProcessor({ field: valueField, theme, timeZone });

  // VizLayout moves every legend to the bottom on narrow screens
  const isVertical = placement === 'right' && document.body.clientWidth >= theme.breakpoints.values.lg;
  return (
    <div className={isVertical ? styles.right : styles.bottom}>
      {Array.from(colors, ([value, color]) => (
        <div key={String(value)} className={cx(styles.item, value === markedValue && styles.markedItem)}>
          <span className={styles.swatch} style={{ background: color }} />
          {display(value).text}
        </div>
      ))}
    </div>
  );
};
