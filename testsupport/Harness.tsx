import { type Field, type TimeRange, dateTime, ThemeContext, getThemeById } from '@grafana/data';
import { Stage } from 'react-konva';
import { Chart } from '../src/components/Chart';
type ChartProps = React.ComponentProps<typeof Chart>;
import React from 'react';
import * as d3 from 'd3';
import { Box, Field as InputField, GlobalStyles, PanelContainer, RadioButtonGroup, Slider, Space, Stack, Label, Switch, InlineSwitch, InlineField, InlineFieldRow, Checkbox } from '@grafana/ui';
import * as testData from './testdata.json';

export const Harness: React.FC = () => {
  const timeRange: TimeRange = {
    from: dateTime(testData.request.range.from),
    to: dateTime(testData.request.range.to),
    raw: testData.request.range.raw,
  };
  const timeField: Field<number> = testData.series[0]!.fields[0] as Field<number>;

  const valueField = testData.series[0]!.fields[1] as Field<number>;

  const [themeId, setThemeId] = React.useState<'light' | 'dark'>('light');
  const theme = getThemeById(themeId);

  const [colorPaletteName, setColorPaletteName] = React.useState<'viridis' | 'plasma'>('viridis');
  const colorPalette = colorPaletteName === 'viridis' ? d3.interpolateViridis : d3.interpolatePlasma;

  const inlineStyle = `
  body {
    background: ${theme.colors.background.primary};
    margin: 0;
    padding: 0;
    box-sizing: border-box;
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
  };

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <style>{inlineStyle}</style>
      <PanelContainer style={{ padding: theme.spacing(), width: 'min-content', height: 'min-content', margin: 'auto' }}>
        <div style={{ position: 'relative', width: `${width}px`, height: `${height}px`, overflow: 'hidden' }}>
          <Stage width={width} height={height}>
            <Chart {...chartProps} />
          </Stage>
        </div>
      </PanelContainer>
      <Space v={2}/>
      <Box backgroundColor={"primary"} borderColor={"strong"} borderStyle={"solid"} padding={0.5}>

      <InlineField label="Width" grow>
          <Slider value={width} onChange={setWidth} min={100} max={1000} />
        </InlineField>
        <InlineField label="Height" grow>
          <Slider value={height} onChange={setHeight} min={32} max={400} />
        </InlineField>

        <InlineFieldRow>
        <InlineField label="Theme">
          <RadioButtonGroup options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} value={themeId} onChange={setThemeId} />
        </InlineField>

        <InlineField label="Color Palette">
          <RadioButtonGroup options={[{ value: 'viridis', label: 'Viridis' }, { value: 'plasma', label: 'Plasma' }]} value={colorPaletteName} onChange={setColorPaletteName} />
        </InlineField></InlineFieldRow>
        <InlineField label="Gap" grow>
          <Slider value={gapWidth} onChange={setGapWidth} min={0} max={10} step={0.5} />
        </InlineField>
        <InlineFieldRow>
          <InlineField>
          <Checkbox value={showXAxis} onChange={(e) => setShowXAxis(e.target.checked)} label="show X axis" />
          </InlineField>
          <InlineField>
          <Checkbox value={showYAxis} onChange={(e) => setShowYAxis(e.target.checked)} label="show Y axis" />
          </InlineField>
        </InlineFieldRow>
          </Box>
    </ThemeContext.Provider>
  );
};
