import type { ReactElement } from 'react';
import { type Tool, useToolStore } from '../store/toolStore';

// Monochrome inline icons (theme via currentColor), matching the repo's
// glyph-icon convention. Select = a cursor arrow; Hand = a pan hand.
function SelectIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}

function HandIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 11V6a2 2 0 0 0-4 0" />
      <path d="M14 10V4a2 2 0 0 0-4 0v2" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

const TOOLS: { value: Tool; label: string; Icon: () => ReactElement }[] = [
  { value: 'select', label: 'Select tool (V)', Icon: SelectIcon },
  { value: 'pan', label: 'Hand tool — drag to pan (H)', Icon: HandIcon },
];

/** Segmented Select / Hand toggle for the HUD (drives the tool store). */
export function CanvasToolSwitch() {
  const tool = useToolStore((state) => state.tool);
  const setTool = useToolStore((state) => state.setTool);

  return (
    <div className="whiteboard__tools" role="group" aria-label="Canvas tool">
      {TOOLS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="ghost whiteboard__tool"
          aria-label={label}
          aria-pressed={tool === value}
          onClick={() => setTool(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
