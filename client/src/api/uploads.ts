import { apiFetch } from './client';

/** Mirrors `MAX_UPLOAD_BYTES` in `server/src/uploads/uploads.controller.ts` — the
 *  client pre-checks so an oversize pick fails inline instead of as a raw 413. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Accepted image types — kept in step with `ALLOWED_IMAGE_MIME` on the server. */
export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** Metadata returned after an image is stored server-side (bytes live on disk). */
export interface UploadedImage {
  id: string;
  url: string;
  mimeType: string;
}

/** POST an image as multipart/form-data; the browser sets the boundary + our
 *  client attaches the CSRF token. Returns the `/api/uploads/:id` URL to embed. */
export function uploadImage(file: File): Promise<UploadedImage> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch('/uploads', { method: 'POST', body: form });
}
