import { describe, expect, it } from 'vitest';
import { ImportParseError, parseImportFile } from './parseImportFile';

const valid = {
  version: 1,
  project: { name: 'My Board' },
  cards: [{ ref: 'a', x: 0, y: 0 }],
  connections: [],
};

describe('parseImportFile', () => {
  it('accepts a well-formed export document', () => {
    const doc = parseImportFile(JSON.stringify(valid));
    expect(doc.project.name).toBe('My Board');
    expect(doc.cards).toHaveLength(1);
  });

  it('rejects malformed JSON', () => {
    expect(() => parseImportFile('{not json')).toThrow(ImportParseError);
  });

  it('rejects a non-object top level', () => {
    expect(() => parseImportFile('42')).toThrow(ImportParseError);
    expect(() => parseImportFile('null')).toThrow(ImportParseError);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseImportFile(JSON.stringify({ ...valid, version: 2 }))).toThrow(/version/i);
  });

  it('rejects a missing/blank project name', () => {
    expect(() => parseImportFile(JSON.stringify({ ...valid, project: {} }))).toThrow(
      ImportParseError,
    );
    expect(() => parseImportFile(JSON.stringify({ ...valid, project: { name: '   ' } }))).toThrow(
      ImportParseError,
    );
  });

  it('rejects non-array cards or connections', () => {
    expect(() => parseImportFile(JSON.stringify({ ...valid, cards: 'x' }))).toThrow(
      ImportParseError,
    );
    expect(() => parseImportFile(JSON.stringify({ ...valid, connections: {} }))).toThrow(
      ImportParseError,
    );
  });
});
