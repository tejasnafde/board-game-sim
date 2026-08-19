import type { GameId } from "../routes";
import type { WebClientRuntime } from "../runtime";

export type PlayableGameRenderContext = {
  confirmed: boolean;
  sessionId: string;
  playerId: string;
  logs: string[];
};

export type PlayableGameBindContext = {
  root: HTMLElement;
  playerId: string;
  render: () => void;
  pushLog: (entry: string) => void;
};

export type PlayableGameUiAdapter = {
  gameId: GameId;
  runtime: WebClientRuntime;
  render(context: PlayableGameRenderContext): string;
  bind(context: PlayableGameBindContext): void;
  resetSession(): void;
};
