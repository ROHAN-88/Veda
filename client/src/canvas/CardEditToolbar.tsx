import { useRef } from 'react';
import { errorMessage } from '../api/client';
import { useUploadImage } from '../hooks/useUpload';

interface CardEditToolbarProps {
  /** Insert a Markdown snippet at the textarea's caret. */
  onInsert: (snippet: string) => void;
  onError: (message: string) => void;
}

/**
 * Media helpers shown while editing a card: upload an image, embed a YouTube/Vimeo
 * video, or insert a link. Buttons `preventDefault` on mousedown so they never
 * steal focus from (and thus close) the textarea while it's being edited.
 */
export function CardEditToolbar({ onInsert, onError }: CardEditToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadImage();

  const onFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    if (!file) {
      return;
    }
    upload.mutate(file, {
      onSuccess: (res) => onInsert(`![](${res.url})`),
      onError: (err) => onError(errorMessage(err)),
    });
  };

  const onVideo = (): void => {
    const url = window.prompt('YouTube or Vimeo URL')?.trim();
    if (url) {
      onInsert(url);
    }
  };

  const onLink = (): void => {
    const url = window.prompt('Link URL')?.trim();
    if (!url) {
      return;
    }
    const text = window.prompt('Link text', url)?.trim() || url;
    onInsert(`[${text}](${url})`);
  };

  const keepFocus = (e: React.MouseEvent): void => e.preventDefault();

  return (
    <div className="whiteboard__card-edit-toolbar" data-no-pan>
      <button
        type="button"
        className="ghost"
        onMouseDown={keepFocus}
        onClick={() => fileRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? '…' : 'Image'}
      </button>
      <button type="button" className="ghost" onMouseDown={keepFocus} onClick={onVideo}>
        Video
      </button>
      <button type="button" className="ghost" onMouseDown={keepFocus} onClick={onLink}>
        Link
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="visually-hidden"
        onChange={onFile}
      />
    </div>
  );
}
