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

/** Background-grid line colour — a fixed light gray, kept visible on the white board. */
export const GRID_LINE_COLOR = 'rgba(0, 0, 0, 0.08)';

/** Default card dimensions in world px — must match the Prisma schema defaults. */
export const DEFAULT_CARD_W = 240;
export const DEFAULT_CARD_H = 160;

/** Card resize limits in world px — mirror the server card-bounds SIZE_MIN/MAX. */
export const SIZE_MIN = 40;
export const SIZE_MAX = 10_000;

/**
 * Selection-handle sizing. As of Phase 6 the handles/ports are counter-scaled by
 * `--inv-zoom` (see WorldLayer) so these are effectively CONSTANT SCREEN px.
 * `RESIZE_HANDLE_PX` mirrors the `.whiteboard__resize-handle` CSS size (kept in
 * sync by hand — CSS can't import TS). `ROTATE_HANDLE_OFFSET_PX` is also the
 * world-space rotate hit-anchor offset, divided by zoom at gesture start.
 */
export const RESIZE_HANDLE_PX = 10;
export const ROTATE_HANDLE_OFFSET_PX = 28;

/** Card text size (world px) — mirror the server card-bounds FONT_SIZE_MIN/MAX. */
export const DEFAULT_FONT_SIZE = 14;
export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 96;
export const FONT_SIZE_STEP = 2;

/**
 * Relation arrows (Phase 5b). Rendered in a NON-transformed screen-space SVG, so
 * these are constant screen px. `DEFAULT_CONNECTION_COLOR` mirrors the server
 * default (slate-500). Ports are the connect dots shown on a selected card.
 */
export const DEFAULT_CONNECTION_COLOR = '#64748b';
export const CONNECT_PORT_PX = 11;
export const ARROW_HEAD_PX = 13;
export const CONNECTION_STROKE_PX = 2;
export const CONNECTION_HIT_STROKE_PX = 14;

/** Arrow-key nudge distance for the selected card, in world px (Shift = large). */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 10;
