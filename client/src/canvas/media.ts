/** Pure helpers for card media (no DOM/React) — video-embed parsing + URL safety. */

export interface VideoEmbed {
  provider: 'youtube' | 'vimeo';
  id: string;
  /** The rebuilt, allowlisted iframe `src` (never the raw pasted URL). */
  src: string;
}

const YT_ID = /^[A-Za-z0-9_-]{6,15}$/;
const VIMEO_ID = /^\d+$/;

const youtube = (id: string): VideoEmbed => ({
  provider: 'youtube',
  id,
  src: `https://www.youtube-nocookie.com/embed/${id}`,
});
const vimeo = (id: string): VideoEmbed => ({
  provider: 'vimeo',
  id,
  src: `https://player.vimeo.com/video/${id}`,
});

/**
 * Recognise a YouTube/Vimeo link and return an allowlisted embed, else null. The
 * id is validated (`[A-Za-z0-9_-]` / digits) before it's placed in the iframe src,
 * so no attacker-controlled string ever reaches `src`.
 */
export function parseVideoEmbed(href: string): VideoEmbed | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return YT_ID.test(id) ? youtube(id) : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return YT_ID.test(id) ? youtube(id) : null;
    }
    const m = /^\/embed\/([^/?#]+)/.exec(url.pathname);
    return m && YT_ID.test(m[1]) ? youtube(m[1]) : null;
  }
  if (host === 'vimeo.com') {
    const id = url.pathname.slice(1).split('/')[0];
    return VIMEO_ID.test(id) ? vimeo(id) : null;
  }
  if (host === 'player.vimeo.com') {
    const m = /^\/video\/(\d+)/.exec(url.pathname);
    return m ? vimeo(m[1]) : null;
  }
  return null;
}

const SAFE_LINK_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

const isRelative = (url: string): boolean =>
  (url.startsWith('/') && !url.startsWith('//')) ||
  url.startsWith('./') ||
  url.startsWith('../') ||
  url.startsWith('#');

/**
 * `urlTransform` for react-markdown. Images (`src`) are restricted to same-origin /
 * relative URLs — so only uploaded `/api/uploads/…` render (no external tracking
 * pixels). Links (`href`) allow safe schemes + relative; everything else is dropped
 * (including `javascript:`/`data:`).
 */
export function transformCardUrl(url: string, key: string): string {
  if (key === 'src') {
    return isRelative(url) ? url : '';
  }
  if (isRelative(url)) {
    return url;
  }
  try {
    return SAFE_LINK_SCHEMES.includes(new URL(url).protocol) ? url : '';
  } catch {
    return '';
  }
}
