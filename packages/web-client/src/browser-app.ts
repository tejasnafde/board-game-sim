import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import battleshipPresentation from "../../games/battleship/presentation.json";
import battleshipDefinition from "../../games/battleship/definition.json";
import { createDefaultPlacementsFromDefinition } from "./battleship-template";

function parsePlacements(raw: string): ShipPlacement[] {
  return JSON.parse(raw) as ShipPlacement[];
}

function parseCoord(rowInput: string, colInput: string): Coord {
  return {
    row: Number(rowInput),
    col: Number(colInput)
  };
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

  root.innerHTML = `
    <section>
      <h1>Board Game Sim - Battleship</h1>
      <p>Workflow: 1) Join, 2) Submit full fleet setup, 3) Fire only when phase is <code>play</code>.</p>
      <div>
        <label>Session <input id="session-id" value="demo-battleship" /></label>
        <label>Player <input id="player-id" value="player-1" /></label>
        <button id="join-btn">Join</button>
        <button id="rejoin-btn">Rejoin</button>
      </div>
      <div>
        <label>Placements JSON</label>
        <textarea id="placements-input" rows="8">${JSON.stringify(createDefaultPlacementsFromDefinition(battleshipDefinition), null, 2)}</textarea>
        <button id="load-template-btn">Load Valid Fleet</button>
        <button id="place-btn">Submit Setup</button>
      </div>
      <div>
        <label>Fire Row <input id="fire-row" value="0" /></label>
        <label>Fire Col <input id="fire-col" value="0" /></label>
        <button id="fire-btn">Fire</button>
      </div>
      <pre id="status-view">status: waiting_for_state</pre>
      <pre id="state-view">waiting_for_state</pre>
      <pre id="render-view">waiting_for_render</pre>
    </section>
  `;

  const sessionInput = root.querySelector<HTMLInputElement>("#session-id");
  const playerInput = root.querySelector<HTMLInputElement>("#player-id");
  const placementsInput = root.querySelector<HTMLTextAreaElement>("#placements-input");
  const fireRowInput = root.querySelector<HTMLInputElement>("#fire-row");
  const fireColInput = root.querySelector<HTMLInputElement>("#fire-col");
  const loadTemplateBtn = root.querySelector<HTMLButtonElement>("#load-template-btn");
  const joinBtn = root.querySelector<HTMLButtonElement>("#join-btn");
  const rejoinBtn = root.querySelector<HTMLButtonElement>("#rejoin-btn");
  const placeBtn = root.querySelector<HTMLButtonElement>("#place-btn");
  const fireBtn = root.querySelector<HTMLButtonElement>("#fire-btn");
  const statusView = root.querySelector<HTMLElement>("#status-view");
  const stateView = root.querySelector<HTMLElement>("#state-view");
  const renderView = root.querySelector<HTMLElement>("#render-view");

  const refresh = (): void => {
    const state = runtime.controller.getState();
    const view = (state.view ?? {}) as { phase?: string; currentPlayerId?: string };
    const phase = view.phase ?? "setup";
    const canFire = phase === "play";

    if (stateView) {
      stateView.textContent = JSON.stringify(state, null, 2);
    }
    if (renderView) {
      renderView.innerHTML = runtime.renderer.render(state.view ?? {});
    }
    if (statusView) {
      const pieces = [
        `phase=${phase}`,
        `current=${view.currentPlayerId ?? "-"}`,
        `error=${state.lastError ?? "none"}`,
        canFire ? "fire=enabled" : "fire=disabled (wait for play)"
      ];
      statusView.textContent = `status: ${pieces.join(" | ")}`;
    }
    if (fireBtn) {
      fireBtn.disabled = !canFire;
    }
  };

  transport.subscribe(() => {
    refresh();
  });

  loadTemplateBtn?.addEventListener("click", () => {
    if (placementsInput) {
      placementsInput.value = JSON.stringify(createDefaultPlacementsFromDefinition(battleshipDefinition), null, 2);
    }
    refresh();
  });

  joinBtn?.addEventListener("click", () => {
    runtime.controller.join(sessionInput?.value ?? "demo-battleship", playerInput?.value ?? "player-1");
    refresh();
  });

  rejoinBtn?.addEventListener("click", () => {
    runtime.rejoin();
    refresh();
  });

  placeBtn?.addEventListener("click", () => {
    try {
      const placements = parsePlacements(placementsInput?.value ?? "[]");
      runtime.controller.submitPlaceShips(placements);
    } catch {
      if (stateView) {
        stateView.textContent = "invalid_placements_json";
      }
    }
    refresh();
  });

  fireBtn?.addEventListener("click", () => {
    runtime.controller.submitFire(parseCoord(fireRowInput?.value ?? "0", fireColInput?.value ?? "0"));
    refresh();
  });

  return {
    runtime,
    dispose: () => {
      realtimeClient.disconnect();
      root.innerHTML = "";
    }
  };
}
