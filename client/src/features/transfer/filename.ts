/**
 * Turn a project name into a safe download filename ending in `.json`.
 * Lower-cases, collapses any run of non-alphanumerics to a single hyphen, trims
 * stray hyphens, bounds the length, and falls back to `board` when nothing is left.
 */
export function exportFilename(projectName: string): string {
  const base = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${base || 'board'}.json`;
}
