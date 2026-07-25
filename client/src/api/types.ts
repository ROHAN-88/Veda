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
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}
