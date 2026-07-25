/**
 * Uniform-grid spatial hash — the DSA that will power viewport culling,
 * hit-testing, and drag queries once cards land (Phase 4). Chosen over an
 * R-tree/quadtree because drag churn is O(1) here and there is no
 * boundary-spanning rebalancing (the AFFiNE-proven approach).
 *
 * Structure: `Map<cellKey, Set<CardId>>` occupancy plus a bbox-per-id map. The
 * bbox map gives O(1) removal (we know exactly which cells to touch) and lets
 * `search`/`hitTest` filter precisely rather than returning conservative
 * candidates.
 *
 * Complexity: build O(n); insert/remove/update/move O(cells a bbox covers)
 * (≈ O(1) for card-scale bboxes); search O(cells_in_view + hits);
 * hitTest O(cell_occupancy).
 */
import { CELL_SIZE } from './constants';
import type { Bounds, CardId, Vec2 } from './types';

/** `${col}|${row}` cell key. `Math.floor` keeps negative world coords correct. */
function cellKey(col: number, row: number): string {
  return `${col}|${row}`;
}

interface CellRange {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/** Inclusive range of cells a bbox overlaps. */
function coveringRange(b: Bounds): CellRange {
  return {
    minCol: Math.floor(b.x / CELL_SIZE),
    maxCol: Math.floor((b.x + b.w) / CELL_SIZE),
    minRow: Math.floor(b.y / CELL_SIZE),
    maxRow: Math.floor((b.y + b.h) / CELL_SIZE),
  };
}

function rectsIntersect(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInBounds(p: Vec2, b: Bounds): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

export class SpatialGrid {
  private readonly cells = new Map<string, Set<CardId>>();
  private readonly bounds = new Map<CardId, Bounds>();

  /** Register `id` with bounding box `bbox`, adding it to every overlapping cell. */
  insert(id: CardId, bbox: Bounds): void {
    this.bounds.set(id, bbox);
    const r = coveringRange(bbox);
    for (let col = r.minCol; col <= r.maxCol; col++) {
      for (let row = r.minRow; row <= r.maxRow; row++) {
        const key = cellKey(col, row);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = new Set<CardId>();
          this.cells.set(key, bucket);
        }
        bucket.add(id);
      }
    }
  }

  /** Remove `id` from every cell it occupied; empty buckets are pruned. No-op if unknown. */
  remove(id: CardId): void {
    const bbox = this.bounds.get(id);
    if (!bbox) {
      return;
    }
    const r = coveringRange(bbox);
    for (let col = r.minCol; col <= r.maxCol; col++) {
      for (let row = r.minRow; row <= r.maxRow; row++) {
        const key = cellKey(col, row);
        const bucket = this.cells.get(key);
        if (bucket) {
          bucket.delete(id);
          if (bucket.size === 0) {
            this.cells.delete(key);
          }
        }
      }
    }
    this.bounds.delete(id);
  }

  /** Move/resize `id` to a new bbox. */
  update(id: CardId, bbox: Bounds): void {
    this.remove(id);
    this.insert(id, bbox);
  }

  /** Drag path — identical to {@link update}, named for call-site intent. */
  move(id: CardId, bbox: Bounds): void {
    this.update(id, bbox);
  }

  /** Ids whose bbox intersects `rect`. Scans only covering cells, then filters precisely. */
  search(rect: Bounds): Set<CardId> {
    const found = new Set<CardId>();
    const r = coveringRange(rect);
    for (let col = r.minCol; col <= r.maxCol; col++) {
      for (let row = r.minRow; row <= r.maxRow; row++) {
        const bucket = this.cells.get(cellKey(col, row));
        if (!bucket) {
          continue;
        }
        for (const id of bucket) {
          if (found.has(id)) {
            continue;
          }
          const bbox = this.bounds.get(id);
          if (bbox && rectsIntersect(bbox, rect)) {
            found.add(id);
          }
        }
      }
    }
    return found;
  }

  /** Ids whose bbox contains `point`, scanning only the point's cell. */
  hitTest(point: Vec2): CardId[] {
    const col = Math.floor(point.x / CELL_SIZE);
    const row = Math.floor(point.y / CELL_SIZE);
    const bucket = this.cells.get(cellKey(col, row));
    if (!bucket) {
      return [];
    }
    const hits: CardId[] = [];
    for (const id of bucket) {
      const bbox = this.bounds.get(id);
      if (bbox && pointInBounds(point, bbox)) {
        hits.push(id);
      }
    }
    return hits;
  }

  clear(): void {
    this.cells.clear();
    this.bounds.clear();
  }

  /** Number of registered elements. */
  size(): number {
    return this.bounds.size;
  }
}
