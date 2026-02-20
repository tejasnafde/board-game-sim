import type { ShipPlacement, Coord } from "@board-game-sim/battleship";
import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import battleshipPresentation from "../../games/battleship/presentation.json";

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
      <div>
        <label>Session <input id="session-id" value="demo-battleship" /></label>
        <label>Player <input id="player-id" value="player-1" /></label>
        <button id="join-btn">Join</button>
        <button id="rejoin-btn">Rejoin</button>
      </div>
      <div>
        <label>Placements JSON</label>
        <textarea id="placements-input" rows="4">[{"shipId":"destroyer","cells":[{"row":0,"col":0},{"row":0,"col":1}]}]</textarea>
        <button id="place-btn">Submit Setup</button>
      </div>
      <div>
        <label>Fire Row <input id="fire-row" value="0" /></label>
        <label>Fire Col <input id="fire-col" value="0" /></label>
        <button id="fire-btn">Fire</button>
      </div>
      <pre id="state-view">waiting_for_state</pre>
      <pre id="render-view">waiting_for_render</pre>
    </section>
  `;

  const sessionInput = root.querySelector<HTMLInputElement>("#session-id");
  const playerInput = root.querySelector<HTMLInputElement>("#player-id");
  const placementsInput = root.querySelector<HTMLTextAreaElement>("#placements-input");
  const fireRowInput = root.querySelector<HTMLInputElement>("#fire-row");
  const fireColInput = root.querySelector<HTMLInputElement>("#fire-col");
  const joinBtn = root.querySelector<HTMLButtonElement>("#join-btn");
  const rejoinBtn = root.querySelector<HTMLButtonElement>("#rejoin-btn");
  const placeBtn = root.querySelector<HTMLButtonElement>("#place-btn");
  const fireBtn = root.querySelector<HTMLButtonElement>("#fire-btn");
  const stateView = root.querySelector<HTMLElement>("#state-view");
  const renderView = root.querySelector<HTMLElement>("#render-view");

  const refresh = (): void => {
    const state = runtime.controller.getState();
    if (stateView) {
      stateView.textContent = JSON.stringify(state, null, 2);
    }
    if (renderView) {
      renderView.textContent = runtime.renderer.render(state.view ?? {});
    }
  };

  transport.subscribe(() => {
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
