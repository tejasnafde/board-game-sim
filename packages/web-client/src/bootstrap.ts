import { setLogLevel, type LogLevel } from "@board-game-sim/shared";
import { initPlayableWebClient } from "./index";
import type { SocketLike } from "./realtime-client";

const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"];

/** ?log=debug wins (and persists); else localStorage bgs:log; else default. */
export function resolveLogLevel(search: string, stored: string | null): LogLevel | null {
  const fromUrl = new URLSearchParams(search).get("log");
  const level = fromUrl ?? stored;
  return level && LOG_LEVELS.includes(level) ? (level as LogLevel) : null;
}

// Cloud Run URL is stable per service+project+region. Baking it as the
// production fallback means a bundle built without VITE_WS_URL (the incident:
// a stale local dist manually deployed over CI's build) still connects
// instead of dialing the static host and bricking every game.
const PROD_WS_URL = "wss://board-game-sim-ezvux7gqxa-el.a.run.app/realtime";

export function resolveWebsocketUrl(
  env: Record<string, string | undefined>,
  locationHref: string
): string {
  if (env.VITE_WS_URL) {
    return env.VITE_WS_URL;
  }

  const location = new URL(locationHref);
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return PROD_WS_URL;
  }
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/realtime`;
}

export function mountFromBrowser(root: HTMLElement, env: Record<string, string | undefined>) {
  let stored: string | null = null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("log");
    if (fromUrl) localStorage.setItem("bgs:log", fromUrl);
    stored = localStorage.getItem("bgs:log");
  } catch {
    // storage unavailable (private mode) - default level stands
  }
  const level = resolveLogLevel(window.location.search, stored);
  if (level) setLogLevel(level);

  const wsUrl = resolveWebsocketUrl(env, window.location.href);
  return initPlayableWebClient(root, () => {
    const socket = new WebSocket(wsUrl);
    return socket as unknown as SocketLike;
  });
}
