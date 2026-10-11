import { useTheme2 } from '@grafana/ui';
import React, { Fragment } from 'react';
import { Line } from 'react-konva';
// Registers Line, which react-konva's core entry omits
import 'konva/lib/shapes/Line';
import { Temporal } from 'temporal-polyfill';
import type { Calendar } from '../time/calendar';
import { getDayColumn } from '../plot/makeCells';
import { makeDayTicks } from './dayTicks';
import { useFontEvents } from './useFontEvents';
import { measureTextWidth, TextShape, truncateText } from './TextShape';
import { formatHour, usesTwelveHourClock } from './hourLabels';
import { formatDay } from './dayLabels';
import type { HourFormat } from '../types';

const AXIS_FONT_SIZE = 12;
const DIVISORS_OF_24 = [1, 2, 3, 4, 6, 8, 12, 24];
const WIDEST_SAMPLE_DAY = Temporal.PlainDate.from('2000-12-28');
export const XAxisIndicator: React.FC<{
  x: number;
  y: number;
  height: number;
  width: number;
  calendar: Calendar;
}> = React.memo(({ x, y, width, calendar }) => {
  useFontEvents();
  const theme = useTheme2();
  const { days } = calendar;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- a calendar has at least one day
  const [firstDate, lastDate] = [days[0]!.date, days.at(-1)!.date];
  const totalMonths = firstDate
    .until(lastDate, { largestUnit: 'months' })
    .total({ unit: 'months', relativeTo: firstDate });
  const isLong = totalMonths > 6;
  const fontSize = AXIS_FONT_SIZE;
  // Two-digit month and day sample label plus a one-em gap
  const minLabelSpacing =
    measureTextWidth(formatDay(WIDEST_SAMPLE_DAY, isLong), theme.typography.fontFamily, fontSize) + fontSize;
  const ticks = React.useMemo(
    () => makeDayTicks(days, Math.floor(width / minLabelSpacing)),
    [days, width, minLabelSpacing]
  );

  const spacing = width / ticks.length;
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  return (
    <>
      <Line points={[x, y, x + width, y]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((dayIndex, idx) => {
        const { left, right } = getDayColumn(calendar, dayIndex);
        const tickX = ((left + right) / 2) * width + x;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- ticks index the days
        const label = formatDay(days[dayIndex]!.date, isLong);
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
XAxisIndicator.displayName = 'XAxisIndicator';

export const YAxisIndicator: React.FC<{
  x: number;
  y: number;
  height: number;
  width: number;
  hourFormat: HourFormat;
  /** Labels 24:00, which a band stacked below labels as 0:00 */
  showEndLabel?: boolean;
}> = ({ x, y, width, height, hourFormat, showEndLabel = true }) => {
  'use memo';
  useFontEvents();
  const ticks = Array.from({ length: 25 }, (_, i) => i);
  const theme = useTheme2();
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  const fontSize = AXIS_FONT_SIZE;
  const minTickMod = Math.ceil((fontSize * 1.2) / (height / 24));
  const tickMod = DIVISORS_OF_24.find((divisor) => divisor >= minTickMod) ?? minTickMod;
  const twelveHourClock = usesTwelveHourClock(hourFormat);
  return (
    <>
      <Line points={[x, y, x, y + height]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((hour) => {
        const tickY = y + (hour * height) / 24 + 0.5;
        const label = formatHour(hour, twelveHourClock);
        return (
          <Fragment key={hour}>
            <Line points={[x, tickY, x - 2, tickY]} stroke={colorGrid} strokeWidth={1} />
            {hour % tickMod === 0 && (hour < 24 || showEndLabel) && (
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

export const SeriesLabel: React.FC<{
  x: number;
  y: number;
  width: number;
  name: string;
}> = React.memo(({ x, y, width, name }) => {
  useFontEvents();
  const theme = useTheme2();
  return (
    <TextShape
      text={truncateText(name, width, theme.typography.fontFamily, AXIS_FONT_SIZE)}
      x={x}
      y={y}
      fill={theme.colors.text.secondary}
      width={width}
      baseline="middle"
      fontFamily={theme.typography.fontFamily}
      fontSize={AXIS_FONT_SIZE}
    />
  );
});
SeriesLabel.displayName = 'SeriesLabel';
