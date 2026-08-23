import { describe, expect, test } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { RealtimeGateway, SessionService, registerBuiltInGames } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

const miniDefinition = {
  ...definition,
  ships: [{ id: "destroyer", size: 2 }]
};

function build(
  analytics?: { track(event: string, surface: string, properties: Record<string, string>): void },
  seedFactory?: (input: { sessionId: string; gameId: string }) => string
) {
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

  return { service, gateway: new RealtimeGateway(service, 0, analytics, undefined, seedFactory) };
}

function buildRegistered() {
  const registry = new InMemoryGameRegistry();
  registerBuiltInGames(registry);
  const service = new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );
  return { service, gateway: new RealtimeGateway(service) };
}

describe("realtime gateway", () => {
  test("uses an injected private seed and never sends it to clients", async () => {
    const calls: Array<{ sessionId: string; gameId: string }> = [];
    const privateSeed = "server-only-test-seed";
    const { service, gateway } = build(undefined, (input) => {
      calls.push(input);
      return privateSeed;
    });

    const outbound = await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "public-session-code",
      gameId: "battleship",
      playerId: "p1",
      bots: 1
    });

    expect(calls).toEqual([{ sessionId: "public-session-code", gameId: "battleship" }]);
    expect(service.getSessionMeta("public-session-code")?.seed).toBe(privateSeed);
    expect(JSON.stringify(outbound)).not.toContain(privateSeed);
    expect(JSON.stringify(outbound)).not.toContain("public-session-code-seed");
  });

  test("reports authoritative session and first-action milestones", async () => {
    const calls: unknown[][] = [];
    const { service, gateway } = build({ track: (...args) => calls.push(args) });
    await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "gw-analytics",
      gameId: "battleship",
      playerId: "p1",
      bots: 1
    });
    await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "gw-analytics",
        expectedSeq: service.getSessionSeq("gw-analytics"),
        actorPlayerId: "p1",
        actionType: "place_ships",
        payload: { placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }] },
        clientActionId: "analytics-1"
      }
    });
    expect(calls).toEqual([
      ["session_created", "lobby", { variant: "battleship" }],
      ["gameplay_started", "gameplay", { variant: "battleship" }]
    ]);
  });

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

  test("returns accepted events without exposing a canonical state hash", async () => {
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

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "session.action_accepted",
      actorPlayerId: "p1"
    });
    expect(JSON.stringify(events)).not.toContain("integrityHash");
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

describe("seat auto-claim", () => {
  test("names claim distinct seats, reconnect keeps seat, full session rejects", async () => {
    const { gateway } = build();
    await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "gw-seats",
      gameId: "battleship",
      playerId: "tejas"
    });

    const [tejasSync] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-seats",
      playerId: "tejas"
    });
    const [akshayaSync] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-seats",
      playerId: "akshaya"
    });

    expect(tejasSync).toMatchObject({ type: "session.state_sync", youAre: "player-1" });
    expect(akshayaSync).toMatchObject({
      type: "session.state_sync",
      youAre: "player-2",
      seats: { "player-1": "tejas", "player-2": "akshaya" }
    });

    const [rejoin] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-seats",
      playerId: "tejas"
    });
    expect(rejoin).toMatchObject({ youAre: "player-1" });

    const [full] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-seats",
      playerId: "intruder"
    });
    expect(full).toMatchObject({ type: "session.action_rejected", reason: "session_full" });
  });

  test("actions submitted under a claimed name act as the mapped seat", async () => {
    const { service, gateway } = build();
    await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "gw-act",
      gameId: "battleship",
      playerId: "tejas"
    });
    await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "gw-act",
      playerId: "akshaya"
    });

    const outbound = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "gw-act",
        expectedSeq: service.getSessionSeq("gw-act"),
        actorPlayerId: "tejas",
        actionType: "place_ships",
        payload: { placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }] },
        clientActionId: "a1"
      }
    });

    expect(outbound[0]).toMatchObject({ type: "session.action_accepted" });
  });
});

