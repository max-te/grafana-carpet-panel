import {
  type Field,
  FieldType,
  type FieldConfig,
  type TimeRange,
  dateTime,
  ThemeContext,
  getThemeById,
} from '@grafana/data';
import { Stage } from 'react-konva';
import { Chart } from '../src/components/Chart';
import React from 'react';
import * as d3 from 'd3';
import { Box, GlobalStyles, PanelContainer, Stack } from '@grafana/ui';
import * as testData from './testdata.json';

export const Harness: React.FC = () => {
  const timeRange: TimeRange = {
    from: dateTime(testData.request.range.from),
    to: dateTime(testData.request.range.to),
    raw: testData.request.range.raw,
  };
  const timeField: Field<number> = testData?.series[0]?.fields[0] as Field<number>;

  const valueField = testData?.series[0]?.fields[1] as Field<number>;

  const theme = getThemeById('light');

  const inlineStyle = `
  body {
    background: ${theme.colors.background.primary};
  }
  `;
  const width = 1200;
  const height = 650;

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <style>{inlineStyle}</style>
      <PanelContainer style={{ padding: theme.spacing(), width: 'min-content', height: 'min-content', margin: 'auto' }}>
        <div style={{ position: 'relative', width: `${width}px`, height: `${height}px`, overflow: 'hidden' }}>
          <Stage width={width} height={height}>
            <Chart
              x={0}
              y={0}
              width={width}
              height={height - 50}
              timeField={timeField}
              valueField={valueField}
              timeZone={'Europe/Berlin'}
              timeRange={timeRange}
              colorPalette={(t) => d3.interpolateViridis(t)}
            />
          </Stage>
        </div>
      </PanelContainer>
    </ThemeContext.Provider>
  );
};
