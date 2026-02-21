import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import battleshipPresentation from "../../games/battleship/presentation.json";
import battleshipDefinition from "../../games/battleship/definition.json";
import { createDefaultPlacementsFromDefinition } from "./battleship-template";

type ClientView = {
  phase?: "setup" | "play" | "terminal";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
};

type Orientation = "horizontal" | "vertical";

type PlacementDraft = {
  row: number;
  col: number;
  rotationDeg: 0 | 90 | 180 | 270;
};

type ShipSpec = {
  id: string;
  size: number;
};

function createRandomizedPlacements(): ShipPlacement[] {
  const shipSpecs = [...(battleshipDefinition.ships as ShipSpec[])].sort((a, b) => b.size - a.size);
  const rows = battleshipDefinition.board.rows;
  const cols = battleshipDefinition.board.cols;

  const createCoordKey = (cell: Coord): string => `${cell.row},${cell.col}`;

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const occupied = new Set<string>();
    const placements: ShipPlacement[] = [];

    let valid = true;
    for (const ship of shipSpecs) {
      let placed = false;
      for (let placementAttempt = 0; placementAttempt < 200; placementAttempt += 1) {
        const orientation: Orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
        const maxRow = orientation === "vertical" ? rows - ship.size : rows - 1;
        const maxCol = orientation === "horizontal" ? cols - ship.size : cols - 1;
        const row = Math.floor(Math.random() * (maxRow + 1));
        const col = Math.floor(Math.random() * (maxCol + 1));
        const candidate = buildCellsFromAnchor(
          { row, col, rotationDeg: orientation === "horizontal" ? 0 : 90 },
          ship.size
        );
        if (!candidate.every((cell) => !occupied.has(createCoordKey(cell)))) {
          continue;
        }

        candidate.forEach((cell) => occupied.add(createCoordKey(cell)));
        placements.push({ shipId: ship.id, cells: candidate });
        placed = true;
        break;
      }

      if (!placed) {
        valid = false;
        break;
      }
    }

    if (valid && placements.length === shipSpecs.length) {
      return placements;
    }
  }

  return createDefaultPlacementsFromDefinition(battleshipDefinition);
}

function buildCellsFromAnchor(anchor: PlacementDraft, size: number): Coord[] {
  const orientation = anchor.rotationDeg % 180 === 0 ? "horizontal" : "vertical";
  return Array.from({ length: size }).map((_, offset) =>
    orientation === "horizontal"
      ? { row: anchor.row, col: anchor.col + offset }
      : { row: anchor.row + offset, col: anchor.col }
  );
}

function isInBounds(cells: Coord[]): boolean {
  return cells.every(
    (cell) =>
      cell.row >= 0 &&
      cell.row < battleshipDefinition.board.rows &&
      cell.col >= 0 &&
      cell.col < battleshipDefinition.board.cols
  );
}

function placementsToDraftMap(placements: ShipPlacement[]): Record<string, PlacementDraft> {
  const result: Record<string, PlacementDraft> = {};
  for (const placement of placements) {
    const first = placement.cells[0];
    const second = placement.cells[1] ?? first;
    const orientation: Orientation = first.row === second.row ? "horizontal" : "vertical";
    result[placement.shipId] = {
      row: first.row,
      col: first.col,
      rotationDeg: orientation === "horizontal" ? 0 : 90
    };
  }
  return result;
}

function rotateClockwise(current: PlacementDraft["rotationDeg"]): PlacementDraft["rotationDeg"] {
  return ((current + 90) % 360) as PlacementDraft["rotationDeg"];
}

function rotateCounterClockwise(current: PlacementDraft["rotationDeg"]): PlacementDraft["rotationDeg"] {
  return ((current + 270) % 360) as PlacementDraft["rotationDeg"];
}

