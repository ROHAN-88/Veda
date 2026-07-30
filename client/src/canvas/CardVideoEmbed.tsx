import type { VideoEmbed } from './media';

/**
 * A sandboxed video embed (YouTube-nocookie / Vimeo). `embed.src` is rebuilt from a
 * validated id — the raw pasted URL never reaches the iframe. The provider host is
 * further constrained by the server CSP `frame-src` allowlist. `<span>` wrapper
 * (display:block via CSS) keeps the markup valid inside a Markdown paragraph.
 */
export function CardVideoEmbed({ embed }: { embed: VideoEmbed }) {
  return (
    <span className="whiteboard__card-embed" data-no-pan>
      <iframe
        src={embed.src}
        title={`${embed.provider} video`}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
      />
    </span>
  );
}
