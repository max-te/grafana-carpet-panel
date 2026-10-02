import { useTheme2 } from '@grafana/ui';
import React, { Fragment } from 'react';
import { Line } from 'react-konva';
import type { TimeRange } from '@grafana/data';
import { Temporal } from '@js-temporal/polyfill';
import { makeTimeScale } from './useTimeScale';
import { makeDayTicks } from './dayTicks';
import { resolveTimeZone } from './timeZone';
import { useFontEvents } from './useFontEvents';
import { measureTextWidth, TextShape } from './TextShape';
import { formatHour, usesTwelveHourClock } from './hourLabels';
import type { HourFormat } from '../types';

const AXIS_FONT_SIZE = 12;
const DIVISORS_OF_24 = [1, 2, 3, 4, 6, 8, 12, 24];
export const XAxisIndicator: React.FC<{
  x: number;
  y: number;
  height: number;
  width: number;
  range: TimeRange;
  timeZone: string;
}> = React.memo(({ x, y, width, range, timeZone }) => {
  useFontEvents();
  const theme = useTheme2();
  const tz = resolveTimeZone(timeZone);
  const fromZdt = Temporal.Instant.fromEpochMilliseconds(range.from.valueOf()).toZonedDateTimeISO(tz);
  const toZdt = Temporal.Instant.fromEpochMilliseconds(range.to.valueOf()).toZonedDateTimeISO(tz);
  const totalMonths = toZdt.since(fromZdt, { largestUnit: 'months' }).total({ unit: 'months', relativeTo: fromZdt });
  const isLong = totalMonths > 6;
  const formatDay = (day: Temporal.PlainDate) => (isLong ? day.toPlainYearMonth() : day.toPlainMonthDay()).toString();
  const scale = React.useMemo(() => makeTimeScale(range, width, timeZone), [range, width, timeZone]);
  const fontSize = AXIS_FONT_SIZE;
  // Widest-digit sample label plus a one-em gap
  const minLabelSpacing =
    measureTextWidth(isLong ? '0000-00' : '00-00', theme.typography.fontFamily, fontSize) + fontSize;
  const ticks = React.useMemo(
    () => makeDayTicks(range, timeZone, Math.floor(width / minLabelSpacing)),
    [range, timeZone, width, minLabelSpacing]
  );

  const spacing = width / ticks.length;
  const colorGrid = 'rgba(120, 120, 130, 0.5)';
  const colorText = theme.colors.text.primary;
  return (
    <>
      <Line points={[x, y, x + width, y]} stroke={colorGrid} strokeWidth={1} />
      {ticks.map((day, idx) => {
        const dayStart = day.toZonedDateTime(tz).epochMilliseconds;
        const nextDayStart = day.add({ days: 1 }).toZonedDateTime(tz).epochMilliseconds;
        const tickX = (scale(dayStart) + scale(nextDayStart)) / 2 + x;
        const label = formatDay(day);
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
}> = ({ x, y, width, height, hourFormat }) => {
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
