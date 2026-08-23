import type { KeyboardEvent, ReactNode } from "react";

export type CardZoneItem = {
  slotKey: string;
  face: ReactNode | null;
  back: ReactNode;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

type CardZoneProps = {
  label: string;
  cards: readonly CardZoneItem[];
  arrangement: "row" | "fan";
  selectedKey?: string;
  onCardPress?: (slotKey: string) => void;
};

function moveFocus(event: KeyboardEvent<HTMLButtonElement>): void {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const cards = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
  const currentIndex = cards.indexOf(event.currentTarget);
  if (currentIndex < 0 || cards.length < 2) return;
  const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = cards[(currentIndex + delta + cards.length) % cards.length];
  event.preventDefault();
  next?.focus();
}

export function CardZone(props: CardZoneProps) {
  const focusKey = props.selectedKey
    ?? props.cards.find((card) => !card.disabled)?.slotKey;
  return <div className={`card-zone card-zone--${props.arrangement}`} role="group" aria-label={props.label}>
    {props.cards.map((card) => {
      const selected = props.selectedKey === card.slotKey;
      const disabled = card.disabled ?? false;
      return <button
        key={card.slotKey}
        type="button"
        className={`card-zone__card ${card.className ?? ""}`.trim()}
        data-slot-key={card.slotKey}
        aria-label={card.ariaLabel}
        aria-disabled={disabled}
        aria-pressed={selected}
        disabled={disabled}
        tabIndex={focusKey === card.slotKey ? 0 : -1}
        onClick={disabled || !props.onCardPress ? undefined : () => props.onCardPress?.(card.slotKey)}
        onKeyDown={moveFocus}
      >
        {card.face ?? card.back}
      </button>;
    })}
  </div>;
}
