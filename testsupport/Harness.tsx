import { type Field, type TimeRange, dateTime, ThemeContext, getThemeById } from '@grafana/data';
import { Stage } from 'react-konva';
import { CarpetPlot } from '../src/components/CarpetPlot';
type ChartProps = React.ComponentProps<typeof CarpetPlot>;
import React from 'react';
import {
  Box,
  ErrorBoundaryAlert,
  GlobalStyles,
  PortalContainer,
  RadioButtonGroup,
  Slider,
  Space,
  InlineField,
  InlineFieldRow,
  Checkbox,
  Input,
  Legend,
  Text,
  TooltipDisplayMode,
  VizLayout,
  type LegendPlacement,
} from '@grafana/ui';
import { ColorLegend } from '../src/components/ColorLegend';
import * as testData from './testdata.json';
import { useKonvaDpr } from '../src/components/useKonvaDpr';
import { useColorScale } from '../src/components/useColorScale';
import { HeatmapColorMode, HourFormat, type HeatmapColorOptions } from '../src/types';

const timeRange: TimeRange = {
  from: dateTime(testData.request.range.from),
  to: dateTime(testData.request.range.to),
  raw: testData.request.range.raw,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const timeField: Field<number> = testData.series[0]!.fields[0] as Field<number>;

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const valueField = testData.series[0]!.fields[1] as Field<number>;

const minHeight = 32;
const maxHeight = 400;
const minWidth = 100;
const maxWidth = 1000;

// Must render inside ThemeContext so the palette follows the selected theme
const ThemedCarpetPlot: React.FC<
  Omit<ChartProps, 'colorPalette'> & {
    colorOptions: HeatmapColorOptions;
    legend: { show: boolean; placement: LegendPlacement };
    dpr: number;
  }
> = ({ colorOptions, legend, dpr, ...chartProps }) => {
  const colorPalette = useColorScale(colorOptions);
  const { width, height, valueField, timeZone } = chartProps;
  return (
    <VizLayout
      width={width}
      height={height}
      legend={
        legend.show ? (
          <VizLayout.Legend placement={legend.placement}>
            <ColorLegend
              colorScale={colorPalette}
              valueField={valueField}
              timeZone={timeZone}
              placement={legend.placement}
              height={height}
            />
          </VizLayout.Legend>
        ) : null
      }
    >
      {(vizWidth, vizHeight) => (
        <Stage width={Math.trunc(vizWidth)} height={Math.trunc(vizHeight)} key={dpr}>
          <CarpetPlot
            {...chartProps}
            width={Math.trunc(vizWidth)}
            height={Math.trunc(vizHeight)}
            colorPalette={colorPalette.call}
          />
        </Stage>
      )}
    </VizLayout>
  );
};

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
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStartRef = React.useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = { startX: e.clientX, startY: e.clientY, startWidth: width, startHeight: height };
  };

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStartRef.current) {
        return;
      }
      const dx = moveEvent.clientX - resizeStartRef.current.startX;
      const dy = moveEvent.clientY - resizeStartRef.current.startY;
      setWidth(Math.max(minWidth, Math.min(maxWidth, resizeStartRef.current.startWidth + 2 * dx))); // double effect due to centering
      setHeight(Math.max(minHeight, Math.min(maxHeight, resizeStartRef.current.startHeight + dy)));
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const [gapWidth, setGapWidth] = React.useState<number>(0);
  const [hatchGaps, setHatchGaps] = React.useState<boolean>(true);
  const [showXAxis, setShowXAxis] = React.useState<boolean>(true);
  const [showYAxis, setShowYAxis] = React.useState<boolean>(true);
  const [hourFormat, setHourFormat] = React.useState<HourFormat>(HourFormat.Auto);
  const [decimals, setDecimals] = React.useState<number | undefined>(undefined);
  const [tooltipMode, setTooltipMode] = React.useState<TooltipDisplayMode>(TooltipDisplayMode.Single);
  const [tooltipMaxWidth, setTooltipMaxWidth] = React.useState<number | undefined>(undefined);
  const [showLegend, setShowLegend] = React.useState<boolean>(false);
  const [legendPlacement, setLegendPlacement] = React.useState<LegendPlacement>('bottom');
  const displayedValueField = React.useMemo(
    () => ({ ...valueField, config: { ...valueField.config, decimals } }),
    [decimals]
  );
  const [lastHover, setLastHover] = React.useState<string>('null');
  const [timeRangeUpdate, setTimeRangeUpdate] = React.useState<{ from: number; to: number } | null>(null);

  const chartProps: Omit<ChartProps, 'colorPalette'> = {
    width,
    height,
    timeField,
    valueField: displayedValueField,
    timeZone: 'Europe/Berlin',
    timeRange,
    gapWidth,
    hatchGaps,
    showXAxis,
    showYAxis,
    hourFormat,
    tooltipMode,
    tooltipMaxWidth,
    onHover(cell) {
      console.info('Hover Event', cell);
      setLastHover(JSON.stringify(cell));
    },
    onChangeTimeRange(range) {
      console.info('Change Time Range', range);
      setTimeRangeUpdate(range);
    },
  };

  return (
    <ThemeContext value={theme}>
      <GlobalStyles />
      <PortalContainer />
      <style>{inlineStyle}</style>
      <Box paddingX={2} paddingTop={1}>
        <a href="scenes.html" style={{textDecoration: "underline"}}>Scenes</a>
      </Box>
      <Box padding={1} display="flex" justifyContent={'center'} width={'100%'} height={'min-content'} marginY={1}>
        <Box padding={1} borderColor={'medium'} borderStyle={'solid'}>
          <Legend>Paneltest</Legend>
          <div style={{ position: 'relative' }}>
            <ErrorBoundaryAlert>
              <ThemedCarpetPlot
                {...chartProps}
                colorOptions={colorOptions}
                legend={{ show: showLegend, placement: legendPlacement }}
                dpr={dpr}
              />
            </ErrorBoundaryAlert>
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                bottom: -8,
                right: -8,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                background: 'linear-gradient(135deg, transparent 50%, #999 50%)',
                borderRadius: '0 0 4px 0',
              }}
            />
          </div>
        </Box>
      </Box>
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
          <Slider inputId="gap" value={gapWidth} onChange={setGapWidth} min={0} max={10} step={0.5} />
        </InlineField>
        <InlineFieldRow>
          <InlineField>
            <Checkbox
              value={hatchGaps}
              onChange={(e) => {
                setHatchGaps(e.currentTarget.checked);
              }}
              label="hatch data gaps"
            />
          </InlineField>
          <InlineField>
            <Checkbox
              value={showXAxis}
              onChange={(e) => {
                setShowXAxis(e.currentTarget.checked);
              }}
              label="show X axis"
            />
          </InlineField>
          <InlineField>
            <Checkbox
              value={showYAxis}
              onChange={(e) => {
                setShowYAxis(e.currentTarget.checked);
              }}
              label="show Y axis"
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Hour format">
            <RadioButtonGroup
              options={[
                { value: HourFormat.Auto, label: 'Auto' },
                { value: HourFormat.H24, label: '24h' },
                { value: HourFormat.H12, label: '12h' },
              ]}
              value={hourFormat}
              onChange={setHourFormat}
            />
          </InlineField>
          <InlineField label="Decimals">
            <Input
              type="number"
              min={0}
              max={10}
              width={10}
              placeholder="auto"
              value={decimals ?? ''}
              onChange={(e) => {
                const { value } = e.currentTarget;
                setDecimals(value === '' ? undefined : Number(value));
              }}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tooltip">
            <RadioButtonGroup
              options={[
                { value: TooltipDisplayMode.Single, label: 'Single' },
                { value: TooltipDisplayMode.None, label: 'Hidden' },
              ]}
              value={tooltipMode}
              onChange={setTooltipMode}
            />
          </InlineField>
          <InlineField label="Tooltip max width">
            <Input
              type="number"
              min={0}
              width={10}
              placeholder="auto"
              value={tooltipMaxWidth ?? ''}
              onChange={(e) => {
                const { value } = e.currentTarget;
                setTooltipMaxWidth(value === '' ? undefined : Number(value));
              }}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField>
            <Checkbox
              value={showLegend}
              onChange={(e) => {
                setShowLegend(e.currentTarget.checked);
              }}
              label="show legend"
            />
          </InlineField>
          <InlineField label="Legend placement">
            <RadioButtonGroup
              options={[
                { value: 'bottom', label: 'Bottom' },
                { value: 'right', label: 'Right' },
              ]}
              value={legendPlacement}
              onChange={setLegendPlacement}
            />
          </InlineField>
        </InlineFieldRow>
      </Box>
    </ThemeContext>
  );
};
