import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CardImageBlock } from './CardImageBlock';
import { CardVideoEmbed } from './CardVideoEmbed';
import { parseImageWidth } from './imageSize';
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
 *
 * An image's TITLE carries its explicit width (`"w=320"`, see `imageSize.ts`). It is
 * CONSUMED here and never forwarded to the DOM — otherwise every resized image would
 * grow a `w=320` tooltip — which also keeps today's behaviour for foreign titles.
 * The read-only variant still honours a stored width: a share view is unresizable,
 * not unsized, so it must look like the owner's board.
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
  img: ({ src, alt, title }) => {
    if (typeof src !== 'string' || src.length === 0) {
      return null;
    }
    const width = parseImageWidth(title);
    return (
      <img
        className={`whiteboard__card-media-img${width === undefined ? '' : ' sized'}`}
        style={width === undefined ? undefined : { width }}
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  },
};

/**
 * Interactive variant: each image gains a × that removes only that image, and — when
 * `onResizeImage` is supplied — a grip that sets its width.
 */
function removableComponents(
  onRemoveImage: (src: string) => void,
  onResizeImage: ((src: string, width: number) => void) | undefined,
  rotation: number,
): Components {
  return {
    ...COMPONENTS,
    img: ({ src, alt, title }) =>
      typeof src === 'string' && src.length > 0 ? (
        <CardImageBlock
          src={src}
          alt={alt ?? ''}
          width={parseImageWidth(title)}
          rotation={rotation}
          onRemove={() => onRemoveImage(src)}
          onResize={onResizeImage && ((width: number) => onResizeImage(src, width))}
        />
      ) : null,
  };
}

interface CardMarkdownProps {
  source: string;
  /** Omitted in the read-only share view — then the markup is the plain one above. */
  onRemoveImage?: (src: string) => void;
  /** Omitted wherever images must not be resizable; a stored width still applies. */
  onResizeImage?: (src: string, width: number) => void;
  /** Card rotation in degrees, so a resize drag follows the image's own axis. */
  rotation?: number;
}

export function CardMarkdown({
  source,
  onRemoveImage,
  onResizeImage,
  rotation = 0,
}: CardMarkdownProps) {
  const components = useMemo(
    () =>
      onRemoveImage ? removableComponents(onRemoveImage, onResizeImage, rotation) : COMPONENTS,
    [onRemoveImage, onResizeImage, rotation],
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
