export type GameId = "battleship" | "labyrinth" | "catan";

export type AppRoute = { name: "landing" } | { name: "game"; gameId: GameId };

type LocationLike = {
  hash: string;
};

const gameRouteByPath: Record<string, GameId> = {
  "/games/battleship": "battleship",
  "/games/labyrinth": "labyrinth",
  "/games/catan": "catan"
};

export function parseHashRoute(hash: string): AppRoute {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = normalized || "/";

  if (path === "/") {
    return { name: "landing" };
  }

  const gameId = gameRouteByPath[path];
  if (gameId) {
    return { name: "game", gameId };
  }

  return { name: "landing" };
}

export function toHashRoute(route: AppRoute): string {
  if (route.name === "landing") {
    return "#/";
  }

  return `#/games/${route.gameId}`;
}

export function navigate(route: AppRoute, locationLike: LocationLike = window.location): void {
  locationLike.hash = toHashRoute(route);
}
