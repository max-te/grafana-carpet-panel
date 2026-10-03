import { describe, it, expect } from 'vitest';
import { dateTime, type Field, type TimeRange } from '@grafana/data';
import * as testData from '../testsupport/testdata.json';
import {
  findCellsAt,
  makeCells,
  makeSpanArea,
  makeTimeRangeArea,
  type Area,
  type Cell,
} from '../src/components/makeCells';

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

const expectArea = (actual: Area[], expected: Area[]) => {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((box, i) => {
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      expect(box[side]).toBeCloseTo(expected[i]?.[side] ?? NaN);
    }
  });
};

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
    expect(splitCells).toHaveLength(2);
  });

  describe('with a time step longer than a day', () => {
    const tr = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-04T12:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-04T12:00:00Z' },
    };
    const segmentsOfFirstSample = (times: number[]) => {
      const cells = makeCells([1, 2], times, 'utc', tr);
      return cells.filter((c) => c.time === cells[0]?.time);
    };

    it('should fill every day a midnight-aligned cell covers', () => {
      const segments = segmentsOfFirstSample([
        dateTime('2024-01-01T00:00:00Z').valueOf(),
        dateTime('2024-01-03T00:00:00Z').valueOf(),
      ]);

      expectArea(segments, [
        { left: 0, top: 0, right: 0.25, bottom: 1 },
        { left: 0.25, top: 0, right: 0.5, bottom: 1 },
      ]);
    });

    it('should split a cell crossing two midnights into three segments', () => {
      const segments = segmentsOfFirstSample([
        dateTime('2024-01-01T14:00:00Z').valueOf(),
        dateTime('2024-01-03T02:00:00Z').valueOf(),
      ]);

      expectArea(segments, [
        { left: 0, top: 14 / 24, right: 0.25, bottom: 1 },
        { left: 0.25, top: 0, right: 0.5, bottom: 1 },
        { left: 0.5, top: 0, right: 0.75, bottom: 2 / 24 },
      ]);
      for (const c of segments) {
        expect(c.endTime).toBe(dateTime('2024-01-03T02:00:00Z').valueOf() / 1000);
        expect(c.value).toBe(1);
      }
    });
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

  it('should keep only the last sample at a repeated timestamp', () => {
    const start = dateTime('2024-01-01T23:00:00Z').valueOf();
    const tr = {
      from: dateTime('2024-01-01T00:00:00Z'),
      to: dateTime('2024-01-03T00:00:00Z'),
      raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-03T00:00:00Z' },
    };

    // Two-hour cells; the repeated one crosses midnight
    const cells = makeCells([1, 2, 3], [start, start, start + 7200_000], 'utc', tr);

    expect(cells.map((c) => [c.value, c.split])).toEqual([
      [2, 1],
      [2, 2],
      [3, undefined],
    ]);
    expect(cells.every((c) => c.bottom > c.top)).toBe(true);
  });

  describe('on daylight saving transition days in Europe/Berlin', () => {
    const hourlyCells = (from: string, to: string) => {
      const tr = { from: dateTime(from), to: dateTime(to), raw: { from, to } };
      const times: number[] = [];
      for (let t = tr.from.valueOf(); t < tr.to.valueOf(); t += 3600_000) {
        times.push(t);
      }
      return makeCells(
        times.map(() => 1),
        times,
        'Europe/Berlin',
        tr
      );
    };
    const cellAt = (cells: Cell[], iso: string) => cells.find((c) => c.time === dateTime(iso).valueOf() / 1000);

    it('should scale the 23-hour spring-forward day by its real length', () => {
      const cells = hourlyCells('2025-03-29T00:00:00Z', '2025-04-01T00:00:00Z');
      // Local noon (CEST) is 11 hours after local midnight (CET)
      expect(cellAt(cells, '2025-03-30T10:00:00Z')?.top).toBeCloseTo(11 / 23);
      expect(cellAt(cells, '2025-03-30T10:00:00Z')?.bottom).toBeCloseTo(12 / 23);
    });

    it('should scale the 25-hour fall-back day by its real length', () => {
      const cells = hourlyCells('2025-10-25T00:00:00Z', '2025-10-28T00:00:00Z');
      // Local noon (CET) is 13 hours after local midnight (CEST)
      expect(cellAt(cells, '2025-10-26T11:00:00Z')?.top).toBeCloseTo(13 / 25);
      expect(cellAt(cells, '2025-10-26T11:00:00Z')?.bottom).toBeCloseTo(14 / 25);
    });
  });

  it('should match snapshot with testdata', () => {
    const cells = makeCells(valueValues, timeValues, timeZone, timeRange, height, width);

    expect(cells).toMatchSnapshot();
  });
});

