/**
 * Detect an allowed raster image type from a file's MAGIC BYTES — never trust the
 * client's filename or Content-Type (both trivially spoofable). SVG is
 * intentionally excluded: it can carry script and become stored XSS. Returns the
 * canonical MIME, or `null` when the bytes are not a recognised allowed image.
 */
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export const ALLOWED_IMAGE_MIME: readonly ImageMime[] = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export function sniffImageMime(buf: Buffer): ImageMime | null {
  if (buf.length < 12) {
    return null;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return 'image/gif';
  }
  // WEBP: "RIFF" ...4 bytes... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
