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

function parsePlacements(raw: string): ShipPlacement[] {
  return JSON.parse(raw) as ShipPlacement[];
}

function createRandomizedPlacements(): ShipPlacement[] {
  return battleshipDefinition.ships.map((ship, idx) => ({
    shipId: ship.id,
    cells: Array.from({ length: ship.size }).map((_, c) => ({
      row: idx * 2,
      col: c + ((idx * 2) % 3)
    }))
  }));
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
    baseAssetPath: options.assetBasePath ?? "/games/battleship",
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
  let placementsText = JSON.stringify(createDefaultPlacementsFromDefinition(battleshipDefinition), null, 2);
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
                  <div class="fleet-row">
                    <img src="${shipPreview[ship.id as keyof typeof shipPreview]}" alt="${ship.id}" />
                    <span>${ship.id} (${ship.size})</span>
                  </div>
                `
              )
              .join("")}
            <div class="fleet-actions">
              <button id="load-template-btn">Load Valid Fleet</button>
              <button id="random-template-btn">Randomize Fleet</button>
            </div>
          </aside>
          <section class="panel setup-editor">
            <h3>Placement JSON</h3>
            <textarea id="placements-input" rows="12">${placementsText}</textarea>
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
    const placementsInput = root.querySelector<HTMLTextAreaElement>("#placements-input");
    const loadTemplateBtn = root.querySelector<HTMLButtonElement>("#load-template-btn");
    const randomTemplateBtn = root.querySelector<HTMLButtonElement>("#random-template-btn");
    const submitSetupBtn = root.querySelector<HTMLButtonElement>("#submit-setup-btn");
    const rejoinBtn = root.querySelector<HTMLButtonElement>("#rejoin-btn");
    const renderView = root.querySelector<HTMLElement>("#render-view");

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
      placementsText = JSON.stringify(createDefaultPlacementsFromDefinition(battleshipDefinition), null, 2);
      render();
    });

    randomTemplateBtn?.addEventListener("click", () => {
      placementsText = JSON.stringify(createRandomizedPlacements(), null, 2);
      render();
    });

    submitSetupBtn?.addEventListener("click", () => {
      try {
        placementsText = placementsInput?.value ?? placementsText;
        runtime.controller.submitPlaceShips(parsePlacements(placementsText));
        localError = null;
      } catch {
        localError = "invalid_placements_json";
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
