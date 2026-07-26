import { CARD_SHAPES, clampFontSize, PALETTE, SHAPE_ICON, toCardShape } from './cardShapes';
import { FONT_SIZE_STEP } from './constants';
import type { UpdateCardInput } from '../api/cards';
import { useCards } from '../hooks/useCards';
import { useCardHistory } from '../hooks/useCardHistory';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useSelectionStore } from '../store/selectionStore';

/** The shared value across a selection, or null when they differ ("mixed"). */
const allSame = <T,>(values: T[]): T | null =>
  values.length > 0 && values.every((v) => v === values[0]) ? values[0] : null;

/**
 * Fixed top-centre toolbar for the selected card(s). Every control applies to the
 * WHOLE selection in one atomic, undoable update (Phase 8); a swatch/shape shows
 * "active" only when all selected share it. Returns null when nothing is selected.
 */
export function SelectionToolbar({ projectId }: { projectId: string }) {
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const clear = useSelectionStore((state) => state.clear);
  const { data: cards = [] } = useCards(projectId);
  const { commitUpdate, commitDelete } = useCardHistory(projectId);
  const selected = cards.filter((card) => selectedIds.has(card.id));

  const applyToAll = (patch: UpdateCardInput): void =>
    commitUpdate(selected.map((card) => ({ id: card.id, ...patch })));

  // Dragging the OS colour picker fires onChange rapidly — debounce the commit.
  const [setColor, flushColor] = useDebouncedCallback((color: string) => {
    if (selected.length > 0) {
      applyToAll({ color });
    }
  }, 120);

  if (selected.length === 0) {
    return null;
  }

  const commonColor = allSame(selected.map((c) => c.color.toLowerCase()));
  const commonShape = allSame(selected.map((c) => toCardShape(c.shape)));
  const commonFontSize = allSame(selected.map((c) => c.fontSize));
  const stepFont = (delta: number): void =>
    commitUpdate(selected.map((c) => ({ id: c.id, fontSize: clampFontSize(c.fontSize + delta) })));

  return (
    <div className="whiteboard__selection-toolbar" data-no-pan>
      {selected.length > 1 && (
        <span className="whiteboard__selection-count">{selected.length} selected</span>
      )}
      <div className="whiteboard__swatches">
        {PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="whiteboard__swatch"
            style={{ background: swatch }}
            aria-label={`Colour ${swatch}`}
            aria-pressed={commonColor === swatch}
            onClick={() => applyToAll({ color: swatch })}
          />
        ))}
        <input
          type="color"
          className="whiteboard__color-input"
          aria-label="Custom colour"
          value={selected[0].color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => flushColor()}
        />
      </div>
      <div className="whiteboard__shapes">
        {CARD_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            className="ghost whiteboard__shape-btn"
            aria-label={shape}
            aria-pressed={commonShape === shape}
            onClick={() => applyToAll({ shape })}
          >
            {SHAPE_ICON[shape]}
          </button>
        ))}
      </div>
      <div className="whiteboard__fontsize">
        <button
          type="button"
          className="ghost whiteboard__fontsize-btn"
          aria-label="Decrease text size"
          onClick={() => stepFont(-FONT_SIZE_STEP)}
        >
          A−
        </button>
        <span className="whiteboard__fontsize-value">{commonFontSize ?? '–'}</span>
        <button
          type="button"
          className="ghost whiteboard__fontsize-btn"
          aria-label="Increase text size"
          onClick={() => stepFont(FONT_SIZE_STEP)}
        >
          A+
        </button>
      </div>
      <button
        type="button"
        className="ghost danger"
        onClick={() => {
          commitDelete([...selectedIds]);
          clear();
        }}
      >
        Delete
      </button>
    </div>
  );
}
