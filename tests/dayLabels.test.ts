import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { formatDay } from '../src/components/dayLabels';

describe('formatDay', () => {
  const day = Temporal.PlainDate.from('2026-10-02');

  it('should order month and day by locale', () => {
    expect(formatDay(day, false, 'en-US')).toBe('10/2');
    expect(formatDay(day, false, 'de-DE')).toBe('2.10.');
  });

  it('should show month and year for long ranges', () => {
    expect(formatDay(day, true, 'en-US')).toBe('10/2026');
    expect(formatDay(day, true, 'ja-JP')).toBe('2026/10');
  });
});
