import { TRANSFER_VERSION, type TransferDocument } from '../../api/transfer';

/** A friendly, user-presentable failure while reading an import file. */
export class ImportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportParseError';
  }
}

/**
 * Parse + shape-check the text of an uploaded export file BEFORE sending it to
 * the server (which does the authoritative field validation). Pure and
 * dependency-free so it runs in the node test env; throws {@link ImportParseError}
 * with a message safe to show the user.
 */
export function parseImportFile(text: string): TransferDocument {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportParseError('That file isn’t valid JSON.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new ImportParseError('This doesn’t look like a Second Brain export.');
  }
  const doc = data as Record<string, unknown>;
  if (doc.version !== TRANSFER_VERSION) {
    throw new ImportParseError(`Unsupported export version (expected ${TRANSFER_VERSION}).`);
  }
  const project = doc.project as Record<string, unknown> | undefined;
  if (!project || typeof project.name !== 'string' || project.name.trim().length === 0) {
    throw new ImportParseError('The export is missing a project name.');
  }
  if (!Array.isArray(doc.cards) || !Array.isArray(doc.connections)) {
    throw new ImportParseError('The export is missing its cards or connections.');
  }
  return data as TransferDocument;
}
