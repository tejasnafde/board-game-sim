import { describe, expect, test } from "vitest";
import { resolveGameHubNavigation } from "../../packages/web-client/src/browser-app";

describe("labyrinth adapter", () => {
  test("labyrinth is navigable from game hub", () => {
    expect(resolveGameHubNavigation("labyrinth")).toEqual({ name: "game", gameId: "labyrinth" });
  });
});
