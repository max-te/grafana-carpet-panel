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
    const ticks = makeDayTicks(range('2023-12-31T10:00:00Z', '2024-01-03T09:00:00Z'), 'Pacific/Kiritimati', 20);

    expect(ticks.map(String)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('should place weekly ticks on Sundays', () => {
    const ticks = makeDayTicks(range('2025-02-07T23:00:00Z', '2025-05-09T21:59:59Z'), 'Europe/Berlin', 20);

    expect(ticks.length).toBe(13);
    expect(ticks.every((day) => day.dayOfWeek === 7)).toBe(true);
  });

  it('should place monthly ticks on the first of the month', () => {
    const ticks = makeDayTicks(range('2024-01-15T00:00:00Z', '2024-12-15T00:00:00Z'), 'utc', 20);

    expect(ticks.map(String)).toEqual(
      Array.from({ length: 11 }, (_, i) => `2024-${String(i + 2).padStart(2, '0')}-01`)
    );
  });

  it('should thin out ticks when few labels fit', () => {
    const ticks = makeDayTicks(range('2025-02-07T23:00:00Z', '2025-05-09T21:59:59Z'), 'Europe/Berlin', 5);

    expect(ticks.map(String)).toEqual(['2025-03-01', '2025-04-01', '2025-05-01']);
  });

  it('should never produce more ticks than fit', () => {
    for (const days of [1, 3, 10, 40, 91, 200, 400, 1000]) {
      const to = dateTime('2024-01-01T00:00:00Z').add(days, 'days').toISOString();
      for (let maxCount = 3; maxCount <= 40; maxCount++) {
        const ticks = makeDayTicks(range('2024-01-01T00:00:00Z', to), 'utc', maxCount);

        expect(ticks.length).toBeLessThanOrEqual(maxCount);
      }
    }
  });
});
