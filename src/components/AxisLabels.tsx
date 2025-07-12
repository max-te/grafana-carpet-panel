import { useTheme2 } from '@grafana/ui';
import type { ScaleTime } from 'd3';
import React, { Fragment } from 'react';
import { Line, Text } from 'react-konva';
  
export const XAxisIndicator: React.FC<{ x: number; y: number; height: number; width: number; scale: ScaleTime<number, number> }> = ({
    x,
    y,
    width,
    scale,
  }) => {
    const ticks = scale.ticks();
    ticks.forEach((t) => t.setHours(12));
    // TODO: Implement adaptive tick density based on available width to prevent label overlap
    const spacing = width / ticks.length;
    const theme = useTheme2();
    const colorGrid = 'rgba(120, 120, 130, 0.5)';
    const colorText = theme.colors.text.primary;
    return (
      <>
        <Line points={[x, y, x + width, y]} stroke={colorGrid} strokeWidth={1} />
        {ticks.map((date) => {
          const tickX = scale(date) + x;
          const label = date.toLocaleDateString(navigator.language, { month: '2-digit', day: '2-digit' });
          return (
            <Fragment key={label}>
              <Line points={[tickX, y, tickX, y + 4]} stroke={colorGrid} strokeWidth={1} />
              <Text
                text={label}
                x={tickX - spacing / 2}
                y={y + 5}
                fill={colorText}
                align="center"
                fontFamily={theme.typography.fontFamily}
                width={spacing}
                fontSize={theme.typography.htmlFontSize ?? 16}
                wrap="word"
              />
            </Fragment>
          );
        })}
      </>
    );
  };
  
export const YAxisIndicator: React.FC<{ x: number; y: number; height: number; width: number }> = ({ x, y, width, height }) => {
    const ticks = Array.from({ length: 25 }, (_, i) => i);
    const theme = useTheme2();
    const colorGrid = 'rgba(120, 120, 130, 0.5)';
    const colorText = theme.colors.text.primary;
    const fontSize = theme.typography.htmlFontSize ?? 16;
    const tickMod = Math.ceil(fontSize / (height / 24));
    // TODO: Improve tick calculation to find the next divisor of 24 for more natural label spacing
    // TODO: Consider making the hour format configurable (12h vs 24h) based on user locale
    return (
      <>
        <Line points={[x, y, x, y + height]} stroke={colorGrid} strokeWidth={1} />
        {ticks.map((hour) => {
          const tickY = y + (hour * height) / 24;
          const label = `${hour.toString()}h`;
          return (
            <Fragment key={label}>
              <Line points={[x, tickY, x - 2, tickY]} stroke={colorGrid} strokeWidth={1} />
              {hour > 0 && hour % tickMod === 0 && (
                <>
                  <Line points={[x, tickY, x - 4, tickY]} stroke={colorGrid} strokeWidth={1} />
                  <Text
                    text={label}
                    x={x - width}
                    y={tickY - fontSize / 2}
                    fill={colorText}
                    align="right"
                    width={width - 5}
                    fontFamily={theme.typography.fontFamily}
                    fontSize={theme.typography.htmlFontSize ?? 16}
                    textBaseline="middle"
                  />
                </>
              )}
            </Fragment>
          );
        })}
      </>
    );
  };
  