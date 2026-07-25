/** Geometry primitives shared by the spatial grid, transforms, and the store. */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Axis-aligned bounding box in world space (`x,y` = top-left, `w,h` = extent). */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The camera: the world point shown at the viewport centre, plus a zoom factor. */
export interface Camera {
  center: Vec2;
  zoom: number;
}

/** Stable identifier for a spatial-grid element (a card, once Phase 4 lands). */
export type CardId = string;
