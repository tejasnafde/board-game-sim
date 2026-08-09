import { coordKey, findPath, findReachable } from "@board-game-sim/labyrinth";
import type { Tile } from "@board-game-sim/labyrinth";
import type { WebClientRuntime } from "../../runtime";
import type { LabyrinthView } from "./types";

type Coord = { row: number; col: number };

const PATH_CLASSES = ["path-step", "path-step-blocked", "path-target", "path-unreachable", "path-dead-end"];

function clearPathPreview(board: HTMLElement): void {
  for (const el of board.querySelectorAll(`.${PATH_CLASSES.join(", .")}`)) {
    el.classList.remove(...PATH_CLASSES);
  }
}

function cellButton(board: HTMLElement, c: Coord): HTMLElement | null {
  return board.querySelector(`[data-lab-cell="1"][data-r="${c.row}"][data-c="${c.col}"]`);
}

/**
 * Hover preview: reachable targets show the corridor path; unreachable ones
 * show how close you can get and where the corridor dead-ends.
 */
function showPathPreview(
  board: HTMLElement,
  view: LabyrinthView,
  config: { rows: number; cols: number },
  from: Coord,
  target: Coord
): void {
  clearPathPreview(board);
  const tiles = view.board as Tile[][] | undefined;
  if (!tiles) return;

  const path = findPath(tiles, config, from, target);
  if (path) {
    for (const step of path.slice(1, -1)) cellButton(board, step)?.classList.add("path-step");
    cellButton(board, target)?.classList.add("path-target");
    return;
  }

  // closest approach by real corridors, then mark the dead end
  const reachable = [...findReachable(tiles, config, from)].map((key) => {
    const [row, col] = key.split(":").map(Number);
    return { row: row!, col: col! };
  });
  let nearest = from;
  let best = Infinity;
  for (const cell of reachable) {
    const d = Math.abs(cell.row - target.row) + Math.abs(cell.col - target.col);
    if (d < best) {
      best = d;
      nearest = cell;
    }
  }
  const approach = findPath(tiles, config, from, nearest) ?? [];
  for (const step of approach.slice(1)) cellButton(board, step)?.classList.add("path-step-blocked");
  cellButton(board, nearest)?.classList.add("path-dead-end");
  cellButton(board, target)?.classList.add("path-unreachable");
}

/** Walk a ghost token along the path before the move submits - no teleporting. */
async function walkGhost(board: HTMLElement, path: Coord[], colorClass: string): Promise<void> {
  const start = cellButton(board, path[0]!);
  if (!start || path.length < 2) return;
  const ghost = document.createElement("div");
  ghost.className = `player-token ${colorClass} ghost-token`;
  document.body.appendChild(ghost);
  const place = (c: Coord): void => {
    const rect = cellButton(board, c)?.getBoundingClientRect();
    if (!rect) return;
    ghost.style.left = `${rect.left + rect.width / 2}px`;
    ghost.style.top = `${rect.top + rect.height / 2}px`;
  };
  place(path[0]!);
  for (const step of path.slice(1)) {
    await new Promise((resolve) => setTimeout(resolve, 55));
    place(step);
  }
  await new Promise((resolve) => setTimeout(resolve, 80));
  ghost.remove();
}

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

  const canMoveNow = (): { view: LabyrinthView; me: Coord; size: { rows: number; cols: number } } | null => {
    const state = ctx.runtime.controller.getState();
    const view = (state.view ?? {}) as LabyrinthView;
    const mySeat = state.seatId ?? ctx.playerId;
    if (view.currentPlayerId !== mySeat || view.turnStage !== "move" || !view.myState?.position) return null;
    const size = { rows: view.config?.rows ?? 7, cols: view.config?.cols ?? 7 };
    return { view, me: view.myState.position, size };
  };

  labyrinthBoard?.addEventListener("mouseover", (event) => {
    const cell = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-lab-cell='1']");
    if (!cell || !labyrinthBoard) return;
    const ready = canMoveNow();
    if (!ready) return;
    const row = Number(cell.dataset.r ?? "-1");
    const col = Number(cell.dataset.c ?? "-1");
    if (row < 0 || col < 0) return;
    showPathPreview(labyrinthBoard, ready.view, ready.size, ready.me, { row, col });
  });

  labyrinthBoard?.addEventListener("mouseleave", () => {
    if (labyrinthBoard) clearPathPreview(labyrinthBoard);
  });

  labyrinthBoard?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLButtonElement>("[data-lab-cell='1']");
    if (!cell || !labyrinthBoard) {
      return;
    }
    const ready = canMoveNow();
    if (!ready) {
      ctx.pushLog("click_ignored labyrinth_move_not_allowed");
      return;
    }

    const row = Number(cell.dataset.r ?? "-1");
    const col = Number(cell.dataset.c ?? "-1");
    if (row < 0 || col < 0) {
      return;
    }

    const tiles = ready.view.board as Tile[][] | undefined;
    const path = tiles ? findPath(tiles, ready.size, ready.me, { row, col }) : null;
    if (path && path.length > 1) {
      clearPathPreview(labyrinthBoard);
      const seatIndex = (ready.view.players ?? []).findIndex((p) => p.playerId === ready.view.currentPlayerId);
      await walkGhost(labyrinthBoard, path, `player-color-${Math.max(0, seatIndex)}`);
    }

    ctx.runtime.controller.submitAction("move_pawn", { row, col });
    ctx.render();
  });
}
