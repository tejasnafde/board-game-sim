export * from "./asset-manager";
export * from "./browser-app";
export * from "./client-controller";
export * from "./grid-renderer";
export * from "./presentation";
export * from "./realtime-client";
export * from "./realtime-state";
export * from "./renderer-registry";
export * from "./runtime";

import type { SocketLike } from "./realtime-client";
import { mountPlayableClient } from "./browser-app";

export function initPlayableWebClient(root: HTMLElement, websocketFactory: () => SocketLike) {
  return mountPlayableClient(root, {
    websocketFactory
  });
}
