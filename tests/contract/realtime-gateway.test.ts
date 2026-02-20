import { describe, expect, test } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { RealtimeGateway, SessionService } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

const miniDefinition = {
  ...definition,
  ships: [{ id: "destroyer", size: 2 }]
};

function build() {
  const registry = new InMemoryGameRegistry();
  registry.register({
    gameId: "battleship",
    version: "0.1.0",
    definition: miniDefinition,
    module: new BattleshipModule()
  });

  const service = new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );

  return { service, gateway: new RealtimeGateway(service) };
}

describe("realtime gateway", () => {
  test("returns state sync on join", async () => {
    const { service, gateway } = build();
    await service.createSession({
      sessionId: "gw-1",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const events = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-1",
      playerId: "p1"
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("session.state_sync");
    if (events[0]?.type === "session.state_sync") {
      expect(events[0].seq).toBe(0);
    }
  });

  test("returns rejection for illegal action", async () => {
    const { service, gateway } = build();
    await service.createSession({
      sessionId: "gw-2",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const events = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "gw-2",
        expectedSeq: 0,
        actorPlayerId: "p1",
        actionType: "fire",
        payload: { row: 0, col: 0 },
        clientActionId: "g1"
      }
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "session.action_rejected",
      sessionId: "gw-2",
      reason: "illegal_action"
    });
  });

  test("returns accepted and patch on valid action", async () => {
    const { service, gateway } = build();
    await service.createSession({
      sessionId: "gw-3",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const events = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "gw-3",
        expectedSeq: 0,
        actorPlayerId: "p1",
        actionType: "place_ships",
        payload: {
          placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
        },
        clientActionId: "g2"
      }
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.type).toBe("session.action_accepted");
    expect(events[1]?.type).toBe("session.state_patch");
  });

  test("builds player-specific state sync event", async () => {
    const { service, gateway } = build();
    await service.createSession({
      sessionId: "gw-4",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const sync = await gateway.createStateSyncEvent("gw-4", "p1");
    expect(sync.type).toBe("session.state_sync");
    if (sync.type === "session.state_sync") {
      expect(sync.sessionId).toBe("gw-4");
      expect(sync.seq).toBe(0);
    }
  });
});
