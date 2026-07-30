import { apiFetch } from './client';

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
