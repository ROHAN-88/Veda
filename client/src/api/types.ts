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
