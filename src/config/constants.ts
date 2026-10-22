export const APP_CONFIG = {
  DEFAULT_PORT: 3000,
  VAT_RATE: 0.19, // 19% MwSt
  PRICE_ANOMALY_THRESHOLD_PCT: 15.0, // Alert when delta >= 15%
  DEFAULT_PAGE_SIZE: 15,
  MAX_PAGE_SIZE: 100,
} as const;

export const ROUNDING_MODES = {
  PSYCHOLOGICAL_99: 'PSYCHOLOGICAL_99', // e.g. 19.99
  PSYCHOLOGICAL_49: 'PSYCHOLOGICAL_49', // e.g. 19.49
  EXACT: 'EXACT',                       // 2 decimals exact
  NEAREST_HALF: 'NEAREST_HALF',         // rounds to nearest 0.50
} as const;

export type RoundingMode = (typeof ROUNDING_MODES)[keyof typeof ROUNDING_MODES];
