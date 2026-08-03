import { useCallback, useMemo, useRef, useState } from 'react';
import {
  editableBlocks,
  insertImageBlock,
  joinBlocks,
  removeImageAt,
  setImageWidthAt,
  splitBlocks,
  type CardBlock,
} from '../canvas/cardBlocks';
import { CARD_CONTENT_MAX } from '../canvas/constants';
import { insertAt } from '../canvas/textInsert';

/** Ask the editor to focus a block and place the caret. `nonce` re-fires a repeat. */
export interface FocusRequest {
  index: number;
  caret: number;
  nonce: number;
}

export interface CardBlocksApi {
  blocks: CardBlock[];
  focusRequest: FocusRequest | null;
  /** Start a fresh edit session from `content` (call when edit mode opens). */
  reset: (content: string) => void;
  setText: (index: number, value: string) => void;
  /** The editor reports the live caret so toolbar inserts land in the right place. */
  reportCaret: (index: number, caret: number) => void;
  removeImage: (index: number) => void;
  /** Set an image block's explicit width (drag release). Never moves the caret. */
  setImageWidth: (index: number, width: number) => void;
  /** Splice Markdown (video/link) at the caret. */
  insertText: (snippet: string) => void;
  /** Drop an uploaded image at the caret, splitting the text block around it. */
  insertImage: (src: string) => void;
}

/**
 * Edit-session state for a card's block editor: the ordered text/image blocks, the
 * live caret, and the focus the editor should apply after a structural change.
 * Every mutation reports the rejoined Markdown upstream, so the card's single
 * debounced save path is unchanged.
 *
 * `blocks` is mirrored in a ref so mutations can be computed outside a state
 * updater — updaters stay pure and the save/focus side effects run exactly once.
 */
export function useCardBlocks(onChange: (content: string) => void): CardBlocksApi {
  const [blocks, setBlocks] = useState<CardBlock[]>([]);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const current = useRef<CardBlock[]>([]);
  const caret = useRef({ index: 0, caret: 0 });
  const nonce = useRef(0);

  const commit = useCallback(
    (next: CardBlock[], focus?: { index: number; caret: number }): void => {
      current.current = next;
      setBlocks(next);
      onChange(joinBlocks(next));
      if (focus) {
        nonce.current += 1;
        caret.current = focus;
        setFocusRequest({ ...focus, nonce: nonce.current });
      }
    },
    [onChange],
  );

  const reset = useCallback((content: string): void => {
    const next = editableBlocks(splitBlocks(content));
    current.current = next;
    setBlocks(next);
    setFocusRequest(null);
    caret.current = { index: 0, caret: 0 };
  }, []);

  const setText = useCallback(
    (index: number, value: string): void => {
      const target = current.current[index];
      if (target?.kind !== 'text') {
        return;
      }
      const next = [...current.current];
      next[index] = { kind: 'text', text: value };
      commit(next);
    },
    [commit],
  );

  const reportCaret = useCallback((index: number, at: number): void => {
    caret.current = { index, caret: at };
  }, []);

  const removeImage = useCallback(
    (index: number): void => {
      const result = removeImageAt(current.current, index);
      if (result.blocks === current.current) {
        return;
      }
      commit(editableBlocks(result.blocks), {
        index: result.focusIndex,
        caret: result.focusCaret,
      });
    },
    [commit],
  );

  /**
   * Committed on drag release, so no focus argument — moving the caret here would
   * yank it out of whatever paragraph the user was typing in. Unlike the rendered
   * card's path this keeps the shared 400ms debounce: the editor renders from local
   * block state, so the delay is invisible, and one write path avoids two whole-
   * `content` PATCHes racing.
   */
  const setImageWidth = useCallback(
    (index: number, width: number): void => {
      const next = setImageWidthAt(current.current, index, width);
      // Refuse rather than let the server 400 and snap the image back unexplained.
      if (next === current.current || joinBlocks(next).length > CARD_CONTENT_MAX) {
        return;
      }
      commit(next);
    },
    [commit],
  );

  /** The caret's block, or the last text block if it has drifted out of range. */
  const caretTarget = useCallback((): { index: number; caret: number } => {
    const { index, caret: at } = caret.current;
    if (current.current[index]?.kind === 'text') {
      return { index, caret: at };
    }
    const last = current.current.map((block) => block.kind).lastIndexOf('text');
    const fallback = last >= 0 ? last : current.current.length - 1;
    const block = current.current[fallback];
    return { index: fallback, caret: block?.kind === 'text' ? block.text.length : 0 };
  }, []);

  const insertText = useCallback(
    (snippet: string): void => {
      const target = caretTarget();
      const block = current.current[target.index];
      if (block?.kind !== 'text') {
        return;
      }
      const { value, caret: after } = insertAt(block.text, target.caret, target.caret, snippet);
      const next = [...current.current];
      next[target.index] = { kind: 'text', text: value };
      commit(next, { index: target.index, caret: after });
    },
    [caretTarget, commit],
  );

  const insertImage = useCallback(
    (src: string): void => {
      const target = caretTarget();
      const result = insertImageBlock(current.current, target.index, target.caret, src);
      commit(editableBlocks(result.blocks), {
        index: result.focusIndex,
        caret: result.focusCaret,
      });
    },
    [caretTarget, commit],
  );

  return useMemo(
    () => ({
      blocks,
      focusRequest,
      reset,
      setText,
      reportCaret,
      removeImage,
      setImageWidth,
      insertText,
      insertImage,
    }),
    [
      blocks,
      focusRequest,
      reset,
      setText,
      reportCaret,
      removeImage,
      setImageWidth,
      insertText,
      insertImage,
    ],
  );
}
