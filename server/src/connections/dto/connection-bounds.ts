/**
 * Shared validation bounds for connection (relation arrow) DTOs. Kept
 * self-contained so the connections module has no dependency on the cards
 * module; the hex-colour rule intentionally matches the cards convention.
 */

/** #rrggbb only — the same 6-digit form the cards module accepts. */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Default arrow colour (slate-500); mirrors the Prisma schema default. */
export const DEFAULT_CONNECTION_COLOR = '#64748b';
