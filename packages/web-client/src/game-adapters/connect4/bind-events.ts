import type { WebClientRuntime } from "../../runtime";
import type { Connect4View } from "./types";

export type Connect4BindContext = {
  runtime: WebClientRuntime;
  playerId: string;
  render: () => void;
  pushLog: (entry: string) => void;
};

export function bindConnect4Events(root: HTMLElement, ctx: Connect4BindContext): void {
  const submitDrop = (col: number): void => {
    const state = ctx.runtime.controller.getState();
    const view = (state.view ?? {}) as Connect4View;
    const mySeat = state.seatId ?? ctx.playerId;
    if (view.phase !== "play" || view.currentPlayerId !== mySeat) {
      ctx.pushLog("click_ignored connect4_not_your_turn");
      return;
    }
    ctx.runtime.controller.submitAction("drop", { col });
    ctx.render();
  };

  const onColumnClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    const el = target.closest<HTMLElement>("[data-col]");
    if (!el || el.hasAttribute("disabled")) return;
    const col = Number(el.dataset.col ?? "-1");
    if (col >= 0) submitDrop(col);
  };

  root.querySelector<HTMLElement>("#connect4-drop-row")?.addEventListener("click", onColumnClick);
  root.querySelector<HTMLElement>("#connect4-board")?.addEventListener("click", onColumnClick);
}
