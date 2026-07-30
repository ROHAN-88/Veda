import { describe, expect, it } from 'vitest';
import { parseVideoEmbed, transformCardUrl } from './media';

describe('parseVideoEmbed', () => {
  it('parses YouTube watch / short / embed URLs to a nocookie embed', () => {
    const src = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
    expect(parseVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.src).toBe(src);
    expect(parseVideoEmbed('https://youtu.be/dQw4w9WgXcQ')?.src).toBe(src);
    expect(parseVideoEmbed('https://youtube.com/embed/dQw4w9WgXcQ')?.src).toBe(src);
  });

  it('parses Vimeo URLs to a player embed', () => {
    expect(parseVideoEmbed('https://vimeo.com/123456789')?.src).toBe(
      'https://player.vimeo.com/video/123456789',
    );
    expect(parseVideoEmbed('https://player.vimeo.com/video/123456789')?.provider).toBe('vimeo');
  });

  it('returns null for non-video / unsafe URLs', () => {
    expect(parseVideoEmbed('https://example.com/page')).toBeNull();
    expect(parseVideoEmbed('javascript:alert(1)')).toBeNull();
    expect(parseVideoEmbed('not a url')).toBeNull();
    expect(parseVideoEmbed('https://youtube.com/watch?v=bad id!')).toBeNull();
  });
});

describe('transformCardUrl', () => {
  it('allows only relative image src (uploads), drops external images', () => {
    expect(transformCardUrl('/api/uploads/abc', 'src')).toBe('/api/uploads/abc');
    expect(transformCardUrl('https://evil.example/pixel.gif', 'src')).toBe('');
    expect(transformCardUrl('//evil.example/x.png', 'src')).toBe('');
  });

  it('allows safe link schemes + relative hrefs, drops dangerous ones', () => {
    expect(transformCardUrl('https://example.com', 'href')).toBe('https://example.com');
    expect(transformCardUrl('mailto:a@b.com', 'href')).toBe('mailto:a@b.com');
    expect(transformCardUrl('/projects/1', 'href')).toBe('/projects/1');
    expect(transformCardUrl('javascript:alert(1)', 'href')).toBe('');
    expect(transformCardUrl('data:text/html,x', 'href')).toBe('');
  });
});