function renderPlacementBoardMarkup(
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  selectedShipId: string,
  shipPreview: Record<string, string>
): string {
  const occupied = new Set<string>();
  for (const spec of specs) {
    const draft = draftMap[spec.id];
    if (!draft) continue;
    for (const cell of buildCellsFromAnchor(draft, spec.size)) {
      occupied.add(`${cell.row},${cell.col}`);
    }
  }

  const selectedSpec = specs.find((spec) => spec.id === selectedShipId);
  const selectedDraft = selectedSpec ? draftMap[selectedShipId] : undefined;
  const selectedCoverage = new Set<string>();
  if (selectedSpec && selectedDraft) {
    for (const cell of buildCellsFromAnchor(selectedDraft, selectedSpec.size)) {
      selectedCoverage.add(`${cell.row},${cell.col}`);
    }
  }

  const cells: string[] = [];
  for (let row = 0; row < battleshipDefinition.board.rows; row += 1) {
    for (let col = 0; col < battleshipDefinition.board.cols; col += 1) {
      const classes = ["placement-cell"];
      const key = `${row},${col}`;
      if (occupied.has(key)) {
        classes.push("occupied");
      }
      if (selectedCoverage.has(key)) {
        classes.push("selected-cell");
      }
      if (selectedDraft && selectedDraft.row === row && selectedDraft.col === col) {
        classes.push("selected-anchor");
      }
      cells.push(
        `<button class="${classes.join(" ")}" data-r="${row}" data-c="${col}" title="${row},${col}"></button>`
      );
    }
  }

  const shipSprites = specs
    .map((spec) => {
      const draft = draftMap[spec.id];
      if (!draft) {
        return "";
      }
      const orientation = draft.rotationDeg % 180 === 0 ? "horizontal" : "vertical";
      const widthCells = orientation === "horizontal" ? spec.size : 1;
      const heightCells = orientation === "vertical" ? spec.size : 1;
      const spriteClass = `placement-ship ${selectedShipId === spec.id ? "selected" : ""}`;
      return `<div class="${spriteClass}" style="--ship-row:${draft.row};--ship-col:${draft.col};--ship-width:${widthCells};--ship-height:${heightCells};--ship-rotation:${
        draft.rotationDeg
      }deg;" title="${spec.id}"><img src="${shipPreview[spec.id] ?? ""}" alt="${spec.id}" /></div>`;
    })
    .join("");

  return `
    <div class="placement-grid">${cells.join("")}</div>
    <div class="placement-ships-layer">${shipSprites}</div>
  `;
}

function canPlaceWithoutCollision(
  specs: ShipSpec[],
  draftMap: Record<string, PlacementDraft>,
  shipId: string,
  cells: Coord[]
): boolean {
  const occupied = new Set<string>();
  for (const spec of specs) {
    if (spec.id === shipId) continue;
    const draft = draftMap[spec.id];
    if (!draft) continue;
    for (const cell of buildCellsFromAnchor(draft, spec.size)) {
      occupied.add(`${cell.row},${cell.col}`);
    }
  }

  return cells.every((cell) => !occupied.has(`${cell.row},${cell.col}`));
}

function createPlacementsFromDrafts(specs: ShipSpec[], draftMap: Record<string, PlacementDraft>): ShipPlacement[] {
  return specs.map((ship) => {
    const draft = draftMap[ship.id];
    if (!draft) {
      throw new Error(`ship_not_placed_${ship.id}`);
    }
    const cells = buildCellsFromAnchor(draft, ship.size);
    if (!isInBounds(cells)) {
      throw new Error(`ship_out_of_bounds_${ship.id}`);
    }
    return {
      shipId: ship.id,
      cells
    };
  });
}

function inferScreen(joined: boolean, view: ClientView): "landing" | "setup" | "gameplay" {
  if (!joined) return "landing";
  if ((view.phase ?? "setup") === "setup") return "setup";
  return "gameplay";
}

export function getGameplayPanelOrder(): Array<"debug" | "state"> {
  return ["debug", "state"];
}

