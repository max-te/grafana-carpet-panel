import { describe, it, expect } from 'vitest';
import { dateTime } from '@grafana/data';
import { Temporal } from 'temporal-polyfill';
import { makeCalendar } from '../src/time/calendar';

const range = (from: string, to: string) => ({ from: dateTime(from), to: dateTime(to), raw: { from, to } });
const at = (iso: string) => dateTime(iso).valueOf();
const hours = (n: number) => n * 3_600_000;

describe('makeCalendar', () => {
  it('should list every day the range touches, from midnight to midnight', () => {
    const { days } = makeCalendar(range('2024-01-01T06:00:00Z', '2024-01-03T12:00:00Z'), 'utc');
    expect(days.map((day) => [day.date.toString(), day.start, day.end])).toEqual([
      ['2024-01-01', at('2024-01-01T00:00:00Z'), at('2024-01-02T00:00:00Z')],
      ['2024-01-02', at('2024-01-02T00:00:00Z'), at('2024-01-03T00:00:00Z')],
      ['2024-01-03', at('2024-01-03T00:00:00Z'), at('2024-01-04T00:00:00Z')],
    ]);
  });

  it('should keep the range itself', () => {
    const { from, to } = makeCalendar(range('2024-01-01T06:00:00.250Z', '2024-01-03T12:00:00Z'), 'utc');
    expect([from, to]).toEqual([at('2024-01-01T06:00:00.250Z'), at('2024-01-03T12:00:00Z')]);
  });

  it('should see the days in the given time zone', () => {
    // 10:00 UTC is already midnight of the next day at UTC+14
    const { days } = makeCalendar(range('2023-12-31T10:00:00Z', '2024-01-03T09:00:00Z'), 'Pacific/Kiritimati');
    expect(days.map((day) => day.date.toString())).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });

  it('should resolve the browser time zone', () => {
    const r = range('2024-01-01T06:00:00Z', '2024-01-03T12:00:00Z');
    expect(makeCalendar(r, 'browser').days).toEqual(makeCalendar(r, Temporal.Now.timeZoneId()).days);
  });

  it('should list days before the epoch', () => {
    const { days } = makeCalendar(range('1969-12-31T20:00:00Z', '1970-01-01T04:00:00Z'), 'utc');
    expect(days.map((day) => [day.date.toString(), day.start])).toEqual([
      ['1969-12-31', Date.UTC(1969, 11, 31)],
      ['1970-01-01', 0],
    ]);
  });

  describe('on daylight saving transition days in Europe/Berlin', () => {
    const lengths = (from: string, to: string) =>
      makeCalendar(range(from, to), 'Europe/Berlin').days.map((day) => (day.end - day.start) / hours(1));

    it('should give the spring-forward day 23 hours', () => {
      expect(lengths('2025-03-29T12:00:00Z', '2025-03-31T12:00:00Z')).toEqual([24, 23, 24]);
    });

    it('should give the fall-back day 25 hours', () => {
      expect(lengths('2025-10-25T12:00:00Z', '2025-10-27T12:00:00Z')).toEqual([24, 25, 24]);
    });

    it('should scale the time of day by the real length of the day', () => {
      const { timeOfDay } = makeCalendar(range('2025-03-29T12:00:00Z', '2025-10-27T12:00:00Z'), 'Europe/Berlin');
      // Local noon is 11 hours after local midnight on the 23-hour day, and 13 hours on the 25-hour day
      expect(timeOfDay(at('2025-03-30T10:00:00Z'))).toBeCloseTo(11 / 23);
      expect(timeOfDay(at('2025-10-26T11:00:00Z'))).toBeCloseTo(13 / 25);
    });
  });

  describe('dayAt', () => {
    const { dayAt } = makeCalendar(range('2024-01-01T06:00:00Z', '2024-01-03T12:00:00Z'), 'utc');

    it('should find the day holding an instant, midnight belonging to the day it starts', () => {
      expect(dayAt(at('2024-01-01T00:00:00Z'))).toBe(0);
      expect(dayAt(at('2024-01-01T23:59:59.999Z'))).toBe(0);
      expect(dayAt(at('2024-01-02T00:00:00Z'))).toBe(1);
      expect(dayAt(at('2024-01-03T23:59:59.999Z'))).toBe(2);
    });

    it('should find nothing outside the days of the range', () => {
      expect(dayAt(at('2023-12-31T23:59:59.999Z'))).toBeUndefined();
      expect(dayAt(at('2024-01-04T00:00:00Z'))).toBeUndefined();
    });
  });

  it('should place an instant within its day', () => {
    const { timeOfDay } = makeCalendar(range('2024-01-01T06:00:00Z', '2024-01-03T12:00:00Z'), 'utc');
    expect(timeOfDay(at('2024-01-02T00:00:00Z'))).toBe(0);
    expect(timeOfDay(at('2024-01-02T18:00:00Z'))).toBe(0.75);
    expect(timeOfDay(at('2024-01-04T00:00:00Z'))).toBeUndefined();
  });
});
