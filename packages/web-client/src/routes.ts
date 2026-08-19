export type GameId = string;

export type AppRoute = { name: "landing" } | { name: "game"; gameId: GameId };

type LocationLike = {
  hash: string;
};

export function parseHashRoute(hash: string): AppRoute {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = normalized || "/";

  if (path === "/") {
    return { name: "landing" };
  }

  const match = path.match(/^\/games\/([a-z0-9-]+)$/);
  if (match) {
    return { name: "game", gameId: match[1] };
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