export function mountPlayableClient(root: HTMLElement, options: {
  websocketFactory: () => SocketLike;
  assetBasePath?: string;
}): { runtime: WebClientRuntime; dispose: () => void } {
  const realtimeClient = new RealtimeClient(options.websocketFactory);
  realtimeClient.connect();

  const transport = {
    send: (event: Parameters<RealtimeClient["send"]>[0]) => realtimeClient.send(event),
    subscribe: (listener: Parameters<RealtimeClient["onServerEvent"]>[0]) =>
      realtimeClient.onServerEvent(listener)
  };

  const runtime = createWebClientRuntime({
    presentation: battleshipPresentation,
    baseAssetPath: options.assetBasePath ?? "/",
    transport
  });

  const water = runtime.assetManager.resolveAssetUrl("tile-water");
  const shipPreview = {
    carrier: runtime.assetManager.resolveAssetUrl("ship-carrier"),
    battleship: runtime.assetManager.resolveAssetUrl("ship-battleship"),
    cruiser: runtime.assetManager.resolveAssetUrl("ship-cruiser"),
    submarine: runtime.assetManager.resolveAssetUrl("ship-submarine"),
    destroyer: runtime.assetManager.resolveAssetUrl("ship-destroyer")
  };

  let joined = false;
  let sessionId = "demo-battleship";
  let playerId = "player-1";
  const shipSpecs = battleshipDefinition.ships as ShipSpec[];
  let placementDraftMap = placementsToDraftMap(createDefaultPlacementsFromDefinition(battleshipDefinition));
  let selectedShipId = shipSpecs[0]?.id ?? "";
  let localError: string | null = null;
  const logs: string[] = [];

  const pushLog = (entry: string): void => {
    logs.unshift(`${new Date().toLocaleTimeString()} ${entry}`);
    if (logs.length > 50) {
      logs.pop();
    }
    console.info(`[web-client] ${entry}`);
  };

  realtimeClient.onLog((entry) => pushLog(entry));

  const render = (): void => {
    const state = runtime.controller.getState();
    const view = (state.view ?? {}) as ClientView;
    const screen = inferScreen(joined, view);
    const phase = view.phase ?? "setup";
    const canFire = phase === "play" && view.currentPlayerId === playerId;

    const landing = `
      <section class="screen landing-screen">
        <header class="hero">
          <p class="eyebrow">Remote tabletop nights</p>
          <h1>Battleship Command Deck</h1>
          <p>Join your friends, lock fleet positions, and launch turns live from browser.</p>
        </header>
        <div class="panel join-panel">
          <h2>Start Session</h2>
          <label>Session ID <input id="session-id" value="${sessionId}" /></label>
          <label>Player ID <input id="player-id" value="${playerId}" /></label>
          <button id="join-btn">Join Mission</button>
          <p class="hint">Use two windows with different player IDs to test locally.</p>
        </div>
      </section>
    `;

    const setup = `
      <section class="screen setup-screen">
        <header class="screen-header">
          <h2>Fleet Setup</h2>
          <p>Submit all ships before battle starts. Current phase: <strong>${phase}</strong></p>
        </header>
        <div class="setup-layout">
          <aside class="panel fleet-panel">
            <h3>Fleet Manifest</h3>
            ${battleshipDefinition.ships
              .map(
                (ship) => `
                  <button class="fleet-row fleet-button ${
                    selectedShipId === ship.id ? "active" : ""
                  }" data-ship-id="${ship.id}">
                    <img src="${shipPreview[ship.id as keyof typeof shipPreview]}" alt="${ship.id}" />
                    <span>${ship.id} (${ship.size})</span>
                    <strong>${placementDraftMap[ship.id] ? "Placed" : "Unplaced"}</strong>
                  </button>
                `
              )
              .join("")}
            <div class="fleet-actions">
              <button id="load-template-btn">Load Valid Fleet</button>
              <button id="random-template-btn">Randomize Fleet</button>
            </div>
          </aside>
          <section class="panel setup-editor">
            <h3>Interactive Placement</h3>
            <p class="hint">
              Select a ship on the left, use rotate if needed, then click a cell to place its starting point.
            </p>
            <div class="row-actions">
              <button id="rotate-left-btn">Rotate -90°</button>
              <button id="rotate-right-btn">Rotate +90°</button>
              <button id="clear-ship-btn">Clear Selected</button>
            </div>
            <div class="placement-board" id="placement-board">
              ${renderPlacementBoardMarkup(shipSpecs, placementDraftMap, selectedShipId, shipPreview)}
            </div>
            <div class="row-actions">
              <button id="submit-setup-btn">Submit Setup</button>
              <button id="rejoin-btn">Rejoin</button>
            </div>
            <p class="status">Last error: <strong>${localError ?? state.lastError ?? "none"}</strong></p>
          </section>
        </div>
      </section>
    `;

    const gameplay = `
      <section class="screen gameplay-screen">
        <header class="screen-header">
          <h2>Live Battle</h2>
          <p>
            Phase: <strong>${phase}</strong> · Turn: <strong>${view.currentPlayerId ?? "-"}</strong>
            ${view.winnerPlayerId ? `· Winner: <strong>${view.winnerPlayerId}</strong>` : ""}
          </p>
          <p>${canFire ? "Your turn: click a cell on Opponent Board." : "Waiting for opponent turn or setup completion."}</p>
        </header>
        <div class="panel board-panel" id="render-view">${runtime.renderer.render(state.view ?? {})}</div>
        <aside class="side-stack">
          <div class="panel debug-panel">
            <h3>Debug Log</h3>
            <pre id="debug-view">${logs.join("\n") || "no_logs_yet"}</pre>
          </div>
          <div class="panel log-panel">
            <h3>Session State</h3>
            <pre id="state-view">${JSON.stringify(state, null, 2)}</pre>
          </div>
        </aside>
      </section>
    `;

    root.innerHTML = `
      <section class="app-shell" style="--water-url:url('${water}')">
        <nav class="topbar">
          <span>Session: ${sessionId}</span>
          <span>Player: ${playerId}</span>
          <span>Screen: ${screen}</span>
        </nav>
        ${screen === "landing" ? landing : ""}
        ${screen === "setup" ? setup : ""}
        ${screen === "gameplay" ? gameplay : ""}
      </section>
    `;

    const sessionInput = root.querySelector<HTMLInputElement>("#session-id");
    const playerInput = root.querySelector<HTMLInputElement>("#player-id");
    const joinBtn = root.querySelector<HTMLButtonElement>("#join-btn");
    const loadTemplateBtn = root.querySelector<HTMLButtonElement>("#load-template-btn");
    const randomTemplateBtn = root.querySelector<HTMLButtonElement>("#random-template-btn");
    const rotateLeftBtn = root.querySelector<HTMLButtonElement>("#rotate-left-btn");
    const rotateRightBtn = root.querySelector<HTMLButtonElement>("#rotate-right-btn");
    const clearShipBtn = root.querySelector<HTMLButtonElement>("#clear-ship-btn");
    const submitSetupBtn = root.querySelector<HTMLButtonElement>("#submit-setup-btn");
    const rejoinBtn = root.querySelector<HTMLButtonElement>("#rejoin-btn");
    const renderView = root.querySelector<HTMLElement>("#render-view");
    const placementBoard = root.querySelector<HTMLElement>("#placement-board");
    const fleetPanel = root.querySelector<HTMLElement>(".fleet-panel");

    sessionInput?.addEventListener("input", () => {
      sessionId = sessionInput.value;
    });

    playerInput?.addEventListener("input", () => {
      playerId = playerInput.value;
    });

    joinBtn?.addEventListener("click", () => {
      joined = true;
      runtime.controller.join(sessionId, playerId);
      render();
    });

    loadTemplateBtn?.addEventListener("click", () => {
      placementDraftMap = placementsToDraftMap(createDefaultPlacementsFromDefinition(battleshipDefinition));
      render();
    });

    randomTemplateBtn?.addEventListener("click", () => {
      placementDraftMap = placementsToDraftMap(createRandomizedPlacements());
      render();
    });

    const applyRotation = (direction: "left" | "right"): void => {
      const active = placementDraftMap[selectedShipId] ?? { row: 0, col: 0, rotationDeg: 0 as const };
      const rotated: PlacementDraft = {
        ...active,
        rotationDeg:
          direction === "right" ? rotateClockwise(active.rotationDeg) : rotateCounterClockwise(active.rotationDeg)
      };
      const spec = shipSpecs.find((ship) => ship.id === selectedShipId);
      if (!spec) return;
      const candidateCells = buildCellsFromAnchor(rotated, spec.size);
      if (!isInBounds(candidateCells)) {
        localError = "rotation_out_of_bounds";
      } else if (!canPlaceWithoutCollision(shipSpecs, placementDraftMap, selectedShipId, candidateCells)) {
        localError = "rotation_collision";
      } else {
        placementDraftMap = {
          ...placementDraftMap,
          [selectedShipId]: rotated
        };
        localError = null;
      }
      render();
    };

    rotateLeftBtn?.addEventListener("click", () => applyRotation("left"));
    rotateRightBtn?.addEventListener("click", () => applyRotation("right"));

    clearShipBtn?.addEventListener("click", () => {
      const { [selectedShipId]: _ignored, ...rest } = placementDraftMap;
      placementDraftMap = rest;
      localError = null;
      render();
    });

    fleetPanel?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const shipButton = target.closest<HTMLElement>("[data-ship-id]");
      if (!shipButton) return;
      selectedShipId = shipButton.dataset.shipId ?? selectedShipId;
      render();
    });

    placementBoard?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("placement-cell")) {
        return;
      }
      const row = Number(target.dataset.r ?? "-1");
      const col = Number(target.dataset.c ?? "-1");
      if (row < 0 || col < 0) return;
      const ship = shipSpecs.find((spec) => spec.id === selectedShipId);
      if (!ship) return;
      const currentRotation = placementDraftMap[selectedShipId]?.rotationDeg ?? 0;
      const candidateDraft: PlacementDraft = { row, col, rotationDeg: currentRotation };
      const candidateCells = buildCellsFromAnchor(candidateDraft, ship.size);
      if (!isInBounds(candidateCells)) {
        localError = "ship_out_of_bounds";
      } else if (!canPlaceWithoutCollision(shipSpecs, placementDraftMap, selectedShipId, candidateCells)) {
        localError = "ship_overlap_collision";
      } else {
        placementDraftMap = {
          ...placementDraftMap,
          [selectedShipId]: candidateDraft
        };
        localError = null;
      }
      render();
    });

    submitSetupBtn?.addEventListener("click", () => {
      try {
        runtime.controller.submitPlaceShips(createPlacementsFromDrafts(shipSpecs, placementDraftMap));
        localError = null;
      } catch {
        localError = "setup_incomplete_or_invalid";
      }
      render();
    });

    rejoinBtn?.addEventListener("click", () => {
      runtime.rejoin();
      render();
    });

    renderView?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("opponent-cell")) {
        return;
      }
      if (!canFire) {
        pushLog(`click_ignored not_your_turn_or_not_play phase=${phase} current=${view.currentPlayerId ?? "-"}`);
        return;
      }
      const row = Number(target.dataset.r ?? "-1");
      const col = Number(target.dataset.c ?? "-1");
      if (row >= 0 && col >= 0) {
        pushLog(`click_fire row=${row} col=${col}`);
        runtime.controller.submitFire({ row, col });
        render();
      }
    });
  };

  transport.subscribe(() => {
    render();
  });

  render();

  return {
    runtime,
    dispose: () => {
      realtimeClient.disconnect();
      root.innerHTML = "";
    }
  };
}
