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

describe("Signal Crew client adapter", () => {
  test("is a playable React-owned catalog entry with no generic board renderer", () => {
    const entry = gameCatalog.resolvePlayable("signal-crew");
    const adapter = entry?.client?.createUiAdapter({ transport, baseAssetPath: "/" });

    expect(entry?.manifest.status).toBe("live");
    expect(getManifest("signal-crew")?.presentation).toMatchObject({
      board: { boardType: "none" }
    });
    expect(adapter?.runtime.renderer).toBeNull();
    expect(adapter?.render({
      confirmed: false,
      sessionId: "signal-lobby",
      playerId: "tejas",
      logs: []
    })).toContain("Signal Crew");
  });
});
