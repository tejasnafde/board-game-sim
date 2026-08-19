export type GamingAnalytics = {
  track(event: string, surface: string, properties: Record<string, string>): void;
};

export const noAnalytics: GamingAnalytics = { track() {} };

export function createGamingAnalytics(environment: "production" | "development"): GamingAnalytics {
  return {
    track(event, surface, properties) {
      if (environment !== "production") return;
      void fetch("https://analytics.tn07.dev/v1/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://gaming.tn07.dev"
        },
        body: JSON.stringify({
          event,
          event_version: 1,
          product: "gaming",
          surface,
          environment,
          authority: "server",
          platform: "server",
          properties
        })
      }).catch(() => {});
    }
  };
}
