import { PALETTE } from './cardShapes';
import { useConnections, useDeleteConnection, useUpdateConnection } from '../hooks/useConnections';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useSelectionStore } from '../store/selectionStore';

/**
 * Fixed top-centre toolbar for the selected relation arrow: colour palette +
 * custom picker + delete. Reads the live connection from the React Query cache so
 * optimistic recolours reflect instantly. Returns null when no arrow is selected.
 * Card and connection selection are mutually exclusive, so this never overlaps the
 * card SelectionToolbar.
 */
export function ConnectionToolbar({ projectId }: { projectId: string }) {
  const selectedConnectionId = useSelectionStore((state) => state.selectedConnectionId);
  const clear = useSelectionStore((state) => state.clear);
  const { data: connections = [] } = useConnections(projectId);
  const { mutate: update } = useUpdateConnection(projectId);
  const { mutate: remove } = useDeleteConnection(projectId);
  const connection = connections.find((c) => c.id === selectedConnectionId) ?? null;

  // Dragging the OS colour picker fires onChange rapidly — debounce the PATCH.
  const [setColor, flushColor] = useDebouncedCallback((color: string) => {
    if (connection) {
      update({ id: connection.id, patch: { color } });
    }
  }, 120);

  if (!connection) {
    return null;
  }

  const current = connection.color.toLowerCase();

  return (
    <div className="whiteboard__selection-toolbar" data-no-pan>
      <div className="whiteboard__swatches">
        {PALETTE.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="whiteboard__swatch"
            style={{ background: swatch }}
            aria-label={`Arrow colour ${swatch}`}
            aria-pressed={current === swatch}
            onClick={() => update({ id: connection.id, patch: { color: swatch } })}
          />
        ))}
        <input
          type="color"
          className="whiteboard__color-input"
          aria-label="Custom arrow colour"
          value={connection.color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => flushColor()}
        />
      </div>
      <button
        type="button"
        className="ghost danger"
        onClick={() => {
          remove(connection.id);
          clear();
        }}
      >
        Delete
      </button>
    </div>
  );
}
