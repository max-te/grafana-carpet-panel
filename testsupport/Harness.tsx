import { type Field, type TimeRange, dateTime, ThemeContext, getThemeById } from '@grafana/data';
import { Stage } from 'react-konva';
import { CarpetPlot } from '../src/components/CarpetPlot';
type ChartProps = React.ComponentProps<typeof CarpetPlot>;
import React from 'react';
import {
  Box,
  ErrorBoundaryAlert,
  GlobalStyles,
  PanelContainer,
  RadioButtonGroup,
  Slider,
  Space,
  InlineField,
  InlineFieldRow,
  Checkbox,
} from '@grafana/ui';
import * as testData from './testdata.json';
import { useKonvaDpr } from '../src/components/useKonvaDpr';
import { useColorScale } from '../src/components/useColorScale';
import { HeatmapColorMode } from '../src/types';

const timeRange: TimeRange = {
  from: dateTime(testData.request.range.from),
  to: dateTime(testData.request.range.to),
  raw: testData.request.range.raw,
};

export const Harness: React.FC = () => {
  const dpr = useKonvaDpr();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const timeField: Field<number> = testData.series[0]!.fields[0] as Field<number>;

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const valueField = testData.series[0]!.fields[1] as Field<number>;

  const [themeId, setThemeId] = React.useState<'light' | 'dark'>('light');
  const theme = getThemeById(themeId);

  const [colorPaletteName, setColorPaletteName] = React.useState<'Viridis' | 'Plasma'>('Viridis');
  const colorPalette = useColorScale({
    mode: HeatmapColorMode.Scheme,
    scheme: colorPaletteName,
    reverse: false,
    fill: '',
  });

  const inlineStyle = `
  body {
    background: ${theme.colors.background.primary};
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  :root {
    scrollbar-gutter: stable both-edges;
  }
  `;

  const [width, setWidth] = React.useState<number>(1000);
  const [height, setHeight] = React.useState<number>(360);
  const [gapWidth, setGapWidth] = React.useState<number>(0);
  const [showXAxis, setShowXAxis] = React.useState<boolean>(true);
  const [showYAxis, setShowYAxis] = React.useState<boolean>(true);

  const chartProps: ChartProps = {
    width,
    height,
    timeField,
    valueField,
    timeZone: 'Europe/Berlin',
    timeRange,
    colorPalette,
    gapWidth,
    showXAxis,
    showYAxis,
    onHover(cell) {
      console.debug('Hover Event', cell);
    },
    onChangeTimeRange(range) {
      console.debug('Change Time Range', range);
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <style>{inlineStyle}</style>
      <PanelContainer style={{ padding: theme.spacing(), width: 'min-content', height: 'min-content', margin: 'auto' }}>
        <ErrorBoundaryAlert>
          <Stage width={width} height={height} key={dpr}>
            <CarpetPlot {...chartProps} />
          </Stage>
        </ErrorBoundaryAlert>
      </PanelContainer>
      <Space v={2} />
      <Box backgroundColor={'primary'} borderColor={'strong'} borderStyle={'solid'} padding={0.5}>
        <InlineField label="Width" grow>
          <Slider value={width} onChange={setWidth} min={100} max={1000} />
        </InlineField>
        <InlineField label="Height" grow>
          <Slider value={height} onChange={setHeight} min={32} max={400} />
        </InlineField>

        <InlineFieldRow>
          <InlineField label="Theme">
            <RadioButtonGroup
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              value={themeId}
              onChange={setThemeId}
            />
          </InlineField>

          <InlineField label="Color Palette">
            <RadioButtonGroup
              options={[
                { value: 'Viridis', label: 'Viridis' },
                { value: 'Plasma', label: 'Plasma' },
              ]}
              value={colorPaletteName}
              onChange={setColorPaletteName}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineField label="Gap" grow>
          <Slider value={gapWidth} onChange={setGapWidth} min={0} max={10} step={0.5} />
        </InlineField>
        <InlineFieldRow>
          <InlineField>
            <Checkbox value={showXAxis} onChange={(e) => setShowXAxis(e.currentTarget.checked)} label="show X axis" />
          </InlineField>
          <InlineField>
            <Checkbox value={showYAxis} onChange={(e) => setShowYAxis(e.currentTarget.checked)} label="show Y axis" />
          </InlineField>
        </InlineFieldRow>
      </Box>
    </ThemeContext.Provider>
  );
};
