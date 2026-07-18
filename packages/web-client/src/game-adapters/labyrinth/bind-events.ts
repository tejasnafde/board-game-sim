import type { WebClientRuntime } from "../../runtime";
import type { LabyrinthView } from "./types";

export type LabyrinthBindContext = {
  runtime: WebClientRuntime;
  playerId: string;
  render: () => void;
  pushLog: (entry: string) => void;
};

export function bindLabyrinthEvents(root: HTMLElement, ctx: LabyrinthBindContext): void {
  const labyrinthInsertControls = root.querySelector<HTMLElement>("#labyrinth-insert-controls");
  const labyrinthBoard = root.querySelector<HTMLElement>("#labyrinth-board");

  labyrinthInsertControls?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>(".labyrinth-insert-btn");
    if (!button) {
      return;
    }
    const stateForAction = ctx.runtime.controller.getState();
    const labyrinthView = (stateForAction.view ?? {}) as LabyrinthView;
    const mySeat = stateForAction.seatId ?? ctx.playerId;
    if (labyrinthView.currentPlayerId !== mySeat || labyrinthView.turnStage !== "insert") {
      ctx.pushLog("click_ignored labyrinth_insert_not_allowed");
      return;
    }

    const edge = button.dataset.edge as "top" | "bottom" | "left" | "right";
    const index = Number(button.dataset.index ?? "-1");
    if (index < 0) {
      return;
    }

    ctx.runtime.controller.submitAction("insert_tile", { edge, index });
    ctx.render();
  });

  labyrinthBoard?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLButtonElement>("[data-lab-cell='1']");
    if (!cell) {
      return;
    }
    const stateForAction = ctx.runtime.controller.getState();
    const labyrinthView = (stateForAction.view ?? {}) as LabyrinthView;
    const mySeat = stateForAction.seatId ?? ctx.playerId;
    if (labyrinthView.currentPlayerId !== mySeat || labyrinthView.turnStage !== "move") {
      ctx.pushLog("click_ignored labyrinth_move_not_allowed");
      return;
    }

    const row = Number(cell.dataset.r ?? "-1");
    const col = Number(cell.dataset.c ?? "-1");
    if (row < 0 || col < 0) {
      return;
    }

    ctx.runtime.controller.submitAction("move_pawn", { row, col });
    ctx.render();
  });
}
