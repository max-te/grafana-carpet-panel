import { useTheme2 } from '@grafana/ui';
import React, { Fragment } from 'react';
import { Line } from 'react-konva';
import { dateTimeFormat, type TimeRange } from '@grafana/data';
import { makeTimeScale } from './useTimeScale';
import { useFontEvents } from './useFontEvents';
import { TextShape } from './TextShape';

const AXIS_FONT_SIZE = 12;
export const XAxisIndicator: React.FC<{
  x: number;
  y: number;
  height: number;
  width: number;
  range: TimeRange;
}> = React.memo(({ x, y, width, range }) => {
  useFontEvents();
  const theme = useTheme2();
  const isLong = range.to.diff(range.from, 'months') > 6;
  const format = isLong ? 'YYYY-MM' : 'MM-DD';
  const scale = React.useMemo(() => makeTimeScale(range, width), [range, width]);
  const ticks = React.useMemo(() => {
    const ts = scale.ticks();
    ts.forEach((t) => t.setHours(12));
    if (isLong) ts.forEach((t) => t.setDate(1));
    return ts;
  }, [scale]);

  // TODO: Implement adaptive tick density based on available width to prevent label overlap
  const spacing = width / ticks.length;
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  const fontSize = AXIS_FONT_SIZE;
  return (
    <>
      <Line points={[x, y, x + width, y]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((date, idx) => {
        const tickX = scale(date) + x;
        const label = dateTimeFormat(date, { format });
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- In the Konva context, this is okay. Using the date causes a bug where stale labels remain.
          <Fragment key={idx}>
            <Line points={[tickX, y, tickX, y + 4]} stroke={colorGrid} strokeWidth={1} />
            <TextShape
              text={label}
              x={tickX}
              y={y + 7}
              fill={colorText}
              width={spacing}
              align="center"
              baseline="top"
              fontFamily={theme.typography.fontFamily}
              fontSize={fontSize}
            />
          </Fragment>
        );
      })}
    </>
  );
});

export const YAxisIndicator: React.FC<{ x: number; y: number; height: number; width: number }> = ({
  x,
  y,
  width,
  height,
}) => {
  'use memo';
  useFontEvents();
  const ticks = Array.from({ length: 25 }, (_, i) => i);
  const theme = useTheme2();
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  const fontSize = AXIS_FONT_SIZE;
  const tickMod = Math.ceil((fontSize * 1.2) / (height / 24));
  // TODO: Improve tick calculation to find the next divisor of 24 for more natural label spacing
  // TODO: Consider making the hour format configurable (12h vs 24h) based on user locale
  return (
    <>
      <Line points={[x, y, x, y + height]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((hour) => {
        const tickY = y + (hour * height) / 24 + 0.5;
        const label = `${hour.toFixed(0)}:00`;
        return (
          <Fragment key={label}>
            <Line points={[x, tickY, x - 2, tickY]} stroke={colorGrid} strokeWidth={1} />
            {hour % tickMod === 0 && (
              <>
                <Line points={[x, tickY, x - 4, tickY]} stroke={colorGrid} strokeWidth={1} />
                <TextShape
                  text={label}
                  x={x - 6}
                  y={tickY}
                  fill={colorText}
                  width={width - 6}
                  align="right"
                  baseline="middle"
                  fontFamily={theme.typography.fontFamily}
                  fontSize={fontSize}
                />
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
};
