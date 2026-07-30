import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardImageBlock } from './CardImageBlock';
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

/** Interactive variant: each image gains a × that removes only that image. */
function removableComponents(onRemoveImage: (src: string) => void): Components {
  return {
    ...COMPONENTS,
    img: ({ src, alt }) =>
      typeof src === 'string' && src.length > 0 ? (
        <CardImageBlock src={src} alt={alt ?? ''} onRemove={() => onRemoveImage(src)} />
      ) : null,
  };
}

interface CardMarkdownProps {
  source: string;
  /** Omitted in the read-only share view — then the markup is the plain one above. */
  onRemoveImage?: (src: string) => void;
}

export function CardMarkdown({ source, onRemoveImage }: CardMarkdownProps) {
  const components = useMemo(
    () => (onRemoveImage ? removableComponents(onRemoveImage) : COMPONENTS),
    [onRemoveImage],
  );
  return (
    <div className="whiteboard__card-content whiteboard__card-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={transformCardUrl}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
