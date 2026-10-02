import { DashboardCursorSync, MappingType } from '@grafana/data';
import {
  behaviors,
  EmbeddedScene,
  type SceneObject,
  SceneControlsSpacer,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimePicker,
  SceneTimeRange,
  SceneTimeZoneOverride,
  VizPanel,
  type VizPanelState,
} from '@grafana/scenes';
import { HeatmapColorMode, HeatmapColorScale, type CarpetPanelOptions } from '../../src/types';
import { CarpetTestDataSource, type GeneratorName, recordedRange } from './dataSource';
import { carpetPluginId } from './runtime';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  build: () => EmbeddedScene;
}

type CarpetPanelSpec = Pick<VizPanelState<CarpetPanelOptions>, 'title'> &
  Partial<Pick<VizPanelState<CarpetPanelOptions>, 'description' | 'options' | 'fieldConfig' | '$timeRange'>> & {
    generator: GeneratorName;
  };

function carpetPanel({ generator, ...state }: CarpetPanelSpec): VizPanel<CarpetPanelOptions> {
  return new VizPanel<CarpetPanelOptions>({
    pluginId: carpetPluginId,
    ...state,
    $data: new SceneQueryRunner({
      datasource: { uid: CarpetTestDataSource.uid, type: CarpetTestDataSource.uid },
      queries: [{ refId: 'A', generator }],
    }),
  });
}

function carpetScene({
  from,
  to,
  timeZone = 'browser',
  sync,
  body,
}: {
  from: string;
  to: string;
  timeZone?: string;
  sync?: DashboardCursorSync;
  body: SceneObject;
}): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from, to, timeZone }),
    $behaviors: sync === undefined ? undefined : [new behaviors.CursorSync({ sync })],
    controls: [new SceneControlsSpacer(), new SceneTimePicker({})],
    body,
  });
}

function grid(panels: SceneObject[], minColumnWidth = '480px'): SceneCSSGridLayout {
  return new SceneCSSGridLayout({
    templateColumns: `repeat(auto-fill, minmax(${minColumnWidth}, 1fr))`,
    autoRows: '320px',
    children: panels,
  });
}

const fortnight = { from: '2025-06-02T00:00:00.000Z', to: '2025-06-16T00:00:00.000Z' };

