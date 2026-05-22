import { Temporal } from '@js-temporal/polyfill';

/** Grafana passes "browser" to mean the user's local timezone. Temporal requires an IANA identifier. */
export function resolveTimeZone(timeZone: string): string {
  return timeZone === 'browser' ? Temporal.Now.timeZoneId() : timeZone;
}
