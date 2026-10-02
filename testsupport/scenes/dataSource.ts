import {
  createDataFrame,
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  FieldType,
  toDataFrame,
} from '@grafana/data';
import { RuntimeDataSource } from '@grafana/scenes';
import type { DataQuery } from '@grafana/schema';
import * as testData from '../testdata.json';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

interface Range {
  from: number;
  to: number;
}

type Generator = (range: Range) => DataFrame[];

/** Deterministic pseudo-random number in [0, 1), derived from the timestamp alone. */
function noise(time: number): number {
  let h = Math.imul(Math.floor(time / 1000) >>> 0, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 2 ** 32;
}

/** Irradiance-like daily curve peaking at 12:00 UTC, zero at night. */
function solar(time: number): number {
  const dayFraction = (time % day) / day;
  return Math.max(0, Math.sin((dayFraction - 0.25) * 2 * Math.PI)) * 800 * (0.6 + 0.4 * noise(time));
}

function sampleTimes({ from, to }: Range, step: number): number[] {
  const times: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) {
    times.push(t);
  }
  return times;
}

function timeSeries(times: number[], values: Array<number | null>): DataFrame {
  return createDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      { name: 'Value', type: FieldType.number, values },
    ],
  });
}

function sampled(step: number, value: (time: number) => number | null): Generator {
  return (range) => {
    const times = sampleTimes(range, step);
    return [timeSeries(times, times.map(value))];
  };
}

function fractionOf({ from, to }: Range, fraction: number): number {
  return from + (to - from) * fraction;
}

export const recordedRange = testData.request.range;

export const generators = {
  recorded: () => [toDataFrame(testData.series[0])],

  'solar-1m': sampled(minute, solar),
  'solar-15m': sampled(15 * minute, solar),
  'solar-1h': sampled(hour, solar),
  'solar-6h': sampled(6 * hour, solar),
  // Coarse steps land on a fixed time of day, so the daily curve would be constant
  'noise-25h': sampled(25 * hour, (t) => 100 * noise(t)),
  'noise-3d': sampled(3 * day, (t) => 100 * noise(t)),

  'gap-middle': (range) => {
    const times = sampleTimes(range, hour).filter((t) => t < fractionOf(range, 0.4) || t > fractionOf(range, 0.6));
    return [timeSeries(times, times.map(solar))];
  },
  'partial-coverage': (range) => {
    const times = sampleTimes(range, hour).filter((t) => t > fractionOf(range, 0.25) && t < fractionOf(range, 0.6));
    return [timeSeries(times, times.map(solar))];
  },
  nulls: sampled(hour, (t) => {
    const r = noise(t + 1);
    return r < 0.1 ? null : r < 0.2 ? NaN : solar(t);
  }),
  jittered: (range) => {
    const times: number[] = [];
    for (let t = range.from; t <= range.to; t += (10 + Math.floor(noise(t) * 100)) * minute) {
      times.push(t);
    }
    return [timeSeries(times, times.map(solar))];
  },
  duplicates: (range) => {
    const times = sampleTimes(range, hour).flatMap((t) => [t, t]);
    return [
      timeSeries(
        times,
        times.map((t, i) => solar(t) * (i % 2 ? 0.5 : 1))
      ),
    ];
  },

  constant: sampled(hour, () => 42),
  'all-zero': sampled(hour, () => 0),
  negative: sampled(hour, (t) => 50 * Math.sin(((t % day) / day) * 2 * Math.PI) + 10 * noise(t)),
  'extreme-range': sampled(hour, (t) => 10 ** (noise(t) * 15 - 6)),
  'single-point': (range) => {
    const time = Math.round(fractionOf(range, 0.5) / hour) * hour;
    return [timeSeries([time], [100])];
  },
  'two-points': (range) => {
    const times = [fractionOf(range, 0.3), fractionOf(range, 0.7)].map((t) => Math.round(t / hour) * hour);
    return [timeSeries(times, [10, 90])];
  },

  'no-series': () => [],
  'empty-frame': () => [timeSeries([], [])],
  'no-time-field': (range) => [
    createDataFrame({
      fields: [{ name: 'Value', type: FieldType.number, values: sampleTimes(range, hour).map(solar) }],
    }),
  ],
  'no-number-field': (range) => {
    const times = sampleTimes(range, hour);
    return [
      createDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: times },
          { name: 'State', type: FieldType.string, values: times.map((t) => (solar(t) > 0 ? 'day' : 'night')) },
        ],
      }),
    ];
  },
  'number-in-second-frame': (range) => {
    const times = sampleTimes(range, hour);
    return [
      createDataFrame({
        fields: [
          { name: 'Time', type: FieldType.time, values: times },
          { name: 'State', type: FieldType.string, values: times.map(() => 'unknown') },
        ],
      }),
      timeSeries(times, times.map(solar)),
    ];
  },
  'named-fields': (range) => {
    const times = sampleTimes(range, hour);
    return [
      createDataFrame({
        fields: [
          { name: 'Created', type: FieldType.time, values: times.map((t) => t - 3 * hour) },
          { name: 'Measured', type: FieldType.time, values: times },
          { name: 'Power', type: FieldType.number, values: times.map(() => 1) },
          { name: 'Energy', type: FieldType.number, values: times.map(solar) },
        ],
      }),
    ];
  },
} satisfies Record<string, Generator>;

export type GeneratorName = keyof typeof generators;

export interface CarpetTestQuery extends DataQuery {
  // Optional so the data source stays assignable to RuntimeDataSource<DataQuery>
  generator?: GeneratorName;
}

export class CarpetTestDataSource extends RuntimeDataSource<CarpetTestQuery> {
  static readonly uid = 'carpet-testdata';

  constructor() {
    super('carpet-testdata', CarpetTestDataSource.uid);
  }

  query(request: DataQueryRequest<CarpetTestQuery>): Promise<DataQueryResponse> {
    const range = { from: request.range.from.valueOf(), to: request.range.to.valueOf() };
    return Promise.resolve({
      data: request.targets.flatMap((query) => (query.generator ? generators[query.generator](range) : [])),
    });
  }
}
