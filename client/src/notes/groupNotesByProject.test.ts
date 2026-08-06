import { describe, expect, it } from 'vitest';
import type { Card, Project } from '../api/types';
import { countGroupedCards, groupNotesByProject } from './groupNotesByProject';

const project = (id: string, name = id): Project => ({
  id,
  ownerId: 'u1',
  name,
  notesBg: '',
  notesIncluded: true,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
});

const card = (id: string, projectId: string, x = 0, y = 0): Card => ({
  id,
  projectId,
  x,
  y,
  w: 240,
  h: 160,
  content: id,
  shape: 'card',
  color: '#ffffff',
  rotation: 0,
  fontSize: 14,
  zIndex: 0,
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
});

const shape = (groups: ReturnType<typeof groupNotesByProject>): [string, string[]][] =>
  groups.map((group) => [group.project.id, group.cards.map((c) => c.id)]);

describe('groupNotesByProject', () => {
  it('buckets cards under their project', () => {
    const groups = groupNotesByProject(
      [card('a', 'p1'), card('b', 'p2'), card('c', 'p1', 500)],
      [project('p1'), project('p2')],
    );
    expect(shape(groups)).toEqual([
      ['p1', ['a', 'c']],
      ['p2', ['b']],
    ]);
  });

  // The server hands back projects ordered by updatedAt desc — most recently
  // touched board first — and that ordering must survive.
  it('orders groups by the projects array, not by the cards array', () => {
    const groups = groupNotesByProject(
      [card('b', 'p2'), card('a', 'p1')],
      [project('p1'), project('p2')],
    );
    expect(groups.map((g) => g.project.id)).toEqual(['p1', 'p2']);
  });

  it('sorts each group into reading order', () => {
    // Same band (y within 48), so they read left to right regardless of input.
    const groups = groupNotesByProject(
      [card('right', 'p1', 500, 10), card('left', 'p1', 0, 0), card('below', 'p1', 0, 400)],
      [project('p1')],
    );
    expect(shape(groups)).toEqual([['p1', ['left', 'right', 'below']]]);
  });

  it('drops projects with no cards rather than showing a bare heading', () => {
    const groups = groupNotesByProject([card('a', 'p1')], [project('p1'), project('empty')]);
    expect(groups.map((g) => g.project.id)).toEqual(['p1']);
  });

  // Happens only while the two queries are briefly out of step.
  it('drops a card whose project is not in the list', () => {
    const groups = groupNotesByProject([card('a', 'p1'), card('orphan', 'gone')], [project('p1')]);
    expect(shape(groups)).toEqual([['p1', ['a']]]);
  });

  it('handles empty inputs', () => {
    expect(groupNotesByProject([], [project('p1')])).toEqual([]);
    expect(groupNotesByProject([card('a', 'p1')], [])).toEqual([]);
  });

  it('does not mutate its inputs', () => {
    const cards = [card('b', 'p1', 500), card('a', 'p1', 0)];
    const snapshot = cards.map((c) => c.id);
    groupNotesByProject(cards, [project('p1')]);
    expect(cards.map((c) => c.id)).toEqual(snapshot);
  });
});

describe('countGroupedCards', () => {
  it('totals across groups', () => {
    const groups = groupNotesByProject(
      [card('a', 'p1'), card('b', 'p1', 500), card('c', 'p2')],
      [project('p1'), project('p2')],
    );
    expect(countGroupedCards(groups)).toBe(3);
  });

  it('is zero for no groups', () => {
    expect(countGroupedCards([])).toBe(0);
  });
});
