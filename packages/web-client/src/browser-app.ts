import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import battleshipPresentation from "../../games/battleship/presentation.json";
import battleshipDefinition from "../../games/battleship/definition.json";
import labyrinthPresentation from "../../games/labyrinth/presentation.json";
import { createDefaultPlacementsFromDefinition } from "./battleship-template";
import { navigate, parseHashRoute, toHashRoute, type AppRoute, type GameId } from "./routes";

type ClientView = {
  phase?: "setup" | "play" | "terminal";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
};

type LabyrinthView = {
  phase?: "play" | "terminal";
  turnStage?: "insert" | "move";
  currentPlayerId?: string;
  winnerPlayerId?: string | null;
  config?: { insertionIndexes?: number[] };
  board?: Array<Array<{ openings: Record<"N" | "E" | "S" | "W", boolean>; objectiveId: string | null }>>;
  players?: Array<{ playerId: string; position: Coord; objectivesRemainingCount: number }>;
  myState?: {
    remainingObjectives?: Array<{ id: string }>;
    reachableCells?: Coord[];
  };
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

type HubCard = {
  gameId: GameId;
  name: string;
  subtitle: string;
  status: "live" | "coming-soon";
  releaseTag: string;
  players: string;
  turnStyle: string;
};

export const GAME_HUB_CARDS: HubCard[] = [
  {
    gameId: "battleship",
    name: "Battleship",
    subtitle: "Hidden fleet placement with tactical turn-based strikes.",
    status: "live",
    releaseTag: "Playable now",
    players: "2 players",
    turnStyle: "Alternating turns"
  },
  {
    gameId: "labyrinth",
    name: "Labyrinth",
    subtitle: "Shifting maze strategy with rotating board pathways.",
    status: "live",
    releaseTag: "Playable now",
    players: "2-4 players",
    turnStyle: "Board transform turns"
  },
  {
    gameId: "catan",
    name: "Catan",
    subtitle: "Resource trading and settlement growth on a hex island.",
    status: "coming-soon",
    releaseTag: "Coming soon: later milestone",
    players: "3-4 players",
    turnStyle: "Dice + trading rounds"
  }
];

export function resolveGameHubNavigation(gameId: GameId): AppRoute | null {
  if (gameId === "catan") return null;
  return { name: "game", gameId };
}

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

function inferBattleshipScreen(joined: boolean, view: ClientView): "lobby" | "setup" | "gameplay" {
  if (!joined) return "lobby";
  if ((view.phase ?? "setup") === "setup") return "setup";
  return "gameplay";
}

function inferLabyrinthScreen(joined: boolean): "lobby" | "gameplay" {
  return joined ? "gameplay" : "lobby";
}

const DEFAULT_SESSION_BY_GAME: Record<GameId, string> = {
  battleship: "demo-battleship",
  labyrinth: "demo-labyrinth",
  catan: "demo-catan"
};

export function getGameplayPanelOrder(): Array<"debug" | "state"> {
  return ["debug", "state"];
}

export function mountPlayableClient(
  root: HTMLElement,
  options: {
    websocketFactory: () => SocketLike;
    assetBasePath?: string;
  }
): { runtime: WebClientRuntime; dispose: () => void } {
  const realtimeClient = new RealtimeClient(options.websocketFactory);
  realtimeClient.connect();

  const transport = {
    send: (event: Parameters<RealtimeClient["send"]>[0]) => realtimeClient.send(event),
    subscribe: (listener: Parameters<RealtimeClient["onServerEvent"]>[0]) => realtimeClient.onServerEvent(listener)
  };

  const runtimeByGame = {
    battleship: createWebClientRuntime({
      presentation: battleshipPresentation,
      baseAssetPath: options.assetBasePath ?? "/",
      transport
    }),
    labyrinth: createWebClientRuntime({
      presentation: labyrinthPresentation,
      baseAssetPath: options.assetBasePath ?? "/",
      transport
    })
  } satisfies Record<"battleship" | "labyrinth", WebClientRuntime>;

  const water = runtimeByGame.battleship.assetManager.resolveAssetUrl("tile-water");
  const shipPreview = {
    carrier: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-carrier"),
    battleship: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-battleship"),
    cruiser: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-cruiser"),
    submarine: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-submarine"),
    destroyer: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-destroyer")
  };

  let joined = false;
  let joinedGameId: GameId | null = null;
  let sessionId = DEFAULT_SESSION_BY_GAME.battleship;
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

  const getCurrentRoute = (): AppRoute => parseHashRoute(window.location.hash);
  const goHome = (): void => {
    joined = false;
    joinedGameId = null;
    navigate({ name: "landing" });
  };
  const getRuntimeForRoute = (route: AppRoute): WebClientRuntime => {
    if (route.name === "game" && route.gameId === "labyrinth") {
      return runtimeByGame.labyrinth;
    }
    return runtimeByGame.battleship;
  };

  realtimeClient.onLog((entry) => pushLog(entry));

  const renderHubLanding = (): string => {
    const cards = GAME_HUB_CARDS.map((card) => {
      const isLive = card.status === "live";
      const actionLabel = isLive ? "Play now" : "Coming soon";
      return `
        <article class="card game-card ${isLive ? "" : "is-disabled"}" aria-disabled="${isLive ? "false" : "true"}">
          <div class="game-card-head">
            <h2>${card.name}</h2>
            <span class="status-pill ${isLive ? "status-live" : "status-soon"}">${
              isLive ? "Live" : "Coming soon"
            }</span>
          </div>
          <p class="game-subtitle">${card.subtitle}</p>
          <p class="release-tag">${card.releaseTag}</p>
          <div class="meta-list">
            <span>${card.players}</span>
            <span>${card.turnStyle}</span>
          </div>
          <button class="btn ${isLive ? "btn-primary" : "btn-ghost"}" data-game-id="${card.gameId}" ${
            isLive ? "" : 'disabled aria-disabled="true"'
          }>${actionLabel}</button>
        </article>
      `;
    }).join("");

    return `
      <section class="screen game-hub" aria-label="Game hub">
        <header class="hero card">
          <p class="eyebrow">Board Game Sim</p>
          <h1>Choose Your Table</h1>
          <p>Play turn-based games with friends across cities from one shared command center.</p>
        </header>
        <section class="game-grid" id="game-hub-grid" aria-label="Available games">
          ${cards}
        </section>
      </section>
    `;
  };

  const renderBattleshipLobby = (): string => `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Battleship</h1>
        <p>Start a session and join as a player identity.</p>
      </header>
      <section class="card panel join-panel">
        <h2>Mission Lobby</h2>
        <label>Session ID <input id="session-id" value="${sessionId}" /></label>
        <label>Player ID <input id="player-id" value="${playerId}" /></label>
        <div class="row-actions">
          <button class="btn btn-primary" id="join-btn">Join Mission</button>
          <button class="btn btn-ghost" id="back-home-btn">Back to games</button>
        </div>
        <p class="hint">Use two windows with different player IDs to test locally.</p>
      </section>
    </section>
  `;

  const renderBattleshipSetup = (phase: string, stateLastError: string | null | undefined): string => `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Battleship Setup</h1>
        <p>Submit all ships before battle starts. Current phase: <strong>${phase}</strong></p>
      </header>
      <div class="setup-layout">
        <aside class="card panel fleet-panel">
          <h3>Fleet Manifest</h3>
          ${battleshipDefinition.ships
            .map(
              (ship) => `
                <button class="fleet-row fleet-button ${selectedShipId === ship.id ? "active" : ""}" data-ship-id="${
                ship.id
              }">
                  <img src="${shipPreview[ship.id as keyof typeof shipPreview]}" alt="${ship.id}" />
                  <span>${ship.id} (${ship.size})</span>
                  <strong>${placementDraftMap[ship.id] ? "Placed" : "Unplaced"}</strong>
                </button>
              `
            )
            .join("")}
          <div class="fleet-actions">
            <button class="btn btn-secondary" id="load-template-btn">Load Valid Fleet</button>
            <button class="btn btn-secondary" id="random-template-btn">Randomize Fleet</button>
          </div>
        </aside>
        <section class="card panel setup-editor">
          <h3>Interactive Placement</h3>
          <p class="hint">Select ship, rotate if needed, then click starting cell.</p>
          <div class="row-actions">
            <button class="btn btn-ghost" id="rotate-left-btn">Rotate -90°</button>
            <button class="btn btn-ghost" id="rotate-right-btn">Rotate +90°</button>
            <button class="btn btn-ghost" id="clear-ship-btn">Clear Selected</button>
          </div>
          <div class="placement-board" id="placement-board">
            ${renderPlacementBoardMarkup(shipSpecs, placementDraftMap, selectedShipId, shipPreview)}
          </div>
          <div class="row-actions">
            <button class="btn btn-primary" id="submit-setup-btn">Submit Setup</button>
            <button class="btn btn-secondary" id="rejoin-btn">Rejoin</button>
          </div>
          <p class="status">Last error: <strong>${localError ?? stateLastError ?? "none"}</strong></p>
        </section>
      </div>
    </section>
  `;

  const renderBattleshipGameplay = (
    phase: string,
    view: ClientView,
    canFire: boolean,
    stateDump: string,
    boardMarkup: string
  ): string => `
    <section class="screen battleship-screen">
      <header class="section-head">
        <h1>Live Battle</h1>
        <p>
          Phase: <strong>${phase}</strong> · Turn: <strong>${view.currentPlayerId ?? "-"}</strong>
          ${view.winnerPlayerId ? `· Winner: <strong>${view.winnerPlayerId}</strong>` : ""}
        </p>
        <p>${canFire ? "Your turn: click a cell on Opponent Board." : "Waiting for opponent turn or setup completion."}</p>
      </header>
      <div class="gameplay-screen">
        <div class="card panel board-panel" id="render-view">${boardMarkup}</div>
        <aside class="side-stack" aria-label="Debug and session diagnostics">
          <div class="card panel debug-panel">
            <h3>Debug Log</h3>
            <pre id="debug-view">${logs.join("\n") || "no_logs_yet"}</pre>
          </div>
          <div class="card panel log-panel">
            <h3>Session State</h3>
            <pre id="state-view">${stateDump}</pre>
          </div>
        </aside>
      </div>
    </section>
  `;

  const renderLabyrinthLobby = (): string => `
    <section class="screen labyrinth-screen">
      <header class="section-head">
        <h1>Labyrinth</h1>
        <p>Join a session and navigate the shifting maze to recover objectives.</p>
      </header>
      <section class="card panel join-panel">
        <h2>Maze Lobby</h2>
        <label>Session ID <input id="session-id" value="${sessionId}" /></label>
        <label>Player ID <input id="player-id" value="${playerId}" /></label>
        <div class="row-actions">
          <button class="btn btn-primary" id="join-btn">Join Maze</button>
          <button class="btn btn-ghost" id="back-home-btn">Back to games</button>
        </div>
        <p class="hint">Use player IDs player-1 through player-4 for the demo session.</p>
      </section>
    </section>
  `;

  const renderLabyrinthBoardMarkup = (view: LabyrinthView): string => {
    const board = view.board ?? [];
    const reachable = new Set((view.myState?.reachableCells ?? []).map((cell) => `${cell.row},${cell.col}`));
    const players = view.players ?? [];

    const cells: string[] = [];
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
        const tile = board[row]?.[col];
        const openings = tile?.openings ?? { N: false, E: false, S: false, W: false };
        const playerTokens = players
          .filter((player) => player.position.row === row && player.position.col === col)
          .map((player) => player.playerId)
          .join(",");

        const classes = ["labyrinth-cell"];
        if (reachable.has(`${row},${col}`)) {
          classes.push("reachable");
        }

        cells.push(
          `<button class="${classes.join(" ")}" data-lab-cell="1" data-r="${row}" data-c="${col}" title="${row},${col} obj=${tile?.objectiveId ?? "-"} players=${playerTokens || "-"}">
            <span class="tile-openings">${openings.N ? "N" : ""}${openings.E ? "E" : ""}${openings.S ? "S" : ""}${openings.W ? "W" : ""}</span>
            <span class="tile-obj">${tile?.objectiveId ?? ""}</span>
            <span class="tile-players">${playerTokens}</span>
          </button>`
        );
      }
    }
    return `<div class="labyrinth-grid">${cells.join("")}</div>`;
  };

  const renderLabyrinthGameplay = (view: LabyrinthView, stateDump: string): string => {
    const insertionIndexes = view.config?.insertionIndexes ?? [1, 3, 5];
    const myObjectives = (view.myState?.remainingObjectives ?? []).map((objective) => objective.id).join(", ") || "none";
    const isMyTurn = view.currentPlayerId === playerId;
    const turnHint =
      view.turnStage === "insert"
        ? "Insert the spare tile from a highlighted edge slot."
        : "Move to any reachable highlighted cell.";

    const insertionButtons = insertionIndexes
      .map(
        (index) => `
          <button class="btn btn-secondary labyrinth-insert-btn" data-edge="top" data-index="${index}">Top ${index}</button>
          <button class="btn btn-secondary labyrinth-insert-btn" data-edge="bottom" data-index="${index}">Bottom ${index}</button>
          <button class="btn btn-secondary labyrinth-insert-btn" data-edge="left" data-index="${index}">Left ${index}</button>
          <button class="btn btn-secondary labyrinth-insert-btn" data-edge="right" data-index="${index}">Right ${index}</button>
        `
      )
      .join("");

    return `
      <section class="screen labyrinth-screen">
        <header class="section-head">
          <h1>Labyrinth</h1>
          <p>
            Phase: <strong>${view.phase ?? "play"}</strong> · Stage: <strong>${view.turnStage ?? "insert"}</strong>
            · Turn: <strong>${view.currentPlayerId ?? "-"}</strong>
            ${view.winnerPlayerId ? `· Winner: <strong>${view.winnerPlayerId}</strong>` : ""}
          </p>
          <p>${isMyTurn ? turnHint : "Waiting for active player's turn."}</p>
        </header>
        <div class="gameplay-screen">
          <div class="card panel board-panel">
            <h3>Maze Board</h3>
            <div class="row-actions labyrinth-insert-controls" id="labyrinth-insert-controls">${insertionButtons}</div>
            <div id="labyrinth-board">${renderLabyrinthBoardMarkup(view)}</div>
          </div>
          <aside class="side-stack">
            <div class="card panel">
              <h3>Your Objectives</h3>
              <p>${myObjectives}</p>
            </div>
            <div class="card panel debug-panel">
              <h3>Debug Log</h3>
              <pre>${logs.join("\n") || "no_logs_yet"}</pre>
            </div>
            <div class="card panel log-panel">
              <h3>Session State</h3>
              <pre>${stateDump}</pre>
            </div>
          </aside>
        </div>
      </section>
    `;
  };

  const renderComingSoon = (gameId: Exclude<GameId, "battleship" | "labyrinth">): string => {
    const card = GAME_HUB_CARDS.find((item) => item.gameId === gameId);
    return `
      <section class="screen coming-soon" aria-label="Coming soon">
        <article class="card panel">
          <p class="eyebrow">Roadmap</p>
          <h1>${card?.name ?? gameId} is coming soon</h1>
          <p>${card?.subtitle ?? "This module is planned for a future release."}</p>
          <button class="btn btn-primary" id="back-home-btn">Back to games</button>
        </article>
      </section>
    `;
  };

  const render = (): void => {
    const route = getCurrentRoute();
    const runtime = getRuntimeForRoute(route);
    const state = runtime.controller.getState();
    const view = (state.view ?? {}) as ClientView;
    const phase = view.phase ?? "setup";

    const topNav = `
      <nav class="top-nav" aria-label="Primary">
        <a class="brand" href="#/">Board Game Sim</a>
        <div class="top-nav-right">
          <span class="top-chip">Session: ${sessionId}</span>
          <span class="top-chip">Player: ${playerId}</span>
          ${route.name === "game" ? `<button class="btn btn-ghost" id="nav-back-btn">Back to games</button>` : ""}
        </div>
      </nav>
    `;

    let mainContent = "";

    if (route.name === "landing") {
      mainContent = renderHubLanding();
    } else if (route.gameId === "catan") {
      mainContent = renderComingSoon(route.gameId);
    } else {
      const gameUiAdapters = {
        battleship: () => {
          const battleshipScreen = inferBattleshipScreen(joined && joinedGameId === "battleship", view);
          const canFire = phase === "play" && view.currentPlayerId === playerId;
          if (battleshipScreen === "lobby") return renderBattleshipLobby();
          if (battleshipScreen === "setup") return renderBattleshipSetup(phase, state.lastError);
          return renderBattleshipGameplay(
            phase,
            view,
            canFire,
            JSON.stringify(state, null, 2),
            runtime.renderer.render(view)
          );
        },
        labyrinth: () => {
          const labyrinthView = (state.view ?? {}) as LabyrinthView;
          const labyrinthScreen = inferLabyrinthScreen(joined && joinedGameId === "labyrinth");
          if (labyrinthScreen === "lobby") return renderLabyrinthLobby();
          return renderLabyrinthGameplay(labyrinthView, JSON.stringify(state, null, 2));
        }
      } as const;

      if (route.gameId === "battleship") {
        mainContent = gameUiAdapters.battleship();
      } else if (route.gameId === "labyrinth") {
        mainContent = gameUiAdapters.labyrinth();
      }
    }

    root.innerHTML = `
      <section class="app-shell" style="--water-url:url('${water}')">
        ${topNav}
        <main>${mainContent}</main>
      </section>
    `;

    const gameHubGrid = root.querySelector<HTMLElement>("#game-hub-grid");
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
    const labyrinthInsertControls = root.querySelector<HTMLElement>("#labyrinth-insert-controls");
    const labyrinthBoard = root.querySelector<HTMLElement>("#labyrinth-board");
    const placementBoard = root.querySelector<HTMLElement>("#placement-board");
    const fleetPanel = root.querySelector<HTMLElement>(".fleet-panel");
    const navBackBtn = root.querySelector<HTMLButtonElement>("#nav-back-btn");
    const backHomeBtn = root.querySelector<HTMLButtonElement>("#back-home-btn");

    navBackBtn?.addEventListener("click", () => goHome());
    backHomeBtn?.addEventListener("click", () => goHome());

    gameHubGrid?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>("button[data-game-id]");
      if (!button) {
        return;
      }
      const gameId = button.dataset.gameId as GameId;
      const nextRoute = resolveGameHubNavigation(gameId);
      if (nextRoute) {
        joined = false;
        joinedGameId = null;
        sessionId = DEFAULT_SESSION_BY_GAME[gameId];
        navigate(nextRoute);
      }
    });

    sessionInput?.addEventListener("input", () => {
      sessionId = sessionInput.value;
    });

    playerInput?.addEventListener("input", () => {
      playerId = playerInput.value;
    });

    joinBtn?.addEventListener("click", () => {
      joined = true;
      joinedGameId = route.name === "game" ? route.gameId : null;
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

    labyrinthInsertControls?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>(".labyrinth-insert-btn");
      if (!button) {
        return;
      }
      const stateForAction = runtime.controller.getState();
      const labyrinthView = (stateForAction.view ?? {}) as LabyrinthView;
      if (labyrinthView.currentPlayerId !== playerId || labyrinthView.turnStage !== "insert") {
        pushLog("click_ignored labyrinth_insert_not_allowed");
        return;
      }

      const edge = button.dataset.edge as "top" | "bottom" | "left" | "right";
      const index = Number(button.dataset.index ?? "-1");
      if (index < 0) {
        return;
      }

      runtime.controller.submitAction("insert_tile", { edge, index });
      render();
    });

    labyrinthBoard?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const cell = target.closest<HTMLButtonElement>("[data-lab-cell='1']");
      if (!cell) {
        return;
      }
      const stateForAction = runtime.controller.getState();
      const labyrinthView = (stateForAction.view ?? {}) as LabyrinthView;
      if (labyrinthView.currentPlayerId !== playerId || labyrinthView.turnStage !== "move") {
        pushLog("click_ignored labyrinth_move_not_allowed");
        return;
      }

      const row = Number(cell.dataset.r ?? "-1");
      const col = Number(cell.dataset.c ?? "-1");
      if (row < 0 || col < 0) {
        return;
      }

      runtime.controller.submitAction("move_pawn", { row, col });
      render();
    });

    renderView?.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("opponent-cell")) {
        return;
      }

      const stateForAction = runtime.controller.getState();
      const latestView = (stateForAction.view ?? {}) as ClientView;
      const latestPhase = latestView.phase ?? "setup";
      const canFire = latestPhase === "play" && latestView.currentPlayerId === playerId;
      if (!canFire) {
        pushLog(
          `click_ignored not_your_turn_or_not_play phase=${latestPhase} current=${latestView.currentPlayerId ?? "-"}`
        );
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

  const disposeTransportSubscription = transport.subscribe(() => {
    render();
  });

  const onHashChange = (): void => {
    render();
  };

  window.addEventListener("hashchange", onHashChange);

  if (!window.location.hash) {
    window.location.hash = toHashRoute({ name: "landing" });
  }

  render();

  return {
    runtime: runtimeByGame.battleship,
    dispose: () => {
      disposeTransportSubscription();
      window.removeEventListener("hashchange", onHashChange);
      realtimeClient.disconnect();
      root.innerHTML = "";
    }
  };
}
