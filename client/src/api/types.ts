/** Shared API shapes (dates arrive as ISO strings over JSON). */
export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  /**
   * Notes-view page background, `#rrggbb`. Empty means no choice has been made,
   * so the view follows the OS light/dark theme. Owner-side only — the public
   * share payload deliberately does not carry it.
   */
  notesBg: string;
  /**
   * Whether this project appears in the combined all-projects notes view. A
   * display preference, not an access control — the board is fully readable at
   * its own routes either way.
   */
  notesIncluded: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A card on a project's whiteboard (world-space `x,y,w,h`; plain-text content). */
export interface Card {
  id: string;
  projectId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  shape: string;
  color: string;
  rotation: number;
  fontSize: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

/** A directed relation arrow linking two cards within the same project. */
export interface Connection {
  id: string;
  projectId: string;
  sourceCardId: string;
  targetCardId: string;
  color: string;
  /** Optional plain-text label rendered at the arrow's midpoint. */
  label: string;
  createdAt: string;
  updatedAt: string;
}
