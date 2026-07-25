/**
 * Tunable constants for the whiteboard canvas and its spatial index.
 * This module is the single source of truth for canvas tuning — no magic
 * numbers live in the components, hooks, or store.
 */

/** Zoom is clamped to this range (adopted from AFFiNE's viewport). */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 6.0;
export const DEFAULT_ZOOM = 1;

/**
 * Uniform-grid cell size in world pixels. 512 is the project's documented
 * tuning target for card-scale content — a single knob, safe to retune later
 * without touching the SpatialGrid implementation.
 */
export const CELL_SIZE = 512;

/**
 * Wheel-zoom sensitivity. `factor = exp(-deltaY * ZOOM_SENSITIVITY)` gives a
 * smooth, direction-correct zoom that is independent of the wheel deltaMode.
 */
export const ZOOM_SENSITIVITY = 0.0015;

/** HUD +/- buttons step the zoom by this multiplicative factor. */
export const ZOOM_STEP = 1.2;

/** Background-grid line colour (adapts to light/dark via currentColor). */
export const GRID_LINE_COLOR = 'color-mix(in srgb, currentColor 12%, transparent)';

/** Default card dimensions in world px — must match the Prisma schema defaults. */
export const DEFAULT_CARD_W = 240;
export const DEFAULT_CARD_H = 160;
