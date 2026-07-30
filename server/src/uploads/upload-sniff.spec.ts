import { sniffImageMime } from './upload-sniff';

/** Build a ≥12-byte buffer starting with the given signature bytes. */
const withSig = (...sig: number[]): Buffer => {
  const b = Buffer.alloc(16);
  sig.forEach((byte, i) => (b[i] = byte));
  return b;
};

describe('sniffImageMime', () => {
  it('detects PNG / JPEG / GIF by magic bytes', () => {
    expect(sniffImageMime(withSig(0x89, 0x50, 0x4e, 0x47))).toBe('image/png');
    expect(sniffImageMime(withSig(0xff, 0xd8, 0xff))).toBe('image/jpeg');
    expect(sniffImageMime(withSig(0x47, 0x49, 0x46, 0x38))).toBe('image/gif');
  });

  it('detects WEBP (RIFF….WEBP)', () => {
    const webp = withSig(0x52, 0x49, 0x46, 0x46);
    [0x57, 0x45, 0x42, 0x50].forEach((byte, i) => (webp[8 + i] = byte));
    expect(sniffImageMime(webp)).toBe('image/webp');
  });

  it('rejects SVG, plain text, and other non-allowed content', () => {
    expect(sniffImageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageMime(Buffer.from('just some plain text here'))).toBeNull();
    expect(sniffImageMime(withSig(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });

  it('rejects buffers too short to identify', () => {
    expect(sniffImageMime(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});
