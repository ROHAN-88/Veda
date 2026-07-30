import { useCallback } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { errorMessage } from '../api/client';
import { MAX_UPLOAD_BYTES } from '../api/uploads';
import { useUploadImage } from './useUpload';

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

export interface CardImageUpload {
  isPending: boolean;
  /** Open the native file picker. */
  pickImage: () => void;
  /** Wire to the hidden `<input type="file">`'s `onChange`. */
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Pick an image, upload it, and hand back the stored URL. The caller owns the
 * hidden `<input type="file">` (and its ref) so it can be mounted for the card's
 * whole lifetime rather than only while editing: the native picker outlives any
 * edit-mode transition, and a `change` event on a detached input never reaches
 * React's listener — which is exactly how picked files used to vanish silently.
 */
export function useCardImageUpload(
  inputRef: RefObject<HTMLInputElement | null>,
  /** Receives the stored `/api/uploads/:id` URL — the caller decides placement. */
  onUploaded: (url: string) => void,
  /** Called with `null` when a new pick starts, clearing any stale failure. */
  onError: (message: string | null) => void,
): CardImageUpload {
  const upload = useUploadImage();

  const pickImage = useCallback((): void => inputRef.current?.click(), [inputRef]);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = ''; // allow re-picking the same file
      if (!file) {
        return;
      }
      onError(null);
      // Pre-check the size so an oversize pick fails inline instead of spending an
      // upload and surfacing the server's raw 413 body.
      if (file.size > MAX_UPLOAD_BYTES) {
        onError(`Image is larger than ${MAX_UPLOAD_MB} MB`);
        return;
      }
      upload.mutate(file, {
        onSuccess: (res) => onUploaded(res.url),
        onError: (err) => onError(errorMessage(err)),
      });
    },
    [onError, onUploaded, upload],
  );

  return { isPending: upload.isPending, pickImage, onFileChange };
}
