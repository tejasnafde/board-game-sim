import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import { battleshipManifest, getManifest, labyrinthManifest } from "./game-manifests";
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

// ─────────────────────────────────────────────────────────────
// Persist session + player IDs across page reloads per game,
// so each browser tab can have its own identity.
// ─────────────────────────────────────────────────────────────
const STORAGE_PREFIX = "bgs:";

function loadStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveStored(key: string, value: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch {
    // ignore
  }
}

function generateSessionId(): string {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

function getDefaultSessionForGame(gameId: GameId): string {
  return loadStored(`sessionId:${gameId}`, generateSessionId());
}

function getDefaultPlayerId(): string {
  return loadStored("playerId", "player-1");
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
  let playerId = getDefaultPlayerId();
  const battleshipDefinition = battleshipManifest.definition as { board: { rows: number; cols: number }; ships: ShipSpec[] };
  const shipSpecs = battleshipDefinition.ships;
  // Start with an EMPTY draft map — don't pre-place ships, let the user do it
  let placementDraftMap: Record<string, import("./game-adapters/battleship").PlacementDraft> = {};
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
    const copySessionBtn = root.querySelector<HTMLElement>("#copy-session-btn");

    navBackBtn?.addEventListener("click", () => goHome());
    backHomeBtn?.addEventListener("click", () => goHome());

    copySessionBtn?.addEventListener("click", () => {
      navigator.clipboard.writeText(sessionId).then(() => {
        const originalText = copySessionBtn.innerText;
        copySessionBtn.innerText = "✓ Copied!";
        setTimeout(() => {
          copySessionBtn.innerText = originalText;
        }, 1500);
      });
    });

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
        // When entering a game from the hub, load the stored session for that game
        // (or generate a fresh one if never visited before)
        sessionId = getDefaultSessionForGame(gameId);
        playerId = getDefaultPlayerId();
        navigate(nextRoute);
      }
    });

    const newSessionBtn = root.querySelector<HTMLButtonElement>("#new-session-btn");

    sessionInput?.addEventListener("input", () => {
      sessionId = sessionInput.value;
      // Persist the session ID the user types for this game
      const route = getCurrentRoute();
      if (route.name === "game") {
        saveStored(`sessionId:${route.gameId}`, sessionId);
      }
    });

    newSessionBtn?.addEventListener("click", () => {
      sessionId = generateSessionId();
      if (sessionInput) sessionInput.value = sessionId;
      const route = getCurrentRoute();
      if (route.name === "game") {
        saveStored(`sessionId:${route.gameId}`, sessionId);
      }
    });

    playerInput?.addEventListener("input", () => {
      playerId = playerInput.value;
      saveStored("playerId", playerId);
    });

    joinBtn?.addEventListener("click", () => {
      joined = true;
      joinedGameId = route.name === "game" ? route.gameId : null;
      // Reset placement state when joining a fresh session
      placementDraftMap = {};
      selectedShipId = shipSpecs[0]?.id ?? "";
      localError = null;
      // Pass gameId so server creates session on demand
      runtime.controller.join(sessionId, playerId, joinedGameId ?? undefined);
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
