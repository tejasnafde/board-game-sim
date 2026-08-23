import { describe, expect, test } from "vitest";
import { gameCatalog } from "../../packages/web-client/src/registered-games";
import { getManifest } from "../../packages/web-client/src/game-manifests";
import type { ClientEvent, ServerEvent } from "../../packages/web-client/src/realtime-client";

const transport = {
  send(_event: ClientEvent) {},
  subscribe(_listener: (event: ServerEvent) => void) {
    return () => {};
  }
};

describe("Hex Kingdoms client adapter", () => {
  test("is a playable React-owned catalog entry with a hex manifest", () => {
    const entry = gameCatalog.resolvePlayable("hex-kingdoms");
    const adapter = entry?.client?.createUiAdapter({ transport, baseAssetPath: "/" });

    expect(entry?.manifest.status).toBe("live");
    expect(getManifest("hex-kingdoms")?.presentation).toMatchObject({
      board: { boardType: "hex", radius: 4 }
    });
    expect(adapter?.runtime.renderer).toBeNull();
    expect(adapter?.render({
      confirmed: false,
      sessionId: "hex-lobby",
      playerId: "tejas",
      logs: []
    })).toContain("Hex Kingdoms");
  });
});