export const scenarios: Scenario[] = [
  {
    id: 'options',
    title: 'Panel options',
    description: 'The recorded Grafana response from the plain harness, under different option sets.',
    build: () =>
      carpetScene({
        ...recordedRange,
        timeZone: 'Europe/Berlin',
        body: grid([
          carpetPanel({ title: 'Defaults', generator: 'recorded' }),
          carpetPanel({
            title: 'Opacity, exponential',
            generator: 'recorded',
            options: {
              color: {
                mode: HeatmapColorMode.Opacity,
                fill: 'orange',
                scale: HeatmapColorScale.Exponential,
                exponent: 0.4,
              },
            },
          }),
          carpetPanel({
            title: 'Reversed Plasma, gap, both axes',
            generator: 'recorded',
            options: { color: { scheme: 'Plasma', reverse: true }, gapWidth: 2, axes: { showX: true, showY: true } },
          }),
          carpetPanel({
            title: 'Clamped color scale 200–400, unit W/m²',
            generator: 'recorded',
            options: { color: { min: 200, max: 400 }, valueField: { unit: 'Wm2' } },
          }),
          carpetPanel({
            title: 'No axes, no hatching',
            generator: 'recorded',
            options: { axes: { showX: false, showY: false }, hatchGaps: false },
          }),
          carpetPanel({ title: 'Legend', generator: 'recorded', options: { legend: { show: true } } }),
        ]),
      }),
  },
  {
    id: 'crosshair',
    title: 'Crosshair sync',
    description:
      'Shared crosshair across panels of different resolution. Hovering one panel must highlight the same instant in the others; dragging selects a time range for all.',
    build: () =>
      carpetScene({
        ...fortnight,
        sync: DashboardCursorSync.Crosshair,
        body: grid([
          carpetPanel({ title: 'Hourly', generator: 'solar-1h' }),
          carpetPanel({ title: '15 minutes', generator: 'solar-15m' }),
          carpetPanel({ title: '6 hours', generator: 'solar-6h' }),
          carpetPanel({ title: 'Irregular', generator: 'jittered' }),
        ]),
      }),
  },
  {
    id: 'shared-tooltip',
    title: 'Shared tooltip',
    description:
      'Shared tooltip sync. Hovering one panel must show the tooltip of the same instant in every other panel that is fully on screen.',
    build: () =>
      carpetScene({
        ...fortnight,
        sync: DashboardCursorSync.Tooltip,
        body: grid([
          carpetPanel({ title: 'Hourly', generator: 'solar-1h' }),
          carpetPanel({ title: '15 minutes', generator: 'solar-15m' }),
          carpetPanel({ title: '6 hours', generator: 'solar-6h' }),
        ]),
      }),
  },
  {
    id: 'resolution',
    title: 'Sample resolution',
    description:
      'Step sizes from one minute up to three days. Steps beyond 24 h split cells across one or more midnights.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid([
          carpetPanel({ title: '1 minute (20 160 cells)', generator: 'solar-1m' }),
          carpetPanel({ title: '15 minutes', generator: 'solar-15m' }),
          carpetPanel({ title: '1 hour', generator: 'solar-1h' }),
          carpetPanel({ title: '6 hours', generator: 'solar-6h' }),
          carpetPanel({ title: '25 hours (one midnight, drifting)', generator: 'noise-25h' }),
          carpetPanel({ title: '3 days (several midnights)', generator: 'noise-3d' }),
        ]),
      }),
  },
  {
    id: 'gaps',
    title: 'Gaps and irregular data',
    description: 'Missing samples, partial coverage of the time range, null and NaN values, jitter and duplicates.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid([
          carpetPanel({ title: 'Gap in the middle fifth', generator: 'gap-middle' }),
          carpetPanel({ title: 'Data covers 25–60 % of the range', generator: 'partial-coverage' }),
          carpetPanel({
            title: 'Data covers 25–60 % of the range, no hatching',
            generator: 'partial-coverage',
            options: { hatchGaps: false },
          }),
          carpetPanel({ title: '10 % null, 10 % NaN', generator: 'nulls' }),
          carpetPanel({ title: 'Jittered steps of 10–110 minutes', generator: 'jittered' }),
          carpetPanel({ title: 'Every timestamp twice', generator: 'duplicates' }),
        ]),
      }),
  },
  {
    id: 'values',
    title: 'Degenerate values',
    description:
      'Value distributions that stress the color scale: no spread, negative values, many decades, too few points.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid([
          carpetPanel({ title: 'Constant 42', generator: 'constant' }),
          carpetPanel({ title: 'All zero', generator: 'all-zero' }),
          carpetPanel({ title: 'Negative and positive', generator: 'negative' }),
          carpetPanel({ title: '10⁻⁶ … 10⁹', generator: 'extreme-range' }),
          carpetPanel({ title: 'Single point', generator: 'single-point' }),
          carpetPanel({ title: 'Two points', generator: 'two-points' }),
          carpetPanel({
            title: 'Inverted color bounds (min > max)',
            generator: 'solar-1h',
            options: { color: { min: 600, max: 100 } },
          }),
        ]),
      }),
  },
  {
    id: 'fields',
    title: 'Field resolution',
    description: 'Frames the panel cannot or can only partly use, and explicit field-name options.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid([
          carpetPanel({ title: 'No series', generator: 'no-series' }),
          carpetPanel({ title: 'Empty frame', generator: 'empty-frame' }),
          carpetPanel({ title: 'No time field', generator: 'no-time-field' }),
          carpetPanel({ title: 'String field only', generator: 'no-number-field' }),
          carpetPanel({ title: 'Number field only in second frame', generator: 'number-in-second-frame' }),
          carpetPanel({
            title: 'Two time and number fields, defaults',
            description: 'Picks the first of each: `Created` (shifted by 3 h) and the constant `Power`.',
            generator: 'named-fields',
          }),
          carpetPanel({
            title: 'Two time and number fields, Measured / Energy selected',
            generator: 'named-fields',
            options: { timeFieldName: 'Measured', valueField: { name: 'Energy' } },
          }),
          carpetPanel({
            title: 'Selected fields do not exist',
            generator: 'named-fields',
            options: { timeFieldName: 'Missing', valueField: { name: 'Missing' } },
          }),
        ]),
      }),
  },
  {
    id: 'timezones',
    title: 'Time zones',
    description:
      'The same data, peaking at 12:00 UTC, in zones with whole, half-hour and three-quarter-hour offsets as well as the date-line extremes.',
    build: () =>
      carpetScene({
        ...fortnight,
        sync: DashboardCursorSync.Crosshair,
        body: grid(
          [
            'browser',
            'utc',
            'America/New_York',
            'Asia/Kolkata',
            'Pacific/Chatham',
            'Pacific/Kiritimati',
            'Pacific/Pago_Pago',
          ].map((timeZone) =>
            carpetPanel({
              title: timeZone,
              generator: 'solar-15m',
              options: { axes: { showY: true } },
              $timeRange: new SceneTimeZoneOverride({ timeZone }),
            })
          )
        ),
      }),
  },
  {
    id: 'dst',
    title: 'Daylight saving transitions',
    description:
      'Each panel spans one week around a transition: 23 h and 25 h days, and the 30-minute shift of Lord Howe Island.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid(
          [
            { title: 'Europe/Berlin, spring forward', timeZone: 'Europe/Berlin', from: '2025-03-27', to: '2025-04-03' },
            { title: 'Europe/Berlin, fall back', timeZone: 'Europe/Berlin', from: '2025-10-23', to: '2025-10-30' },
            {
              title: 'America/New_York, spring forward',
              timeZone: 'America/New_York',
              from: '2025-03-06',
              to: '2025-03-13',
            },
            {
              title: 'Australia/Lord_Howe, fall back 30 min',
              timeZone: 'Australia/Lord_Howe',
              from: '2025-04-02',
              to: '2025-04-09',
            },
          ].map(({ title, timeZone, from, to }) =>
            carpetPanel({
              title,
              generator: 'solar-15m',
              options: { axes: { showY: true } },
              $timeRange: new SceneTimeRange({ from: `${from}T00:00:00.000Z`, to: `${to}T00:00:00.000Z`, timeZone }),
            })
          )
        ),
      }),
  },
  {
    id: 'sizes',
    title: 'Sizes and ranges',
    description: 'Extreme panel dimensions, and time ranges from a few hours up to a year.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: new SceneFlexLayout({
          direction: 'row',
          wrap: 'wrap',
          children: [
            ...[
              { title: 'Tiny (140×80)', width: 140, height: 80 },
              { title: 'Small (240×140)', width: 240, height: 140 },
              { title: 'Tall and narrow (200×600)', width: 200, height: 600 },
              { title: 'Wide and flat (1200×120)', width: 1200, height: 120 },
            ].map(
              ({ title, width, height }) =>
                new SceneFlexItem({
                  width,
                  height,
                  body: carpetPanel({ title, generator: 'solar-1h' }),
                })
            ),
            ...[
              { title: 'Six hours, within one day', from: 'now-6h', to: 'now', generator: 'solar-15m' as const },
              { title: 'Last 7 days, ending mid-day', from: 'now-7d', to: 'now', generator: 'solar-1h' as const },
              {
                title: 'One year, hourly',
                from: '2024-06-01T00:00:00.000Z',
                to: '2025-06-01T00:00:00.000Z',
                generator: 'solar-1h' as const,
              },
            ].map(
              ({ title, from, to, generator }) =>
                new SceneFlexItem({
                  minWidth: 480,
                  height: 320,
                  body: carpetPanel({ title, generator, $timeRange: new SceneTimeRange({ from, to }) }),
                })
            ),
          ],
        }),
      }),
  },
  {
    id: 'categorical',
    title: 'Categorical values',
    description:
      'String, boolean and enum fields. Value mappings and enum colors color their categories; the classic palette colors the rest.',
    build: () =>
      carpetScene({
        ...fortnight,
        body: grid([
          carpetPanel({ title: 'Strings, palette', generator: 'states', options: { legend: { show: true } } }),
          carpetPanel({
            title: 'Strings, value mappings for off, running and fault, right',
            generator: 'states',
            options: { legend: { show: true, placement: 'right' }, gapWidth: 1 },
            fieldConfig: {
              defaults: {
                mappings: [
                  {
                    type: MappingType.ValueToText,
                    options: {
                      off: { text: 'Off', color: 'transparent' },
                      running: { text: 'Running', color: 'green' },
                      fault: { text: 'Fault', color: 'red' },
                    },
                  },
                ],
              },
              overrides: [],
            },
          }),
          carpetPanel({ title: 'Booleans', generator: 'daylight', options: { legend: { show: true } } }),
          carpetPanel({
            title: 'Enum, purple for Off only',
            generator: 'enum-states',
            options: { legend: { show: true } },
          }),
        ]),
      }),
  },
  {
    id: 'legend',
    title: 'Legend',
    description: 'The color legend below and beside the plot, labelled with the formatted ends of the color scale.',
    build: () =>
      carpetScene({
        ...recordedRange,
        timeZone: 'Europe/Berlin',
        body: grid([
          carpetPanel({ title: 'Bottom', generator: 'recorded', options: { legend: { show: true } } }),
          carpetPanel({
            title: 'Right',
            generator: 'recorded',
            options: { legend: { show: true, placement: 'right' } },
          }),
          carpetPanel({
            title: 'Opacity, bottom',
            generator: 'recorded',
            options: {
              color: { mode: HeatmapColorMode.Opacity, fill: 'orange' },
              legend: { show: true },
            },
          }),
          carpetPanel({
            title: 'Clamped 200–400, unit W/m², right',
            generator: 'recorded',
            options: {
              color: { min: 200, max: 400 },
              valueField: { unit: 'Wm2' },
              legend: { show: true, placement: 'right' },
            },
          }),
        ]),
      }),
  },
];
