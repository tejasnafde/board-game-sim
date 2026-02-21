import { describe, expect, test } from "vitest";
import { navigate, parseHashRoute, toHashRoute, type AppRoute } from "../../packages/web-client/src/routes";

describe("hash routes", () => {
  test("parses known routes and falls back to landing", () => {
    expect(parseHashRoute("#/" )).toEqual({ name: "landing" });
    expect(parseHashRoute("#/games/battleship")).toEqual({ name: "game", gameId: "battleship" });
    expect(parseHashRoute("#/games/labyrinth")).toEqual({ name: "game", gameId: "labyrinth" });
    expect(parseHashRoute("#/games/catan")).toEqual({ name: "game", gameId: "catan" });
    expect(parseHashRoute("#/unknown")).toEqual({ name: "landing" });
  });

  test("serializes routes to hash values", () => {
    const routes: AppRoute[] = [
      { name: "landing" },
      { name: "game", gameId: "battleship" },
      { name: "game", gameId: "labyrinth" },
      { name: "game", gameId: "catan" }
    ];

    expect(routes.map(toHashRoute)).toEqual([
      "#/",
      "#/games/battleship",
      "#/games/labyrinth",
      "#/games/catan"
    ]);
  });

  test("navigate writes hash on location-like object", () => {
    const locationLike = { hash: "#/" };
    navigate({ name: "game", gameId: "battleship" }, locationLike);
    expect(locationLike.hash).toBe("#/games/battleship");
  });
});
