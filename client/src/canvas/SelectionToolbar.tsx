import { CARD_SHAPES, clampFontSize, PALETTE, SHAPE_ICON, toCardShape } from './cardShapes';
import { FONT_SIZE_STEP } from './constants';
import { useCards, useDeleteCard, useUpdateCard } from '../hooks/useCards';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useSelectionStore } from '../store/selectionStore';

/**
 * Fixed top-centre toolbar for the selected card: colour palette + custom picker,
 * shape switcher, and delete. Reads the live card from the React Query cache, so
 * optimistic edits reflect instantly and it survives the card being culled.
 * Returns null when nothing is selected.
 */
export function SelectionToolbar({ projectId }: { projectId: string }) {
  const selectedId = useSelectionStore((state) => state.selectedId);
  const clear = useSelectionStore((state) => state.clear);
  const { data: cards = [] } = useCards(projectId);
  const { mutate: update } = useUpdateCard(projectId);
  const { mutate: remove } = useDeleteCard(projectId);
  const card = cards.find((c) => c.id === selectedId) ?? null;

  // Dragging the OS colour picker fires onChange rapidly — debounce the PATCH.
  const [setColor, flushColor] = useDebouncedCallback((color: string) => {
    if (card) {
      update({ id: card.id, patch: { color } });
    }
  }, 120);

  if (!card) {
    return null;
  }

  const current = card.color.toLowerCase();

  return (
    <div className="whiteboard__selection-toolbar" data-no-pan>
      <div className="whiteboard__swatches">
        {PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="whiteboard__swatch"
            style={{ background: swatch }}
            aria-label={`Colour ${swatch}`}
            aria-pressed={current === swatch}
            onClick={() => update({ id: card.id, patch: { color: swatch } })}
          />
        ))}
        <input
          type="color"
          className="whiteboard__color-input"
          aria-label="Custom colour"
          value={card.color}
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
            aria-pressed={toCardShape(card.shape) === shape}
            onClick={() => update({ id: card.id, patch: { shape } })}
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
          onClick={() =>
            update({
              id: card.id,
              patch: { fontSize: clampFontSize(card.fontSize - FONT_SIZE_STEP) },
            })
          }
        >
          A−
        </button>
        <span className="whiteboard__fontsize-value">{card.fontSize}</span>
        <button
          type="button"
          className="ghost whiteboard__fontsize-btn"
          aria-label="Increase text size"
          onClick={() =>
            update({
              id: card.id,
              patch: { fontSize: clampFontSize(card.fontSize + FONT_SIZE_STEP) },
            })
          }
        >
          A+
        </button>
      </div>
      <button
        type="button"
        className="ghost danger"
        onClick={() => {
          remove(card.id);
          clear();
        }}
      >
        Delete
      </button>
    </div>
  );
}
