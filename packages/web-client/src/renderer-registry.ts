import type { BoardType } from "./presentation";

export type GameRenderer = {
  render(view: unknown): string;
};

export type RendererFactory = () => GameRenderer;

export class RendererRegistry {
  private readonly factories = new Map<BoardType, RendererFactory>();

  register(boardType: BoardType, factory: RendererFactory): void {
    this.factories.set(boardType, factory);
  }

  create(boardType: BoardType): GameRenderer {
    const factory = this.factories.get(boardType);
    if (!factory) {
      throw new Error(`renderer_not_registered:${boardType}`);
    }
    return factory();
  }
}
