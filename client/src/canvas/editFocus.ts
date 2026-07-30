/**
 * Decide whether a card textarea losing focus should actually END edit mode.
 *
 * Not every blur is a click-away. The media toolbar's "Image" button opens the
 * NATIVE file picker and "Video"/"Link" open `window.prompt` — both take focus off
 * the whole document. Ending edit mode there unmounts the toolbar (and its file
 * input + upload mutation) while the picker is still open, so the chosen file is
 * silently dropped. Pure so it can be unit-tested without a DOM.
 */
export interface EditBlurContext {
  /** `FocusEvent.relatedTarget` — the element that received focus, if any. */
  nextFocus: Node | null;
  /** The card wrapper; focus landing inside it is still "editing this card". */
  container: Node | null;
  /** `document.hasFocus()` — false when a native dialog or another app took over. */
  documentHasFocus: boolean;
}

export function shouldEndEditing({
  nextFocus,
  container,
  documentHasFocus,
}: EditBlurContext): boolean {
  if (!documentHasFocus) {
    return false; // file picker / prompt / alt-tab — the user is still editing
  }
  if (nextFocus && container?.contains(nextFocus)) {
    return false; // focus moved into this card's own chrome
  }
  return true;
}
