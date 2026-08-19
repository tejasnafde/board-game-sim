import type { GameId } from "./routes";

type GameVariant = Exclude<GameId, "catan">;

type AnalyticsOptions = {
  environment: "production" | "development" | "test";
  sendBeacon?: (url: string, body: string) => boolean;
  sendFetch?: (url: string, body: string) => void;
};

const endpoint = "https://analytics.tn07.dev/v1/events";

function browserBeacon(url: string, body: string): boolean {
  return navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
}

function browserFetch(url: string, body: string): void {
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit"
  }).catch(() => {});
}

export function createAnalytics({
  environment,
  sendBeacon = browserBeacon,
  sendFetch = browserFetch
}: AnalyticsOptions) {
  return {
    gameSelected(variant: GameVariant): boolean {
      if (environment !== "production") return false;
      const body = JSON.stringify({
        event: "game_selected",
        event_version: 1,
        product: "gaming",
        surface: "game_hub",
        environment,
        authority: "client",
        platform: "web",
        properties: { variant }
      });
      if (!sendBeacon(endpoint, body)) sendFetch(endpoint, body);
      return true;
    }
  };
}

export const gamingAnalytics = createAnalytics({
  environment: typeof location !== "undefined" && location.hostname === "gaming.tn07.dev"
    ? "production"
    : "development"
});
