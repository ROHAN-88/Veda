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

/** Allowed card shapes (a fixed allowlist — the client maps each to a CSS class). */
export const SHAPES = ['card', 'rectangle', 'ellipse', 'diamond', 'triangle'] as const;

/** Fill colour must be a `#rrggbb` hex string (used only as a CSS colour value). */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const ROTATION_MIN = -360;
export const ROTATION_MAX = 360;

/** Card text size in world px. */
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 96;

/** Max items in a bulk update/delete/restore request (bounds request size, CWE-400). */
export const BULK_MAX = 500;

/**
 * `@IsNumber` options rejecting NaN/Infinity. JSON can't carry either, but being
 * explicit documents the intent and guards non-JSON callers (CWE-20 / CWE-400).
 */
export const FINITE = { allowNaN: false, allowInfinity: false } as const;
