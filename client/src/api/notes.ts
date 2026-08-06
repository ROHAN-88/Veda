import { apiFetch } from './client';
import type { Card } from './types';

/**
 * The combined all-projects notes read. ONE request regardless of how many
 * projects the caller has — a per-project fan-out would share a single
 * 100-per-minute-per-IP throttle bucket with every other card read.
 *
 * Returns cards only; project names come from `GET /projects`, which the page
 * needs anyway for its filter bar.
 */
export const notesApi = {
  list: (): Promise<Card[]> => apiFetch('/notes'),
};
