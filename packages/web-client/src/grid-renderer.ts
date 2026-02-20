import type { GameRenderer } from "./renderer-registry";

export class GridRenderer implements GameRenderer {
  render(view: unknown): string {
    const payload = (view ?? {}) as {
      phase?: string;
      currentPlayerId?: string;
      winnerPlayerId?: string | null;
    };
    const phase = payload.phase ?? "unknown";
    const currentPlayerId = payload.currentPlayerId ?? "-";
    const winner = payload.winnerPlayerId ?? "-";
    return `phase=${phase} current=${currentPlayerId} winner=${winner}`;
  }
}
