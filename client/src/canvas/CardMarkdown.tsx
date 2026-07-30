import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardVideoEmbed } from './CardVideoEmbed';
import { parseVideoEmbed, transformCardUrl } from './media';

/**
 * Renders a card's Markdown content SAFELY (Phase 7, extended for media). react-
 * markdown turns the source into React elements — no HTML string, no
 * `dangerouslySetInnerHTML` — so it is XSS-safe by construction:
 *   - raw HTML in the source is ignored (no `rehype-raw`),
 *   - `urlTransform` (see `media.ts`) drops dangerous/`javascript:` URLs, limits
 *     image `src` to same-origin uploads, and keeps only safe link schemes,
 *   - a YouTube/Vimeo link renders a sandboxed embed (allowlisted, rebuilt src);
 *     other links open in a new tab with `rel="noopener noreferrer nofollow"`,
 *   - images are uploaded (`/api/uploads/…`), lazy, and send no referrer.
 */
const COMPONENTS: Components = {
  a: ({ href, children }) => {
    const embed = href ? parseVideoEmbed(href) : null;
    if (embed) {
      return <CardVideoEmbed embed={embed} />;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === 'string' && src.length > 0 ? (
      <img
        className="whiteboard__card-media-img"
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    ) : null,
};

export function CardMarkdown({ source }: { source: string }) {
  return (
    <div className="whiteboard__card-content whiteboard__card-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={transformCardUrl}
        components={COMPONENTS}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
