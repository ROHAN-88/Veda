import { apiFetch, apiJson } from './client';
import type { Project } from './types';

/** The on-disk JSON contract for project export/import (mirrors the server DTO). */
export const TRANSFER_VERSION = 1;

export interface TransferCard {
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  shape: string;
  color: string;
  rotation: number;
  fontSize: number;
}

export interface TransferConnection {
  sourceRef: string;
  targetRef: string;
  color: string;
  label: string;
}

export interface TransferDocument {
  version: number;
  project: { name: string };
  cards: TransferCard[];
  connections: TransferConnection[];
}

export const transferApi = {
  export: (projectId: string): Promise<TransferDocument> =>
    apiFetch(`/projects/${encodeURIComponent(projectId)}/export`),
  import: (doc: TransferDocument): Promise<Project> => apiJson('/projects/import', 'POST', doc),
};
