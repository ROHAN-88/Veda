import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardMarkdown } from './CardMarkdown';

/** Render a card's Markdown to an HTML string (node env — no DOM needed). */
const render = (source: string): string => renderToStaticMarkup(<CardMarkdown source={source} />);

describe('CardMarkdown — security (XSS)', () => {
  it('does not render raw <script> from the source', () => {
    const html = render('hello <script>alert(1)</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)</script>');
  });

  it('strips javascript: link URLs', () => {
    const html = render('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
  });

  it('escapes raw HTML instead of executing it (no live element/handler)', () => {
    const html = render('<img src=x onerror="alert(1)">');
    // The raw HTML is rendered as inert, entity-escaped text — not a real element.
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('drops images entirely (no external resource loads)', () => {
    const html = render('![alt](https://example.com/tracker.png)');
    expect(html).not.toContain('<img');
  });
});

describe('CardMarkdown — rendering', () => {
  it('renders bold, headings and strikethrough', () => {
    expect(render('**bold**')).toContain('<strong>bold</strong>');
    expect(render('# Title')).toContain('<h1');
    expect(render('~~gone~~')).toContain('<del>');
  });

  it('renders a safe external link that opens in a new tab', () => {
    const html = render('[site](https://example.com)');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
  });

  it('renders a GFM table', () => {
    const html = render('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
  });
});
