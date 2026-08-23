import { afterEach, describe, expect, test, vi } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { getLogLevel, setLogLevel } from "@board-game-sim/shared";
import { RealtimeGateway, SessionService, registerBuiltInGames } from "@board-game-sim/server";

const originalLogLevel = getLogLevel();

afterEach(() => {
  setLogLevel(originalLogLevel);
  vi.restoreAllMocks();
});

describe("hidden-information transport", () => {
  test("does not log or transmit a private session seed", async () => {
    const output: string[] = [];
    setLogLevel("info");
    vi.spyOn(console, "log").mockImplementation((...args) => output.push(args.join(" ")));

    const registry = new InMemoryGameRegistry();
    registerBuiltInGames(registry);
    const service = new SessionService(
      registry,
      new InMemoryEventRepository(),
      new InMemorySessionRepository(),
      new InMemorySnapshotRepository()
    );
    const privateSeed = "private-sentinel-seed";
    const gateway = new RealtimeGateway(
      service,
      0,
      undefined,
      undefined,
      () => privateSeed
    );

    const outbound = await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "public-code",
      gameId: "connect4",
      playerId: "human",
      bots: 1
    });

    expect(output.join("\n")).not.toContain(privateSeed);
    expect(JSON.stringify(outbound)).not.toContain(privateSeed);
    expect(JSON.stringify(outbound)).not.toContain("integrityHash");
  });
});
