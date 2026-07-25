import { describe, expect, it } from 'vitest';
import { CELL_SIZE } from './constants';
import { SpatialGrid } from './SpatialGrid';
import type { Bounds } from './types';

const box = (x: number, y: number, w = 10, h = 10): Bounds => ({ x, y, w, h });

describe('SpatialGrid', () => {
  it('finds an inserted element by an overlapping query', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(100, 100));
    expect(grid.search(box(90, 90, 40, 40)).has('a')).toBe(true);
    expect(grid.size()).toBe(1);
  });

  it('returns empty for a non-overlapping or empty query', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(100, 100));
    expect(grid.search(box(5000, 5000, 10, 10)).size).toBe(0);
    expect(grid.search(box(0, 0, 0, 0)).size).toBe(0);
  });

  it('handles an element spanning multiple cells and removes it from all', () => {
    const grid = new SpatialGrid();
    grid.insert('big', box(-10, -10, CELL_SIZE * 2 + 20, CELL_SIZE * 2 + 20));
    expect(grid.search(box(0, 0, 5, 5)).has('big')).toBe(true);
    expect(grid.search(box(CELL_SIZE + 100, CELL_SIZE + 100, 5, 5)).has('big')).toBe(true);
    grid.remove('big');
    expect(grid.search(box(0, 0, 5, 5)).size).toBe(0);
    expect(grid.search(box(CELL_SIZE + 100, CELL_SIZE + 100, 5, 5)).size).toBe(0);
    expect(grid.size()).toBe(0);
  });

  it('update/move relocates an element (old area empty, new area hit)', () => {
    const grid = new SpatialGrid();
    grid.insert('m', box(50, 50));
    grid.update('m', box(3000, 3000));
    expect(grid.search(box(40, 40, 30, 30)).size).toBe(0);
    expect(grid.search(box(2990, 2990, 30, 30)).has('m')).toBe(true);
    grid.move('m', box(50, 50));
    expect(grid.search(box(40, 40, 30, 30)).has('m')).toBe(true);
    expect(grid.search(box(2990, 2990, 30, 30)).size).toBe(0);
  });

  it('remove of an unknown id is a no-op', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(0, 0));
    grid.remove('ghost');
    expect(grid.size()).toBe(1);
    expect(grid.search(box(-5, -5, 20, 20)).has('a')).toBe(true);
  });

  it('hit-tests a point against element bounds', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(100, 100, 50, 50));
    grid.insert('b', box(300, 300, 50, 50));
    expect(grid.hitTest({ x: 120, y: 120 })).toEqual(['a']);
    expect(grid.hitTest({ x: 320, y: 320 })).toEqual(['b']);
    expect(grid.hitTest({ x: 0, y: 0 })).toEqual([]);
  });

  it('returns only the element under the point when two share a cell', () => {
    const grid = new SpatialGrid();
    // both inside the same 512-unit cell [0,512)
    grid.insert('a', box(10, 10, 40, 40));
    grid.insert('b', box(200, 200, 40, 40));
    expect(grid.hitTest({ x: 20, y: 20 })).toEqual(['a']);
    expect(grid.hitTest({ x: 210, y: 210 })).toEqual(['b']);
    expect(grid.hitTest({ x: 100, y: 100 })).toEqual([]);
  });

  it('handles negative world coordinates (floor semantics)', () => {
    const grid = new SpatialGrid();
    grid.insert('neg', box(-600, -600, 40, 40));
    expect(grid.search(box(-610, -610, 60, 60)).has('neg')).toBe(true);
    expect(grid.hitTest({ x: -580, y: -580 })).toEqual(['neg']);
  });

  it('precisely excludes an element in a covered cell but outside the query rect', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(10, 10, 20, 20)); // cell (0,0)
    const rect = box(400, 400, 50, 50); // same cell (0,0), no overlap with 'a'
    expect(grid.search(rect).size).toBe(0);
  });

  it('clear() empties the grid', () => {
    const grid = new SpatialGrid();
    grid.insert('a', box(0, 0));
    grid.insert('b', box(1000, 1000));
    grid.clear();
    expect(grid.size()).toBe(0);
    expect(grid.search(box(-10, -10, 20, 20)).size).toBe(0);
  });
});
