import { describe, it, expect } from 'vitest';
import { dateTime } from '@grafana/data';
import { makeDayTicks } from '../src/components/dayTicks';

const range = (from: string, to: string) => ({
  from: dateTime(from),
  to: dateTime(to),
  raw: { from, to },
});

describe('makeDayTicks', () => {
  it('should produce one tick per day of the given time zone', () => {
    // 2024-01-01 00:00 to 2024-01-03 23:00 in UTC+14
    const ticks = makeDayTicks(range('2023-12-31T10:00:00Z', '2024-01-03T09:00:00Z'), 'Pacific/Kiritimati');

    expect(ticks.map(String)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('should place weekly ticks on Sundays', () => {
    const ticks = makeDayTicks(range('2025-02-07T23:00:00Z', '2025-05-09T21:59:59Z'), 'Europe/Berlin');

    expect(ticks.length).toBe(13);
    expect(ticks.every((day) => day.dayOfWeek === 7)).toBe(true);
  });

  it('should place monthly ticks on the first of the month', () => {
    const ticks = makeDayTicks(range('2024-01-15T00:00:00Z', '2024-12-15T00:00:00Z'), 'utc');

    expect(ticks.map(String)).toEqual(
      Array.from({ length: 11 }, (_, i) => `2024-${String(i + 2).padStart(2, '0')}-01`)
    );
  });
});
