import { HourFormat } from '../types';

export function usesTwelveHourClock(hourFormat: HourFormat, locale?: string): boolean {
  if (hourFormat !== HourFormat.Auto) {
    return hourFormat === HourFormat.H12;
  }
  return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
}

/** Label for an hour of the day, 0–24 */
export function formatHour(hour: number, twelveHourClock: boolean): string {
  if (!twelveHourClock) {
    return `${hour.toFixed(0)}:00`;
  }
  const meridiem = hour % 24 < 12 ? 'AM' : 'PM';
  return `${(hour % 12 || 12).toFixed(0)} ${meridiem}`;
}
