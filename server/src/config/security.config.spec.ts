import { buildHelmetOptions } from './security.config';

/** Pull the CSP directives out of a HelmetOptions for assertion. */
function directives(serveClient: boolean): Record<string, string[]> {
  const csp = buildHelmetOptions(serveClient).contentSecurityPolicy;
  // csp is an object with a `directives` field in both modes.
  return (csp as { directives: Record<string, string[]> }).directives;
}

describe('buildHelmetOptions', () => {
  it('locks the CSP to default-src none for the API-only app (tests/dev)', () => {
    const d = directives(false);
    expect(d.defaultSrc).toEqual(["'none'"]);
    expect(d.frameAncestors).toEqual(["'none'"]);
    expect(d.scriptSrc).toBeUndefined();
  });

  it('allows self assets when serving the SPA, with unsafe-inline only for styles', () => {
    const d = directives(true);
    expect(d.defaultSrc).toEqual(["'self'"]);
    expect(d.scriptSrc).toEqual(["'self'"]); // no inline JS
    expect(d.styleSrc).toContain("'unsafe-inline'"); // inline card geometry needs it
    expect(d.styleSrc).toContain("'self'");
    expect(d.connectSrc).toEqual(["'self'"]);
    expect(d.frameAncestors).toEqual(["'none'"]);
    expect(d.objectSrc).toEqual(["'none'"]);
    // Video embeds: allowlisted providers only.
    expect(d.frameSrc).toContain('https://www.youtube-nocookie.com');
    expect(d.frameSrc).toContain('https://player.vimeo.com');
  });
});
