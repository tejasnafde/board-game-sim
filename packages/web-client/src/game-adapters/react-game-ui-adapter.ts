import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { WebClientRuntime } from "../runtime";
import type {
  PlayableGameBindContext,
  PlayableGameRenderContext,
  PlayableGameUiAdapter
} from "./playable-game-ui";

export type ReactGameUiAdapterOptions = {
  gameId: string;
  runtime: WebClientRuntime;
  renderStaticScreen(context: PlayableGameRenderContext): string | null;
  renderGameView(context: PlayableGameBindContext): ReactNode;
};

export function createReactGameUiAdapter(options: ReactGameUiAdapterOptions): PlayableGameUiAdapter {
  let root: Root | null = null;
  const hostId = `react-${options.gameId}-root`;
  const unmountView = (): void => {
    root?.unmount();
    root = null;
  };

  return {
    gameId: options.gameId,
    runtime: options.runtime,
    render(context) {
      return options.renderStaticScreen(context) ?? `<div id="${hostId}"></div>`;
    },
    bind(context) {
      const host = context.root.querySelector<HTMLElement>(`#${hostId}`);
      if (!host) return;
      root = createRoot(host);
      root.render(options.renderGameView(context));
    },
    resetSession: unmountView,
    hasMountedView: () => root !== null,
    unmountView
  };
}
