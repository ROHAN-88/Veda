import { apiFetch, apiJson } from './client';
import type { Card, Connection } from './types';

/** One-time result of creating a link — the raw token is returned only here. */
export interface ShareCreateResult {
  id: string;
  token: string;
  createdAt: string;
}

/** Owner-facing sharing status (never carries the raw token). */
export interface ShareStatus {
  active: boolean;
  createdAt: string | null;
}

/** The public read-only payload for a shared board (no owner/user data). */
export interface PublicBoard {
  project: { id: string; name: string };
  cards: Card[];
  connections: Connection[];
}

export const shareApi = {
  /** Public, unauthenticated read of a shared board by its token. */
  getPublic: (token: string): Promise<PublicBoard> =>
    apiFetch(`/share/${encodeURIComponent(token)}`),
  /** Owner: mint a link (revokes any prior one), returning the raw token once. */
  create: (projectId: string): Promise<ShareCreateResult> =>
    apiJson(`/projects/${encodeURIComponent(projectId)}/share`, 'POST'),
  getStatus: (projectId: string): Promise<ShareStatus> =>
    apiFetch(`/projects/${encodeURIComponent(projectId)}/share`),
  revoke: (projectId: string): Promise<void> =>
    apiJson(`/projects/${encodeURIComponent(projectId)}/share`, 'DELETE'),
};

/** Build the shareable URL from a raw token, using the current origin. */
export function shareUrl(token: string): string {
  return `${window.location.origin}/share/${token}`;
}
