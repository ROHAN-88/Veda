import { useMutation } from '@tanstack/react-query';
import { uploadImage } from '../api/uploads';

/** Upload an image file → returns its stored `/api/uploads/:id` metadata. */
export function useUploadImage() {
  return useMutation({ mutationFn: (file: File) => uploadImage(file) });
}
