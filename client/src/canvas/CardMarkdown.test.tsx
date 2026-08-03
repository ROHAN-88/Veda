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

  it('does not let a size annotation smuggle an external image through', () => {
    const html = render('![alt](https://example.com/tracker.png "w=320")');
    expect(html).not.toContain('<img');
  });
});

describe('CardMarkdown — image sizing', () => {
  const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';

  it('applies an explicit width from the title', () => {
    const html = render(`![alt](${IMG} "w=320")`);
    expect(html).toContain('style="width:320px"');
    expect(html).toContain('sized');
  });

  // The title is CONSUMED — otherwise every resized image grows a `w=320` tooltip.
  it('never forwards the title to the DOM', () => {
    expect(render(`![alt](${IMG} "w=320")`)).not.toContain('title=');
    expect(render(`![alt](${IMG} "My holiday photo")`)).not.toContain('title=');
  });

  // The regression test for "existing cards are untouched".
  it('leaves an unsized image with no width and no sized class', () => {
    const html = render(`![alt](${IMG})`);
    expect(html).toContain('<img');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('sized');
  });

  it('ignores a title that is not a size, and one out of range', () => {
    expect(render(`![alt](${IMG} "My holiday photo")`)).not.toContain('style=');
    expect(render(`![alt](${IMG} "w=99999")`)).not.toContain('style=');
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
