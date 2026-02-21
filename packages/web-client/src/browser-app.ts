import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import { battleshipManifest, getManifest, labyrinthManifest } from "./game-manifests";
import { createDefaultPlacementsFromDefinition } from "./battleship-template";
import { renderAppShell, renderComingSoon, renderHubLanding } from "./app-shell";
import {
  bindBattleshipEvents,
  inferBattleshipScreen,
  placementsToDraftMap,
  renderBattleshipGameplay,
  renderBattleshipLobby,
  renderBattleshipSetup,
  type ClientView,
  type ShipSpec
} from "./game-adapters/battleship";
import {
  bindLabyrinthEvents,
  inferLabyrinthScreen,
  renderLabyrinthGameplay,
  renderLabyrinthLobby,
  type LabyrinthView
} from "./game-adapters/labyrinth";
import { GAME_HUB_CARDS, resolveGameHubNavigation } from "./game-hub";
import { navigate, parseHashRoute, toHashRoute, type AppRoute, type GameId } from "./routes";

export { GAME_HUB_CARDS, resolveGameHubNavigation };

function getDefaultSessionForGame(gameId: GameId): string {
  const manifest = getManifest(gameId);
  if (manifest) return manifest.defaultSessionId;
  return "demo-catan";
}

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
      presentation: battleshipManifest.presentation,
      baseAssetPath: options.assetBasePath ?? "/",
      transport
    }),
    labyrinth: createWebClientRuntime({
      presentation: labyrinthManifest.presentation,
      baseAssetPath: options.assetBasePath ?? "/",
      transport
    })
  } satisfies Record<"battleship" | "labyrinth", WebClientRuntime>;

  const shipPreview = {
    carrier: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-carrier"),
    battleship: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-battleship"),
    cruiser: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-cruiser"),
    submarine: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-submarine"),
    destroyer: runtimeByGame.battleship.assetManager.resolveAssetUrl("ship-destroyer")
  };

  let joined = false;
  let joinedGameId: GameId | null = null;
  let sessionId = getDefaultSessionForGame("battleship");
  let playerId = "player-1";
  const battleshipDefinition = battleshipManifest.definition as { board: { rows: number; cols: number }; ships: ShipSpec[] };
  const shipSpecs = battleshipDefinition.ships;
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

  const render = (): void => {
    const route = getCurrentRoute();
    const runtime = getRuntimeForRoute(route);
    const state = runtime.controller.getState();
    const view = (state.view ?? {}) as ClientView;
    const phase = view.phase ?? "setup";

    let mainContent = "";

    if (route.name === "landing") {
      mainContent = renderHubLanding();
    } else if (route.name === "game" && route.gameId === "catan") {
      mainContent = renderComingSoon(route.gameId);
    } else {
      const gameUiAdapters = {
        battleship: () => {
          const battleshipScreen = inferBattleshipScreen(joined && joinedGameId === "battleship", view);
          const canFire = phase === "play" && view.currentPlayerId === playerId;
          if (battleshipScreen === "lobby") return renderBattleshipLobby(sessionId, playerId);
          if (battleshipScreen === "setup")
            return renderBattleshipSetup(
              battleshipDefinition,
              phase,
              sessionId,
              playerId,
              placementDraftMap,
              selectedShipId,
              shipPreview,
              localError,
              state.lastError
            );
          return renderBattleshipGameplay(
            phase,
            view,
            canFire,
            runtime.renderer.render(view),
            logs,
            JSON.stringify(state, null, 2)
          );
        },
        labyrinth: () => {
          const labyrinthView = (state.view ?? {}) as LabyrinthView;
          const labyrinthScreen = inferLabyrinthScreen(joined && joinedGameId === "labyrinth");
          if (labyrinthScreen === "lobby") return renderLabyrinthLobby(sessionId, playerId);
          return renderLabyrinthGameplay(labyrinthView, playerId, logs, JSON.stringify(state, null, 2));
        }
      } as const;

      if (route.gameId === "battleship") {
        mainContent = gameUiAdapters.battleship();
      } else if (route.gameId === "labyrinth") {
        mainContent = gameUiAdapters.labyrinth();
      }
    }

    root.innerHTML = renderAppShell(mainContent, route, sessionId, playerId);

    const gameHubGrid = root.querySelector<HTMLElement>("#game-hub-grid");
    const sessionInput = root.querySelector<HTMLInputElement>("#session-id");
    const playerInput = root.querySelector<HTMLInputElement>("#player-id");
    const joinBtn = root.querySelector<HTMLButtonElement>("#join-btn");
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
        sessionId = getDefaultSessionForGame(gameId);
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

    if (route.name === "game" && route.gameId === "battleship") {
      bindBattleshipEvents(root, {
        runtime,
        definition: battleshipDefinition,
        shipSpecs,
        placementDraftMap,
        selectedShipId,
        localError,
        playerId,
        render,
        pushLog,
        setPlacementDraftMap: (map) => {
          placementDraftMap = map;
        },
        setSelectedShipId: (id) => {
          selectedShipId = id;
        },
        setLocalError: (err) => {
          localError = err;
        }
      });
    }

    if (route.name === "game" && route.gameId === "labyrinth") {
      bindLabyrinthEvents(root, {
        runtime,
        playerId,
        render,
        pushLog
      });
    }
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