describe('makeTimeRangeArea', () => {
  it('should cover a partial first day, full middle days and a partial last day', () => {
    const tr = {
      from: dateTime('2024-01-01T06:00:00Z'),
      to: dateTime('2024-01-04T12:00:00Z'),
      raw: { from: '2024-01-01T06:00:00Z', to: '2024-01-04T12:00:00Z' },
    };

    expectArea(makeTimeRangeArea('utc', tr), [
      { left: 0, top: 0.25, right: 0.25, bottom: 1 },
      { left: 0.25, top: 0, right: 0.75, bottom: 1 },
      { left: 0.75, top: 0, right: 1, bottom: 0.5 },
    ]);
  });

  it('should cover a range within a single day with one box', () => {
    const tr = {
      from: dateTime('2024-01-01T06:00:00Z'),
      to: dateTime('2024-01-01T18:00:00Z'),
      raw: { from: '2024-01-01T06:00:00Z', to: '2024-01-01T18:00:00Z' },
    };

    expectArea(makeTimeRangeArea('utc', tr), [{ left: 0, top: 0.25, right: 1, bottom: 0.75 }]);
  });
});

describe('makeSpanArea', () => {
  it('should cover the columns between two cells, gaps included', () => {
    const first = { left: 0, top: 0.5, right: 0.25, bottom: 0.6 };
    const last = { left: 0.75, top: 0.1, right: 1, bottom: 0.2 };

    expectArea(makeSpanArea(first, last), [
      { left: 0, top: 0.5, right: 0.25, bottom: 1 },
      { left: 0.25, top: 0, right: 0.75, bottom: 1 },
      { left: 0.75, top: 0, right: 1, bottom: 0.2 },
    ]);
  });
});

describe('findCellsAt', () => {
  const hour = 3600;
  const tr = {
    from: dateTime('2024-01-01T00:00:00Z'),
    to: dateTime('2024-01-04T00:00:00Z'),
    raw: { from: '2024-01-01T00:00:00Z', to: '2024-01-04T00:00:00Z' },
  };
  const at = (iso: string) => dateTime(iso).valueOf() / 1000;
  const startsOf = (cells: Cell[]) => cells.map((c) => new Date(c.time * 1000).toISOString());

  const hourly = makeCells(
    [1, 2, 3, 4],
    ['10:00', '11:00', '12:00', '14:00'].map((t) => dateTime(`2024-01-01T${t}:00Z`).valueOf()),
    'utc',
    tr
  );

  it('should resolve the start of a cell to that cell, not the one ending there', () => {
    expect(startsOf(findCellsAt(hourly, at('2024-01-01T11:00:00Z')))).toEqual(['2024-01-01T11:00:00.000Z']);
  });

  it('should resolve a time within a cell to that cell', () => {
    expect(startsOf(findCellsAt(hourly, at('2024-01-01T11:00:00Z') + hour / 3))).toEqual(['2024-01-01T11:00:00.000Z']);
  });

  it('should find nothing in a data gap', () => {
    expect(findCellsAt(hourly, at('2024-01-01T13:00:00Z'))).toEqual([]);
  });

  it('should return every segment of a split cell, from any of its days', () => {
    const cells = makeCells(
      [1, 2],
      ['2024-01-01T12:00:00Z', '2024-01-03T12:00:00Z'].map((t) => dateTime(t).valueOf()),
      'utc',
      tr
    );
    const segments = findCellsAt(cells, at('2024-01-02T18:00:00Z'));
    expect(segments.map((c) => c.split)).toEqual([1, 2, 3]);
  });
});
