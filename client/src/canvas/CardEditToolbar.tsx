interface CardEditToolbarProps {
  /** Insert a Markdown snippet at the caret. */
  onInsert: (snippet: string) => void;
  /** Open the native image picker (the input itself lives in `CardView`). */
  onPickImage: () => void;
  uploading: boolean;
}

/**
 * Media helpers shown while editing a card: upload an image, embed a YouTube/Vimeo
 * video, or insert a link. Presentational — the file input and the upload mutation
 * are owned by `CardView` so they survive the focus loss the picker causes. Buttons
 * `preventDefault` on mousedown so they never steal focus from the editor.
 */
export function CardEditToolbar({ onInsert, onPickImage, uploading }: CardEditToolbarProps) {
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
        onClick={onPickImage}
        disabled={uploading}
      >
        {uploading ? '…' : 'Image'}
      </button>
      <button type="button" className="ghost" onMouseDown={keepFocus} onClick={onVideo}>
        Video
      </button>
      <button type="button" className="ghost" onMouseDown={keepFocus} onClick={onLink}>
        Link
      </button>
    </div>
  );
}
