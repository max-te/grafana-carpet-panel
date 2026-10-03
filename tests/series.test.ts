import { describe, it, expect } from 'vitest';
import { FieldType, toDataFrame, type DataFrame } from '@grafana/data';
import { findSeries } from '../src/components/series';
import type { CarpetPanelOptions } from '../src/types';

const options = (overrides: Partial<CarpetPanelOptions> = {}) => overrides as CarpetPanelOptions;

const time = { name: 'Time', type: FieldType.time, values: [0, 3600] };

const labelled = (host: string): DataFrame =>
  toDataFrame({
    fields: [time, { name: 'Value', type: FieldType.number, values: [1, 2], labels: { host } }],
  });

const names = (frames: DataFrame[], overrides?: Partial<CarpetPanelOptions>) =>
  findSeries(frames, options(overrides)).map((series) => series.name);

describe('findSeries', () => {
  it('finds one series per frame of a labelled query', () => {
    expect(names([labelled('a'), labelled('b')])).toEqual(['a', 'b']);
  });

  it('finds one series per number column of a wide frame', () => {
    const frame = toDataFrame({
      fields: [
        time,
        { name: 'cpu', type: FieldType.number, values: [1, 2] },
        { name: 'host', type: FieldType.string, values: ['a', 'a'] },
        { name: 'mem', type: FieldType.number, values: [3, 4] },
      ],
    });
    expect(names([frame])).toEqual(['cpu', 'mem']);
  });

  it('pairs each value field with the time field of its own frame', () => {
    const [a, b] = [labelled('a'), labelled('b')];
    const series = findSeries([a, b], options());
    expect(series.map((s) => s.timeField)).toEqual([a.fields[0], b.fields[0]]);
  });

  it('filters by a field name that recurs in every frame', () => {
    const other = toDataFrame({ fields: [time, { name: 'Other', type: FieldType.number, values: [5, 6] }] });
    expect(names([labelled('a'), other, labelled('b')], { valueField: { name: 'Value' } })).toEqual(['a', 'b']);
  });

  it('filters by a display name to pick a single series', () => {
    expect(names([labelled('a'), labelled('b')], { valueField: { name: 'b' } })).toEqual(['b']);
  });

  it('skips frames without a time field', () => {
    const timeless = toDataFrame({ fields: [{ name: 'Value', type: FieldType.number, values: [1] }] });
    expect(names([timeless, labelled('a')])).toEqual(['a']);
  });

  it('uses the configured time field and never shows it as a value', () => {
    const frame = toDataFrame({
      fields: [
        time,
        { name: 'epoch', type: FieldType.number, values: [0, 3600] },
        { name: 'cpu', type: FieldType.number, values: [1, 2] },
      ],
    });
    const series = findSeries([frame], options({ timeFieldName: 'epoch' }));
    expect(series.map((s) => [s.timeField.name, s.name])).toEqual([['epoch', 'cpu']]);
  });

  it('falls back to categorical fields when there are no numbers', () => {
    const frame = toDataFrame({
      fields: [
        time,
        { name: 'state', type: FieldType.string, values: ['idle', 'busy'] },
        { name: 'up', type: FieldType.boolean, values: [true, false] },
      ],
    });
    expect(names([frame])).toEqual(['state', 'up']);
  });

  it('prefers number fields over categorical ones in any frame', () => {
    const states = toDataFrame({ fields: [time, { name: 'state', type: FieldType.string, values: ['idle', 'busy'] }] });
    expect(names([states, labelled('a')])).toEqual(['a']);
  });
});
