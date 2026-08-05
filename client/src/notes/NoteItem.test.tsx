import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Card } from '../api/types';
import { NoteItem } from './NoteItem';

const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';

const card = (content: string, overrides: Partial<Card> = {}): Card => ({
  id: 'c1',
  projectId: 'p1',
  x: 0,
  y: 0,
  w: 240,
  h: 160,
  content,
  shape: 'card',
  color: '#ffffff',
  rotation: 0,
  fontSize: 14,
  zIndex: 0,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
  ...overrides,
});

/** Render one note to an HTML string (node env — no DOM needed). */
const render = (content: string, overrides?: Partial<Card>): string =>
  renderToStaticMarkup(<NoteItem card={card(content, overrides)} />);

describe('NoteItem — content', () => {
  it('renders the derived title as a heading', () => {
    const html = render('# Sprint plan\nbody text');
    expect(html).toContain('<h2 class="notes__title">Sprint plan</h2>');
  });

  it('renders the card body', () => {
    expect(render('# Sprint plan\nbody text')).toContain('body text');
  });

  // The feature's headline requirement: notes must show the board's images.
  it('renders a same-origin uploaded image', () => {
    const html = render(`Design\n![shot](${IMG})`);
    expect(html).toContain('<img');
    expect(html).toContain('whiteboard__card-media-img');
    expect(html).toContain(IMG);
  });

  // The CSS clamp itself is not observable in node; what matters here is that the
  // stored width still reaches the DOM for `max-width: 100%` to act on.
  it('keeps an explicit width and the sized class', () => {
    const html = render(`![shot](${IMG} "w=4000")`);
    expect(html).toContain('style="width:4000px"');
    expect(html).toContain('sized');
  });

  it('falls back to Untitled and an empty-card body for a blank card', () => {
    const html = render('   \n\t ');
    expect(html).toContain('Untitled');
    expect(html).toContain('notes__title muted');
    expect(html).toContain('Empty card');
  });

  it('shows the card colour on an aria-hidden chip', () => {
    const html = render('note', { color: '#fee2e2' });
    expect(html).toContain('background:#fee2e2');
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('NoteItem — security', () => {
  it('does not load an external image', () => {
    expect(render('![alt](https://example.com/tracker.png)')).not.toContain('<img');
  });

  it('strips javascript: link URLs', () => {
    expect(render('[click](javascript:alert(1))')).not.toContain('javascript:');
  });

  it('escapes raw HTML in the body instead of executing it', () => {
    const html = render('text\n<img src=x onerror="alert(1)">');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  // The title is the ONE string this feature builds itself out of user content, so
  // it is the one place that could newly inject. It is a React text child, never
  // HTML — this asserts that stays true.
  it('escapes markup in the derived title', () => {
    const html = render('<script>alert(1)</script>\nbody');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script');
  });

  it('never puts an external image URL in the title', () => {
    const html = render('![x](https://evil.example/tracker.png)');
    expect(html).toContain('>x</h2>');
    expect(html).not.toContain('evil.example');
  });
});
