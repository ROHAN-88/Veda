import { describe, expect, it } from 'vitest';
import {
  clampFontSize,
  contrastingTextColor,
  defaultCardColor,
  PALETTE,
  toCardShape,
} from './cardShapes';

describe('cardShapes', () => {
  it('contrastingTextColor picks readable text by luminance', () => {
    expect(contrastingTextColor('#ffffff')).toBe('#000000');
    expect(contrastingTextColor('#000000')).toBe('#ffffff');
    expect(contrastingTextColor('#fef9c3')).toBe('#000000'); // light yellow
    expect(contrastingTextColor('#1e3a8a')).toBe('#ffffff'); // dark blue
    expect(contrastingTextColor('nonsense')).toBe('#000000');
  });

  it('defaultCardColor cycles the palette by count', () => {
    expect(defaultCardColor(0)).toBe(PALETTE[0]);
    expect(defaultCardColor(PALETTE.length)).toBe(PALETTE[0]);
    expect(defaultCardColor(1)).toBe(PALETTE[1]);
    expect(defaultCardColor(PALETTE.length + 1)).toBe(PALETTE[1]);
  });

  it('toCardShape coerces unknown shapes to card', () => {
    expect(toCardShape('diamond')).toBe('diamond');
    expect(toCardShape('hexagon')).toBe('card');
    expect(toCardShape('')).toBe('card');
  });

  it('clampFontSize clamps to range and rounds', () => {
    expect(clampFontSize(4)).toBe(8); // below min
    expect(clampFontSize(500)).toBe(96); // above max
    expect(clampFontSize(20)).toBe(20); // in range
    expect(clampFontSize(14.6)).toBe(15); // rounds
  });
});
