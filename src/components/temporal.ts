import { Temporal as TemporalPolyfill } from '@js-temporal/polyfill';

/** The browser's own Temporal where it has one, as the polyfill is many times slower */
export const Temporal: typeof TemporalPolyfill =
  (globalThis as { Temporal?: typeof TemporalPolyfill }).Temporal ?? TemporalPolyfill;

// eslint-disable-next-line @typescript-eslint/no-namespace -- lets `Temporal.PlainDate` name the types, as with the polyfill
export declare namespace Temporal {
  export type PlainDate = TemporalPolyfill.PlainDate;
  export type ZonedDateTime = TemporalPolyfill.ZonedDateTime;
}
