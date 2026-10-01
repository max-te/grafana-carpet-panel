import { describe, it, expect } from 'vitest';
import { dateTime, type Field, type TimeRange } from '@grafana/data';
import * as testData from '../testsupport/testdata.json';
import { makeCells } from '../src/components/makeCells';

const timeRange: TimeRange = {
  from: dateTime(testData.request.range.from),
  to: dateTime(testData.request.range.to),
  raw: testData.request.range.raw,
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const timeField: Field<number> = testData.series[0]!.fields[0] as Field<number>;
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const valueField = testData.series[0]!.fields[1] as Field<number>;

const timeValues = timeField.values;
const valueValues = valueField.values;

const timeZone = 'Europe/Berlin';
const width = 1000;
const height = 360;

describe('makeCells', () => {
  it('should produce consistent output for testdata', () => {
    const cells = makeCells(valueValues, timeValues, timeZone, timeRange, height, width);

    expect(cells).toBeDefined();
    expect(Array.isArray(cells)).toBe(true);
    expect(cells.length).toBeGreaterThan(0);
  });

  it('should handle null values by skipping them', () => {
    const valuesWithNull = [1, 2, null, 3, 4] as Array<number | null>;
    const times = [1000, 2000, 3000, 4000, 5000];
    const tr = {
      from: dateTime(1000),
      to: dateTime(6000),
      raw: { from: '1970-01-01T00:00:01Z', to: '1970-01-01T00:00:06Z' },
    };

    const cells = makeCells(valuesWithNull, times, 'utc', tr, 100, 100);

    expect(cells.length).toBe(4);
  });

  it('should create cells spanning date boundaries with split', () => {
    const times = [dateTime('2024-01-01T22:00:00Z').valueOf(), dateTime('2024-01-02T02:00:00Z').valueOf()];
    const values = [1, 2];
    const tr = {
      from: dateTime('2024-01-01T20:00:00Z'),
      to: dateTime('2024-01-02T04:00:00Z'),
      raw: {
        from: '2024-01-01T20:00:00Z',
        to: '2024-01-02T04:00:00Z',
      },
    };

    const cells = makeCells(values, times, 'utc', tr, 100, 200);

    const splitCells = cells.filter((c) => c.split !== undefined);
    expect(splitCells.length).toBeGreaterThan(0);
  });

  it('should handle pre-epoch dates', () => {
    // Dec 31, 1969 22:00 UTC → Jan 1, 1970 02:00 UTC (spans epoch)
    const times = [Date.UTC(1969, 11, 31, 22, 0, 0), Date.UTC(1970, 0, 1, 2, 0, 0)];
    const values = [1, 2];
    const tr = {
      from: dateTime(Date.UTC(1969, 11, 31, 20, 0, 0)),
      to: dateTime(Date.UTC(1970, 0, 1, 4, 0, 0)),
      raw: { from: '1969-12-31T20:00:00Z', to: '1970-01-01T04:00:00Z' },
    };

    const cells = makeCells(values, times, 'utc', tr, 100, 200);

    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.right).toBeGreaterThan(c.left);
      expect(c.bottom).toBeGreaterThanOrEqual(c.top);
    }
  });

  it('should place the first day column at its date when data starts late', () => {
    const start = dateTime('2024-01-03T00:00:00Z').valueOf();
    const times = [start, start + 3600_000];
    const tr = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-04T12:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-04T12:00:00Z' },
    };

    const cells = makeCells([1, 2], times, 'utc', tr);

    for (const c of cells) {
      expect(c.left).toBeCloseTo(0.5);
      expect(c.right).toBeCloseTo(0.75);
    }
  });

  it('should handle a single data point', () => {
    const tr = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-02T00:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-02T00:00:00Z' },
    };

    const cells = makeCells([1], [dateTime('2024-01-01T10:00:00Z').valueOf()], 'utc', tr);

    expect(cells.length).toBe(1);
  });

  it('should ignore duplicate timestamps when deriving the cell height', () => {
    const start = dateTime('2024-01-01T10:00:00Z').valueOf();
    const tr = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-02T00:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-02T00:00:00Z' },
    };

    const cells = makeCells([1, 2, 3], [start, start, start + 3600_000], 'utc', tr);

    for (const c of cells) {
      expect(c.bottom - c.top).toBeCloseTo(1 / 24);
    }
  });

  it('should match snapshot with testdata', () => {
    const cells = makeCells(valueValues, timeValues, timeZone, timeRange, height, width);

    expect(cells).toMatchSnapshot();
  });
});