describe("mixed table seats", () => {
  test("rejects plans outside the selected game's player limits", async () => {
    const { gateway } = buildRegistered();
    const result = await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "invalid-battleship-table",
      gameId: "battleship",
      playerId: "tejas",
      tablePlan: { humanSeats: 2, botSeats: 1 }
    });

    expect(result).toEqual([{
      type: "session.action_rejected",
      sessionId: "invalid-battleship-table",
      reason: "invalid_table_plan"
    }]);
  });

  test("reserves human seats separately from the final bot seat", async () => {
    const { gateway } = buildRegistered();
    const created = await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "mixed-labyrinth",
      gameId: "labyrinth",
      playerId: "tejas",
      tablePlan: { humanSeats: 2, botSeats: 1 }
    });

    expect(created[1]).toMatchObject({
      type: "session.state_sync",
      youAre: "player-1",
      seats: { "player-1": "tejas", "player-3": "Computer" },
      table: { humanSeats: 2, botSeats: 1, claimedHumanSeats: 1, ready: false }
    });

    const [friend] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "mixed-labyrinth",
      playerId: "friend"
    });
    expect(friend).toMatchObject({
      type: "session.state_sync",
      youAre: "player-2",
      seats: { "player-1": "tejas", "player-2": "friend", "player-3": "Computer" },
      table: { claimedHumanSeats: 2, ready: true }
    });

    const [full] = await gateway.handleClientEvent({
      type: "session.join",
      sessionId: "mixed-labyrinth",
      playerId: "intruder"
    });
    expect(full).toMatchObject({ type: "session.action_rejected", reason: "session_full" });
  });

  test("rejects gameplay until every reserved human seat is claimed", async () => {
    const { service, gateway } = buildRegistered();
    await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "waiting-labyrinth",
      gameId: "labyrinth",
      playerId: "tejas",
      tablePlan: { humanSeats: 2, botSeats: 1 }
    });

    const blocked = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "waiting-labyrinth",
        expectedSeq: 0,
        actorPlayerId: "tejas",
        actionType: "rotate_spare",
        payload: { rotationDeg: 90 },
        clientActionId: "waiting-1"
      }
    });
    expect(blocked).toEqual([{
      type: "session.action_rejected",
      sessionId: "waiting-labyrinth",
      reason: "table_not_ready"
    }]);
    expect(service.getSessionSeq("waiting-labyrinth")).toBe(0);

    await gateway.handleClientEvent({ type: "session.join", sessionId: "waiting-labyrinth", playerId: "friend" });
    const accepted = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId: "waiting-labyrinth",
        expectedSeq: 0,
        actorPlayerId: "tejas",
        actionType: "rotate_spare",
        payload: { rotationDeg: 90 },
        clientActionId: "waiting-2"
      }
    });
    expect(accepted[0]).toMatchObject({ type: "session.action_accepted", actorPlayerId: "player-1" });
  });
});

describe("vs-computer seats", () => {
  test("human plays a full connect4 game against the server bot", async () => {
    const registry = new InMemoryGameRegistry();
    registerBuiltInGames(registry);
    const service = new SessionService(
      registry,
      new InMemoryEventRepository(),
      new InMemorySessionRepository(),
      new InMemorySnapshotRepository()
    );
    const analyticsEvents: string[] = [];
    const gateway = new RealtimeGateway(service, 0, {
      track(event) { analyticsEvents.push(event); }
    });

    const botActors: string[] = [];
    gateway.onSessionChanged = (_sessionId, action) => {
      botActors.push(action.actorPlayerId);
    };
    const created = await gateway.handleClientEvent({
      type: "session.create",
      sessionId: "gw-bot",
      gameId: "connect4",
      playerId: "tejas",
      bots: 1
    });
    expect(created[0]).toMatchObject({ type: "session.created" });
    const sync = created[1] as { seats: Record<string, string> };
    expect(Object.values(sync.seats)).toContain("Computer");

    // Human drops col 0 repeatedly; the bot answers each move. The game must
    // reach a terminal state without the human ever waiting on a stuck turn.
    for (let i = 0; i < 21 && !service.getTerminalResult("gw-bot"); i += 1) {
      const view = service.getPlayerView("gw-bot", "tejas") as {
        currentPlayerId: string;
        grid: (string | null)[][];
      };
      expect(view.currentPlayerId).toBe("player-1"); // bot never leaves it hanging
      const col = view.grid[0].findIndex((cell) => cell === null);
      const outbound = await gateway.handleClientEvent({
        type: "action.submit",
        envelope: {
          sessionId: "gw-bot",
          expectedSeq: service.getSessionSeq("gw-bot"),
          actorPlayerId: "tejas",
          actionType: "drop",
          payload: { col },
          clientActionId: `h${i}`
        }
      });
      expect(outbound[0]).toMatchObject({ type: "session.action_accepted" });
    }

    expect(service.getTerminalResult("gw-bot")).not.toBeNull();
    expect(analyticsEvents).toContain("session_created");
    expect(analyticsEvents).toContain("gameplay_started");
    expect(analyticsEvents).toContain("game_completed");
    expect(botActors).toContain("player-2");
  });
});
