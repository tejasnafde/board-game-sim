import { initPlayableWebClient } from "./index";
import type { SocketLike } from "./realtime-client";

export function resolveWebsocketUrl(
  env: Record<string, string | undefined>,
  locationHref: string
): string {
  if (env.VITE_WS_URL) {
    return env.VITE_WS_URL;
  }

  const location = new URL(locationHref);
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/realtime`;
}

export function mountFromBrowser(root: HTMLElement, env: Record<string, string | undefined>) {
  const wsUrl = resolveWebsocketUrl(env, window.location.href);
  return initPlayableWebClient(root, () => {
    const socket = new WebSocket(wsUrl);
    return socket as unknown as SocketLike;
  });
}
