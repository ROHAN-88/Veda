import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { nudgeDelta } from '../canvas/nudge';
import type { BulkCardUpdate } from '../api/cards';
import type { Card } from '../api/types';
import { cardsKey, useBulkUpdateCards } from './useCards';
import { useCardHistory } from './useCardHistory';
import { useConnectionHistory } from './useConnectionHistory';
import { useDebouncedCallback } from './useDebouncedCallback';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useHistoryStore } from '../store/historyStore';
import { usePanModeStore } from '../store/panModeStore';
import { useSelectionStore } from '../store/selectionStore';

/** True while the user is typing in a card's text field — don't hijack keys then. */
function isEditingText(): boolean {
  const el = document.activeElement;
  return Boolean(el) && (el?.tagName === 'TEXTAREA' || el?.tagName === 'INPUT');
}

const isMod = (event: KeyboardEvent): boolean => event.ctrlKey || event.metaKey;

/**
 * Canvas keyboard shortcuts (mounted once in WhiteboardCanvas):
 * - Escape: clear selection + cancel an in-progress arrow drag.
 * - Delete/Backspace: remove the selected card(s) or arrow (undoable).
 * - Arrow keys: nudge every selected card (Shift = larger); one debounced,
 *   undoable commit per key-repeat burst.
 * - Ctrl/⌘-A: select all cards. Ctrl/⌘-Z: undo. Ctrl/⌘-Y or ⌘-⇧-Z: redo.
 * - Space (held): pan mode (left-drag pans instead of drawing a marquee).
 * Delete/arrows/Ctrl-shortcuts are ignored while editing a card's text.
 */
export function useCanvasKeyboard(projectId: string): void {
  const queryClient = useQueryClient();
  const { mutate: bulkUpdate } = useBulkUpdateCards(projectId);
  const { commitDelete: deleteCards } = useCardHistory(projectId);
  const { commitDelete: deleteConnections } = useConnectionHistory(projectId);
  const push = useHistoryStore((state) => state.push);

  // Arrow-nudge burst: capture the pre-burst positions once, apply optimistically
  // per key, and commit one undoable bulk update when the keys go quiet.
  const nudge = useRef<{ base: BulkCardUpdate[]; after: BulkCardUpdate[] } | null>(null);
  const [flushNudge] = useDebouncedCallback(() => {
    const burst = nudge.current;
    nudge.current = null;
    if (!burst || burst.after.length === 0) {
      return;
    }
    bulkUpdate(burst.after);
    push({ undo: () => bulkUpdate(burst.base), redo: () => bulkUpdate(burst.after) });
  }, 160);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        useSelectionStore.getState().clear();
        useConnectionDraftStore.getState().clear();
        return;
      }
      if (isEditingText()) {
        return; // let the browser handle typing / its own undo
      }

      if (isMod(event) && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        const cards = queryClient.getQueryData<Card[]>(cardsKey(projectId)) ?? [];
        useSelectionStore.getState().selectMany(cards.map((card) => card.id));
        return;
      }
      if (isMod(event) && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) {
          useHistoryStore.getState().redo();
        } else {
          useHistoryStore.getState().undo();
        }
        return;
      }
      if (isMod(event) && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      const selection = useSelectionStore.getState();

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selection.selectedIds.size > 0) {
          event.preventDefault();
          deleteCards([...selection.selectedIds]);
          selection.clear();
        } else if (selection.selectedConnectionId) {
          event.preventDefault();
          deleteConnections([selection.selectedConnectionId]);
          selection.clear();
        }
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault(); // no page scroll; enter pan mode
        usePanModeStore.getState().setSpaceHeld(true);
        return;
      }

      const delta = nudgeDelta(event.key, event.shiftKey);
      if (delta && selection.selectedIds.size > 0) {
        event.preventDefault();
        const cards = queryClient.getQueryData<Card[]>(cardsKey(projectId)) ?? [];
        const selected = cards.filter((card) => selection.selectedIds.has(card.id));
        if (selected.length === 0) {
          return;
        }
        if (!nudge.current) {
          nudge.current = { base: selected.map((c) => ({ id: c.id, x: c.x, y: c.y })), after: [] };
        }
        const after = selected.map((c) => ({ id: c.id, x: c.x + delta.x, y: c.y + delta.y }));
        nudge.current.after = after;
        const afterById = new Map(after.map((a) => [a.id, a]));
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          cards.map((c) => {
            const a = afterById.get(c.id);
            return a ? { ...c, x: a.x, y: a.y } : c;
          }),
        );
        flushNudge();
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') {
        usePanModeStore.getState().setSpaceHeld(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [projectId, queryClient, bulkUpdate, deleteCards, deleteConnections, push, flushNudge]);
}
