import { RealtimeClient, type SocketLike } from "./realtime-client";
import type { WebClientRuntime } from "./runtime";
import { renderAppShell, renderComingSoon, renderHubLanding } from "./app-shell";
import { createPlayableGameUiAdapters, type PlayableGameUiAdapter } from "./game-adapters";
import { GAME_HUB_CARDS, resolveGameHubNavigation } from "./game-hub";
import { nextSessionId } from "./templates/lobby";
import { navigate, parseHashRoute, toHashRoute, type AppRoute, type GameId } from "./routes";
import { gamingAnalytics } from "./analytics";
import { gameCatalog } from "./registered-games";

export { GAME_HUB_CARDS, resolveGameHubNavigation };

function titleFromId(id: string): string {
  return id.split("-").map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" ");
}

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

  const gameUiAdapters = createPlayableGameUiAdapters({
    transport,
    baseAssetPath: options.assetBasePath ?? "/",
    assetPackByGame: Object.fromEntries(gameCatalog.listPlayable().map((entry) => [
      entry.manifest.gameId,
      loadStored(`assetPack:${entry.manifest.gameId}`, entry.manifest.defaultAssetPackId)
    ]))
  });

  let joined = false;
  let joinedGameId: GameId | null = null;
  let sessionId = getDefaultSessionForGame("battleship");
  let playerId = getDefaultPlayerId();
  const logs: string[] = [];

  const pushLog = (entry: string): void => {
    logs.unshift(`${new Date().toLocaleTimeString()} ${entry}`);
    if (logs.length > 50) {
      logs.pop();
    }
    console.info(`[web-client] ${entry}`);
  };

  const getCurrentRoute = (): AppRoute => parseHashRoute(window.location.hash);
  const getAdapterForRoute = (route: AppRoute): PlayableGameUiAdapter => {
    const gameId = route.name === "game" ? route.gameId : "battleship";
    const adapter = gameUiAdapters.get(gameId) ?? gameUiAdapters.get("battleship");
    if (!adapter) {
      throw new Error("default_game_adapter_not_found:battleship");
    }
    return adapter;
  };
  const goHome = (): void => {
    if (joined && sessionId && playerId) {
      realtimeClient.send({ type: "session.leave", sessionId, playerId });
    }
    getAdapterForRoute(getCurrentRoute()).resetSession();
    joined = false;
    joinedGameId = null;
    navigate({ name: "landing" });
  };

  realtimeClient.onLog((entry) => pushLog(entry));

  const render = (): void => {
    const route = getCurrentRoute();
    const adapter = getAdapterForRoute(route);
    const runtime = adapter.runtime;
    const state = runtime.controller.getState();
    const catalogEntry = route.name === "game" ? gameCatalog.resolve(route.gameId) : undefined;
    const appearance = catalogEntry?.client?.assetPacks && runtime.assets
      ? {
          selected: runtime.assets.packId,
          packs: catalogEntry.client.assetPacks.list().map((pack) => ({
            id: pack.packId,
            label: titleFromId(pack.packId)
          })),
          credit: runtime.assets.credits()[0]
        }
      : undefined;

    for (const [name, value] of Object.entries(runtime.assets?.themeVariables() ?? {})) {
      root.style.setProperty(name, value);
    }

    let mainContent = "";

    if (route.name === "landing") {
      mainContent = renderHubLanding();
    } else if (route.name === "game" && gameCatalog.resolve(route.gameId)?.manifest.status !== "live") {
      mainContent = renderComingSoon(route.gameId);
    } else {
      // Only server evidence moves us off the lobby: a state_sync for the
      // session we asked for. The local `joined` flag alone is just intent.
      const confirmed = joined && state.synced && state.sessionId === sessionId;
      mainContent = adapter.render({
        confirmed: confirmed && joinedGameId === route.gameId,
        sessionId,
        playerId,
        logs
      });
    }

    root.innerHTML = renderAppShell(mainContent, route, sessionId, playerId, appearance);

    const gameHubGrid = root.querySelector<HTMLElement>("#game-hub-grid");
    const sessionInput = root.querySelector<HTMLInputElement>("#session-id");
    const playerInput = root.querySelector<HTMLInputElement>("#player-id");
    const joinBtn = root.querySelector<HTMLButtonElement>("#join-btn");
    const navBackBtn = root.querySelector<HTMLButtonElement>("#nav-back-btn");
    const backHomeBtn = root.querySelector<HTMLButtonElement>("#back-home-btn");
    const copySessionBtn = root.querySelector<HTMLElement>("#copy-session-btn");
    const assetPackSelect = root.querySelector<HTMLSelectElement>("#asset-pack-select");

    assetPackSelect?.addEventListener("change", () => {
      if (route.name !== "game") return;
      saveStored(`assetPack:${route.gameId}`, assetPackSelect.value);
      window.location.reload();
    });

    navBackBtn?.addEventListener("click", () => goHome());
    backHomeBtn?.addEventListener("click", () => goHome());

    copySessionBtn?.addEventListener("click", () => {
      navigator.clipboard.writeText(sessionId).then(() => {
        const originalText = copySessionBtn.innerText;
        copySessionBtn.innerText = "Copied";
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
        gamingAnalytics.gameSelected(gameId);
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

    const startSession = (id: string, options: { create: boolean; seatCount?: number; bots?: number }): void => {
      sessionId = id;
      if (route.name === "game") {
        saveStored(`sessionId:${route.gameId}`, sessionId);
      }
      joined = true;
      joinedGameId = route.name === "game" ? route.gameId : null;
      adapter.resetSession();
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
      const gameMode = root.querySelector<HTMLInputElement>('input[name="game-mode"]:checked')?.value;
      const seatCount = seatCountSelect ? Number(seatCountSelect.value) || 2 : undefined;
      startSession(generateSessionId(), {
        create: true,
        seatCount,
        bots: gameMode === "bot" ? (seatCount ?? 2) - 1 : undefined
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

    if (route.name === "game" && gameCatalog.resolvePlayable(route.gameId)) {
      adapter.bind({ root, playerId, render, pushLog });
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
      const routeState = getAdapterForRoute(getCurrentRoute()).runtime.controller.getState();
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
    runtime: getAdapterForRoute({ name: "game", gameId: "battleship" }).runtime,
    dispose: () => {
      disposeTransportSubscription();
      window.removeEventListener("hashchange", onHashChange);
      realtimeClient.disconnect();
      root.innerHTML = "";
    }
  };
}
