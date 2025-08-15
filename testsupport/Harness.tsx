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
  Legend,
  Text,
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

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const timeField: Field<number> = testData.series[0]!.fields[0] as Field<number>;

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const valueField = testData.series[0]!.fields[1] as Field<number>;

export const Harness: React.FC = () => {
  const dpr = useKonvaDpr();
  const [themeId, setThemeId] = React.useState<'light' | 'dark'>('light');
  const theme = getThemeById(themeId);

  const [colorPaletteName, setColorPaletteName] = React.useState<'Viridis' | 'Plasma'>('Viridis');
  const colorOptions = React.useMemo(
    () => ({
      mode: HeatmapColorMode.Scheme,
      scheme: colorPaletteName,
      reverse: false,
      fill: '',
    }),
    [colorPaletteName]
  );
  const colorPalette = useColorScale(colorOptions);

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
  const [lastHover, setLastHover] = React.useState<string>('null');
  const [timeRangeUpdate, updateTimeRange] = React.useState<{ from: number; to: number } | null>(null);

  const chartProps: ChartProps = {
    width,
    height,
    timeField,
    valueField,
    timeZone: 'Europe/Berlin',
    timeRange,
    colorPalette: colorPalette.call,
    gapWidth,
    showXAxis,
    showYAxis,
    onHover(cell) {
      console.debug('Hover Event', cell);
      setLastHover(JSON.stringify(cell));
    },
    onChangeTimeRange(range) {
      console.debug('Change Time Range', range);
      updateTimeRange(range);
    },
  };

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <style>{inlineStyle}</style>
      <PanelContainer
        style={{ padding: theme.spacing(), width: 'min-content', height: 'min-content', margin: ' 5px auto' }}
      >
        <Legend>Panel test</Legend>
        <ErrorBoundaryAlert>
          <Stage width={width} height={height} key={dpr}>
            <CarpetPlot {...chartProps} />
          </Stage>
        </ErrorBoundaryAlert>
      </PanelContainer>
      <Space v={2} />
      <Box backgroundColor={'secondary'} padding={1} margin={1}>
        <Text>
          Last hover event: <code>{lastHover}</code>
        </Text>
      </Box>
      {timeRangeUpdate && (
        <Box backgroundColor={'info'} padding={1} margin={1}>
          <Text>
            Time range updated: {timeRangeUpdate.from} - {timeRangeUpdate.to}
          </Text>
        </Box>
      )}
      <Box backgroundColor={'primary'} borderColor={'strong'} borderStyle={'solid'} padding={1} margin={1}>
        <Legend>Panel options</Legend>
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
