import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { AxialCoord } from "@board-game-sim/shared";

export type HexBoardCell = {
  key: string;
  coordinate: AxialCoord;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

type HexBoardProps<Cell extends HexBoardCell> = {
  label: string;
  cells: readonly Cell[];
  selectedKey?: string;
  onHexPress?: (key: string) => void;
  onHexPreview?: (key: string | null) => void;
  renderHex: (cell: Cell, state: { selected: boolean; disabled: boolean }) => ReactNode;
};

const SQRT_THREE = Math.sqrt(3);

function center(coordinate: AxialCoord) {
  return {
    x: SQRT_THREE * (coordinate.q + coordinate.r / 2),
    y: 1.5 * coordinate.r
  };
}

function points(coordinate: AxialCoord): string {
  const point = center(coordinate);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30);
    return `${point.x + Math.cos(angle)},${point.y + Math.sin(angle)}`;
  }).join(" ");
}

const NAVIGATION_OFFSETS: Record<string, AxialCoord> = {
  ArrowRight: { q: 1, r: 0 },
  PageUp: { q: 1, r: -1 },
  ArrowUp: { q: 0, r: -1 },
  ArrowLeft: { q: -1, r: 0 },
  PageDown: { q: -1, r: 1 },
  ArrowDown: { q: 0, r: 1 }
};

export function hexNavigationOffset(key: string): AxialCoord | null {
  return NAVIGATION_OFFSETS[key] ?? null;
}

function focusNeighbor(event: KeyboardEvent<HTMLButtonElement>, coordinate: AxialCoord): void {
  const offset = hexNavigationOffset(event.key);
  if (!offset) return;
  const key = `${coordinate.q + offset.q}:${coordinate.r + offset.r}`;
  const target = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
    `[data-hex-key="${key}"]:not(:disabled)`
  );
  if (target) {
    event.preventDefault();
    target.focus();
  }
}

export function HexBoard<Cell extends HexBoardCell>(props: HexBoardProps<Cell>) {
  const centers = props.cells.map((cell) => center(cell.coordinate));
  const minX = Math.min(...centers.map((point) => point.x)) - 1;
  const maxX = Math.max(...centers.map((point) => point.x)) + 1;
  const minY = Math.min(...centers.map((point) => point.y)) - 1;
  const maxY = Math.max(...centers.map((point) => point.y)) + 1;
  const focusKey = props.selectedKey
    ?? props.cells.find((cell) => !cell.disabled)?.key;

  return <div className="hex-board" role="grid" aria-label={props.label}>
    <svg
      className="hex-board__geometry"
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      aria-hidden="true"
    >
      {props.cells.map((cell) => <polygon key={cell.key} points={points(cell.coordinate)} />)}
    </svg>
    <div className="hex-board__targets">
      {props.cells.map((cell) => {
        const point = center(cell.coordinate);
        const selected = props.selectedKey === cell.key;
        const disabled = cell.disabled ?? false;
        const style = {
          left: `${((point.x - minX) / (maxX - minX)) * 100}%`,
          top: `${((point.y - minY) / (maxY - minY)) * 100}%`
        } as CSSProperties;
        return <button
          key={cell.key}
          type="button"
          role="gridcell"
          className={`hex-board__cell ${cell.className ?? ""}`.trim()}
          data-hex-key={cell.key}
          aria-label={cell.ariaLabel}
          aria-disabled={disabled}
          aria-pressed={selected}
          disabled={disabled}
          tabIndex={focusKey === cell.key ? 0 : -1}
          style={style}
          onClick={disabled || !props.onHexPress ? undefined : () => props.onHexPress?.(cell.key)}
          onKeyDown={(event) => focusNeighbor(event, cell.coordinate)}
          onFocus={() => props.onHexPreview?.(cell.key)}
          onBlur={() => props.onHexPreview?.(null)}
          onMouseEnter={() => props.onHexPreview?.(cell.key)}
          onMouseLeave={() => props.onHexPreview?.(null)}
        >
          {props.renderHex(cell, { selected, disabled })}
        </button>;
      })}
    </div>
  </div>;
}
