export * from "./asset-manager";
export * from "./battleship-template";
export * from "./browser-app";
export * from "./client-controller";
export * from "./grid-renderer";
export * from "./presentation";
export * from "./realtime-client";
export * from "./realtime-state";
export * from "./renderer-registry";
export * from "./components/hex-board";
export * from "./components/card-zone";
export * from "./routes";
export * from "./runtime";

import type { SocketLike } from "./realtime-client";
import { mountReactBrowserApp } from "./react-app";

export function initPlayableWebClient(root: HTMLElement, websocketFactory: () => SocketLike) {
  return mountReactBrowserApp(root, websocketFactory);
}
