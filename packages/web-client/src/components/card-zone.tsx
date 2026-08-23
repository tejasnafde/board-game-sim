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

function moveFocus(event: KeyboardEvent<HTMLElement>): void {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const cards = [...(event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-card-focusable="true"]') ?? [])];
  const currentIndex = cards.indexOf(event.currentTarget);
  if (currentIndex < 0 || cards.length < 2) return;
  const next = event.key === "Home"
    ? cards[0]
    : event.key === "End"
      ? cards.at(-1)
      : cards[(currentIndex + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + cards.length) % cards.length];
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
      const selectable = Boolean(props.onCardPress);
      const className = `card-zone__card ${card.className ?? ""}`.trim();
      const content = card.face ?? card.back;
      if (!selectable) {
        return <div
          key={card.slotKey}
          role="img"
          className={className}
          data-slot-key={card.slotKey}
          data-card-focusable="true"
          aria-label={card.ariaLabel}
          tabIndex={focusKey === card.slotKey ? 0 : -1}
          onKeyDown={moveFocus}
        >
          {content}
        </div>;
      }
      return <button
        key={card.slotKey}
        type="button"
        className={className}
        data-slot-key={card.slotKey}
        data-card-focusable={disabled ? undefined : "true"}
        aria-label={card.ariaLabel}
        aria-disabled={disabled}
        aria-pressed={selected}
        disabled={disabled}
        tabIndex={focusKey === card.slotKey ? 0 : -1}
        onClick={disabled ? undefined : () => props.onCardPress?.(card.slotKey)}
        onKeyDown={moveFocus}
      >
        {content}
      </button>;
    })}
  </div>;
}
