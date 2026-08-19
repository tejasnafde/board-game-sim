import { readFile } from "node:fs/promises";
import { describe, expect, test, vi } from "vitest";
import { createAnalytics } from "../../packages/web-client/src/analytics";

describe("gaming discovery", () => {
  test("publishes canonical metadata, crawler policy, and agent summary", async () => {
    const [html, robots, llms, sitemap] = await Promise.all([
      readFile("packages/web-client/app/index.html", "utf8"),
      readFile("packages/web-client/app/public/robots.txt", "utf8"),
      readFile("packages/web-client/app/public/llms.txt", "utf8"),
      readFile("packages/web-client/app/public/sitemap.xml", "utf8")
    ]);
    expect(html).toContain('<link rel="canonical" href="https://gaming.tn07.dev/"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(robots).toContain("User-agent: GPTBot\nDisallow: /");
    expect(robots).toContain("Sitemap: https://gaming.tn07.dev/sitemap.xml");
    expect(llms).toContain("# Board Game Simulator");
    expect(sitemap).toContain("<loc>https://gaming.tn07.dev/</loc>");
  });
});

describe("gaming browser analytics", () => {
  test("emits a game selection without browser or player identifiers", () => {
    const sendBeacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    const analytics = createAnalytics({ environment: "production", sendBeacon });
    analytics.gameSelected("connect4");
    const payload = JSON.parse(sendBeacon.mock.calls[0][1]);
    expect(payload).toMatchObject({
      event: "game_selected",
      product: "gaming",
      surface: "game_hub",
      properties: { variant: "connect4" }
    });
    expect(JSON.stringify(payload)).not.toMatch(/session|player|user|cookie/i);
  });
});
