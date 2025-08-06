import { useTheme2 } from '@grafana/ui';
import React, { Fragment } from 'react';
import { Line, Shape } from 'react-konva';
import { dateTimeFormat, type TimeRange } from '@grafana/data';
import { makeTimeScale } from './useTimeScale';
import { useFontEvents } from './useFontEvents';

const AXIS_FONT_SIZE = 12;
export const XAxisIndicator: React.FC<{
  x: number;
  y: number;
  height: number;
  width: number;
  range: TimeRange;
}> = ({ x, y, width, range }) => {
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
            <Shape
              text={label}
              x={tickX}
              y={y + 5 + fontSize}
              fontBaseline="top"
              fill={colorText}
              align="center"
              fontFamily={theme.typography.fontFamily}
              width={spacing}
              fontSize={fontSize}
              wrap="word"
              sceneFunc={textRenderFunc}
            />
          </Fragment>
        );
      })}
    </>
  );
};

type ShapeFunc = Parameters<typeof Shape>[0]['sceneFunc'];
const textRenderFunc: ShapeFunc = (context, shape) => {
  context.textAlign = shape.attrs.align;
  context.textBaseline = shape.attrs.textBaseline;
  context.font = `${shape.attrs.fontSize}px ${shape.attrs.fontFamily}`;
  context.fillStyle = shape.fill();
  context.fillText(shape.attrs.text, 0, 0, shape.width());
};

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
                <Shape
                  text={label}
                  x={x - 6}
                  y={tickY}
                  fill={colorText}
                  align="right"
                  width={width - 6}
                  fontFamily={theme.typography.fontFamily}
                  fontSize={fontSize}
                  textBaseline="middle"
                  sceneFunc={textRenderFunc}
                />
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
};
