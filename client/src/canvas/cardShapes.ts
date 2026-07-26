/** Card shapes + colour helpers (pure — no DOM/React). */
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from './constants';

export type CardShape = 'card' | 'rectangle' | 'ellipse' | 'diamond' | 'triangle';

/** Clamp a text size to the allowed range (rounded to a whole px). */
export function clampFontSize(px: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(px)));
}

export const CARD_SHAPES: readonly CardShape[] = [
  'card',
  'rectangle',
  'ellipse',
  'diamond',
  'triangle',
];

/** Curated fill palette. New cards cycle it so a fresh board isn't all one colour. */
export const PALETTE = [
  '#ffffff',
  '#fee2e2',
  '#ffedd5',
  '#fef9c3',
  '#dcfce7',
  '#dbeafe',
  '#f3e8ff',
  '#e5e7eb',
] as const;

/** Fill colour for the Nth created card — cycles the palette. */
export function defaultCardColor(cardCount: number): string {
  return PALETTE[cardCount % PALETTE.length];
}

/**
 * Black or white body text for legibility on a `#rrggbb` fill, via WCAG relative
 * luminance (threshold 0.179 is the crossover where contrast vs black == vs white).
 */
export function contrastingTextColor(hex: string): '#000000' | '#ffffff' {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) {
    return '#000000';
  }
  const int = parseInt(match[1], 16);
  const channels = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export const SHAPE_CLASS: Record<CardShape, string> = {
  card: 'shape-card',
  rectangle: 'shape-rectangle',
  ellipse: 'shape-ellipse',
  diamond: 'shape-diamond',
  triangle: 'shape-triangle',
};

/** Compact glyphs for the shape picker (paired with an aria-label of the name). */
export const SHAPE_ICON: Record<CardShape, string> = {
  card: '▢',
  rectangle: '▭',
  ellipse: '◯',
  diamond: '◇',
  triangle: '△',
};

/** Coerce a stored shape string to a known CardShape (fallback: 'card'). */
export function toCardShape(shape: string): CardShape {
  return (CARD_SHAPES as readonly string[]).includes(shape) ? (shape as CardShape) : 'card';
}
