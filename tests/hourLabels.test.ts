import { describe, it, expect } from 'vitest';
import { formatHour, usesTwelveHourClock } from '../src/components/hourLabels';
import { HourFormat } from '../src/types';

describe('formatHour', () => {
  it('should label the 24h clock from 0:00 to 24:00', () => {
    expect([0, 9, 12, 23, 24].map((hour) => formatHour(hour, false))).toEqual([
      '0:00',
      '9:00',
      '12:00',
      '23:00',
      '24:00',
    ]);
  });

  it('should label both midnights as 12 AM on the 12h clock', () => {
    expect([0, 1, 11, 12, 13, 23, 24].map((hour) => formatHour(hour, true))).toEqual([
      '12 AM',
      '1 AM',
      '11 AM',
      '12 PM',
      '1 PM',
      '11 PM',
      '12 AM',
    ]);
  });
});

describe('usesTwelveHourClock', () => {
  it('should follow an explicit format regardless of locale', () => {
    expect(usesTwelveHourClock(HourFormat.H12, 'de-DE')).toBe(true);
    expect(usesTwelveHourClock(HourFormat.H24, 'en-US')).toBe(false);
  });

  it('should follow the locale in auto mode', () => {
    expect(usesTwelveHourClock(HourFormat.Auto, 'en-US')).toBe(true);
    expect(usesTwelveHourClock(HourFormat.Auto, 'de-DE')).toBe(false);
  });
});
