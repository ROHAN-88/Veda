/**
 * Shared validation bounds for card geometry + content (Phase 4). Centralised so
 * the create and update DTOs stay in lock-step and the limits are one edit away.
 */
export const COORD_MIN = -1_000_000;
export const COORD_MAX = 1_000_000;
export const SIZE_MIN = 40;
export const SIZE_MAX = 10_000;
export const CONTENT_MAX = 10_000;
export const ZINDEX_MAX = 2_147_483_647; // Postgres INT4 upper bound

/**
 * `@IsNumber` options rejecting NaN/Infinity. JSON can't carry either, but being
 * explicit documents the intent and guards non-JSON callers (CWE-20 / CWE-400).
 */
export const FINITE = { allowNaN: false, allowInfinity: false } as const;
