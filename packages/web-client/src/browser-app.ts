import { RealtimeClient, type SocketLike } from "./realtime-client";
import { createWebClientRuntime, type WebClientRuntime } from "./runtime";
import { battleshipManifest, connect4Manifest, getManifest, labyrinthManifest } from "./game-manifests";
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
import {
  bindConnect4Events,
  inferConnect4Screen,
  renderConnect4Gameplay,
  renderConnect4Lobby,
  type Connect4View
} from "./game-adapters/connect4";
import { GAME_HUB_CARDS, resolveGameHubNavigation } from "./game-hub";
import { nextSessionId } from "./templates/lobby";
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
    }),
    connect4: createWebClientRuntime({
      presentation: connect4Manifest.presentation,
      baseAssetPath: options.assetBasePath ?? "/",
      transport
    })
  } satisfies Record<"battleship" | "labyrinth" | "connect4", WebClientRuntime>;

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
  let labSeatCount = 2;
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
    if (joined && sessionId && playerId) {
      realtimeClient.send({ type: "session.leave", sessionId, playerId });
    }
    joined = false;
    joinedGameId = null;
    navigate({ name: "landing" });
  };
  const getRuntimeForRoute = (route: AppRoute): WebClientRuntime => {
    if (route.name === "game" && route.gameId === "labyrinth") {
      return runtimeByGame.labyrinth;
    }
    if (route.name === "game" && route.gameId === "connect4") {
      return runtimeByGame.connect4;
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
      // Only server evidence moves us off the lobby: a state_sync for the
      // session we asked for. The local `joined` flag alone is just intent.
      const confirmed = joined && state.synced && state.sessionId === sessionId;
      const mySeat = state.seatId ?? playerId;

      const gameUiAdapters = {
        battleship: () => {
          const battleshipScreen = inferBattleshipScreen(confirmed && joinedGameId === "battleship", view);
          const canFire = phase === "play" && view.currentPlayerId === mySeat;
          if (battleshipScreen === "lobby") return renderBattleshipLobby(sessionId, playerId, state.lastError);
          if (battleshipScreen === "setup")
            return renderBattleshipSetup(
              battleshipDefinition,
              (view.ownBoard?.ships?.length ?? 0) > 0,
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
            JSON.stringify(state, null, 2),
            { seatNames: state.seatNames, lastError: state.lastError, lastEvents: state.lastEvents }
          );
        },
        labyrinth: () => {
          const labyrinthView = (state.view ?? {}) as LabyrinthView;
          const labyrinthScreen = inferLabyrinthScreen(confirmed && joinedGameId === "labyrinth");
          if (labyrinthScreen === "lobby") return renderLabyrinthLobby(sessionId, playerId, state.lastError, labSeatCount);
          return renderLabyrinthGameplay(labyrinthView, mySeat, logs, JSON.stringify(state, null, 2), {
            seatNames: state.seatNames,
            lastError: state.lastError
          });
        },
        connect4: () => {
          const connect4View = (state.view ?? {}) as Connect4View;
          const connect4Screen = inferConnect4Screen(confirmed && joinedGameId === "connect4");
          if (connect4Screen === "lobby") return renderConnect4Lobby(sessionId, playerId, state.lastError);
          return renderConnect4Gameplay(connect4View, mySeat, {
            seatNames: state.seatNames,
            lastError: state.lastError
          });
        }
      } as const;

      if (route.gameId === "battleship") {
        mainContent = gameUiAdapters.battleship();
      } else if (route.gameId === "labyrinth") {
        mainContent = gameUiAdapters.labyrinth();
      } else if (route.gameId === "connect4") {
        mainContent = gameUiAdapters.connect4();
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

    const seatCountSelect = root.querySelector<HTMLSelectElement>("#seat-count");
    seatCountSelect?.addEventListener("change", () => {
      labSeatCount = Number(seatCountSelect.value) || 2;
    });

    const startSession = (id: string, options: { create: boolean; seatCount?: number; bots?: number }): void => {
      sessionId = id;
      if (route.name === "game") {
        saveStored(`sessionId:${route.gameId}`, sessionId);
      }
      joined = true;
      joinedGameId = route.name === "game" ? route.gameId : null;
      // Reset placement state when joining a fresh session
      placementDraftMap = {};
      selectedShipId = shipSpecs[0]?.id ?? "";
      localError = null;
      if (options.create && joinedGameId) {
        runtime.controller.join(sessionId, playerId, joinedGameId, options.seatCount, options.bots);
      } else {
        // No gameId: a typo'd code errors with session_not_found instead of
        // silently creating a fresh game.
        runtime.controller.join(sessionId, playerId);
      }
      render();
    };

    const createBtn = root.querySelector<HTMLButtonElement>("#create-btn");
    createBtn?.addEventListener("click", () => {
      const vsBot = root.querySelector<HTMLInputElement>("#vs-bot")?.checked ?? false;
      const seatCount = seatCountSelect ? labSeatCount : undefined;
      startSession(generateSessionId(), {
        create: true,
        seatCount,
        // vs computer: every seat except the creator's is played by the server
        bots: vsBot ? (seatCount ?? 2) - 1 : undefined
      });
    });

    joinBtn?.addEventListener("click", () => {
      startSession(sessionId, { create: false });
    });

    const rematchBtn = root.querySelector<HTMLButtonElement>("#rematch-btn");
    rematchBtn?.addEventListener("click", () => {
      // Everyone derives the same next code from the finished session, so all
      // players clicking "Play Again" land in the same fresh game.
      const seats = Object.keys(state.seatNames).length;
      const bots = Object.values(state.seatNames).filter((n) => n.startsWith("Computer")).length;
      startSession(nextSessionId(sessionId), {
        create: true,
        seatCount: seats > 0 ? seats : undefined,
        bots: bots > 0 ? bots : undefined
      });
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

    if (route.name === "game" && route.gameId === "connect4") {
      bindConnect4Events(root, {
        runtime,
        playerId,
        render,
        pushLog
      });
    }
  };

  const disposeTransportSubscription = transport.subscribe(() => {
    // Don't clobber lobby typing: skip re-render while an input/select in the
    // app has focus, unless the broadcast just confirmed our current session
    // (that render transitions off the lobby and matters more than focus).
    const active = document.activeElement;
    if (
      active &&
      root.contains(active) &&
      (active.tagName === "INPUT" || active.tagName === "SELECT")
    ) {
      const routeState = getRuntimeForRoute(getCurrentRoute()).controller.getState();
      if (!(routeState.synced && routeState.sessionId === sessionId)) {
        return;
      }
    }
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
