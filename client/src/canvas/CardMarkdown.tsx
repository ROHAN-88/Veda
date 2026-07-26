import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders a card's Markdown content SAFELY (Phase 7). react-markdown turns the
 * source into React elements — it never builds an HTML string and never uses
 * `dangerouslySetInnerHTML`, so this is XSS-safe by construction:
 *   - raw HTML in the source is ignored (no `rehype-raw` plugin),
 *   - dangerous URL schemes (`javascript:`…) are stripped by the default
 *     `urlTransform`,
 *   - links open in a new tab with `rel="noopener noreferrer nofollow"`,
 *   - images are dropped in v1 (no external resource loads / tracking pixels).
 * The root keeps `.whiteboard__card-content` so the existing height / overflow /
 * `font-size: inherit` / shape-centering rules still apply.
 */
const COMPONENTS: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
    </a>
  ),
};

export function CardMarkdown({ source }: { source: string }) {
  return (
    <div className="whiteboard__card-content whiteboard__card-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        unwrapDisallowed
        components={COMPONENTS}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
