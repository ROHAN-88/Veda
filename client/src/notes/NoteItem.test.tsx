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
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
  ...overrides,
});

/** Render one note to an HTML string (node env — no DOM needed). */
const render = (content: string, overrides?: Partial<Card>): string =>
  renderToStaticMarkup(<NoteItem card={card(content, overrides)} />);

describe('NoteItem — content', () => {
  it('renders the card body', () => {
    expect(render('# Sprint plan\nbody text')).toContain('body text');
  });

  // The note is the content and only the content. A derived heading would repeat
  // the card's own first line directly above it.
  it('renders no title heading of its own', () => {
    const html = render('Sprint plan\nbody text');
    expect(html).not.toContain('notes__title');
    expect(html).not.toContain('Sprint plan</h2>');
    expect(html).not.toContain('Sprint plan</h3>');
  });

  it("does not repeat the card's opening line", () => {
    const html = render('sdfsdf');
    expect(html.match(/sdfsdf/g)).toHaveLength(1);
  });

  // A card's own Markdown headings still render — those are the user's content.
  it("keeps the card's own headings", () => {
    expect(render('# Real heading')).toContain('<h1>Real heading</h1>');
  });

  // The feature's headline requirement: notes must show the board's images.
  it('renders a same-origin uploaded image', () => {
    const html = render(`Design\n![shot](${IMG})`);
    expect(html).toContain('<img');
    expect(html).toContain('whiteboard__card-media-img');
    expect(html).toContain(IMG);
  });

  it('keeps an explicit width and the sized class', () => {
    const html = render(`![shot](${IMG} "w=4000")`);
    expect(html).toContain('style="width:4000px"');
    expect(html).toContain('sized');
  });

  it('shows an empty-card placeholder for a blank card', () => {
    expect(render('   \n\t ')).toContain('Empty card');
  });

  it('no longer renders a colour chip', () => {
    expect(render('note', { color: '#fee2e2' })).not.toContain('notes__chip');
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

  // Nothing in this component builds a string out of user content any more — the
  // whole payload goes through CardMarkdown's audited path.
  it('escapes markup anywhere in the content', () => {
    const html = render('<script>alert(1)</script>\nbody');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script');
  });
});
