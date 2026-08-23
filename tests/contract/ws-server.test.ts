import { createServer } from "node:http";
import { describe, expect, test } from "vitest";
import WebSocket from "ws";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { BattleshipModule } from "@board-game-sim/battleship";
import { RealtimeGateway, SessionService, createWsRealtimeServer, registerBuiltInGames, type ServerEvent } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

const miniDefinition = {
  ...definition,
  ships: [{ id: "destroyer", size: 2 }]
};

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("open_timeout")), 2000);
    ws.once("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.once("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function waitForEvent(
  ws: WebSocket,
  predicate: (event: ServerEvent) => boolean
): Promise<ServerEvent> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("event_timeout"));
    }, 2000);

    const onMessage = (chunk: WebSocket.RawData) => {
      const event = JSON.parse(chunk.toString()) as ServerEvent;
      if (!predicate(event)) return;
      clearTimeout(timeout);
      ws.off("message", onMessage);
      resolve(event);
    };

    ws.on("message", onMessage);
  });
}

describe("ws server adapter", () => {
  const socketTestsEnabled = process.env.ALLOW_SOCKET_TESTS === "1";

  test.skipIf(!socketTestsEnabled)("broadcasts table readiness when the final human joins", async () => {
    const registry = new InMemoryGameRegistry();
    registerBuiltInGames(registry);
    const service = new SessionService(
      registry,
      new InMemoryEventRepository(),
      new InMemorySessionRepository(),
      new InMemorySnapshotRepository()
    );
    const gateway = new RealtimeGateway(service);
    const httpServer = createServer();
    const wsServer = createWsRealtimeServer({ server: httpServer, gateway });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("invalid_address");

    const url = `ws://127.0.0.1:${address.port}/realtime`;
    const creator = new WebSocket(url);
    const friend = new WebSocket(url);
    await Promise.all([waitForOpen(creator), waitForOpen(friend)]);

    const initialSync = waitForEvent(creator, (event) => event.type === "session.state_sync");
    creator.send(JSON.stringify({
      type: "session.create",
      sessionId: "ws-mixed",
      gameId: "labyrinth",
      playerId: "tejas",
      tablePlan: { humanSeats: 2, botSeats: 1 }
    }));
    await expect(initialSync).resolves.toMatchObject({
      type: "session.state_sync",
      table: { claimedHumanSeats: 1, ready: false }
    });

    const creatorReady = waitForEvent(creator, (event) => event.type === "session.state_sync" && event.table?.ready === true);
    const friendReady = waitForEvent(friend, (event) => event.type === "session.state_sync" && event.table?.ready === true);
    friend.send(JSON.stringify({ type: "session.join", sessionId: "ws-mixed", playerId: "friend" }));

    await expect(Promise.all([creatorReady, friendReady])).resolves.toMatchObject([
      { type: "session.state_sync", youAre: "player-1", table: { ready: true } },
      { type: "session.state_sync", youAre: "player-2", table: { ready: true } }
    ]);

    creator.close();
    friend.close();
    await wsServer.close();
    await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  });

  test.skipIf(!socketTestsEnabled)("joins and broadcasts accepted action events", async () => {
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

    await service.createSession({
      sessionId: "ws-1",
      gameId: "battleship",
      gameVersion: "0.1.0",
      seed: "seed-1",
      players: ["p1", "p2"]
    });

    const gateway = new RealtimeGateway(service);
    const httpServer = createServer();
    const wsServer = createWsRealtimeServer({ server: httpServer, gateway });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("invalid_address");
    }

    const url = `ws://127.0.0.1:${address.port}/realtime`;
    const c1 = new WebSocket(url);
    const c2 = new WebSocket(url);
    await Promise.all([waitForOpen(c1), waitForOpen(c2)]);

    c1.send(JSON.stringify({ type: "session.join", sessionId: "ws-1", playerId: "p1" }));
    c2.send(JSON.stringify({ type: "session.join", sessionId: "ws-1", playerId: "p2" }));

    await Promise.all([
      waitForEvent(c1, (e) => e.type === "session.state_sync"),
      waitForEvent(c2, (e) => e.type === "session.state_sync")
    ]);

    c1.send(
      JSON.stringify({
        type: "action.submit",
        envelope: {
          sessionId: "ws-1",
          expectedSeq: 0,
          actorPlayerId: "p1",
          actionType: "place_ships",
          payload: {
            placements: [{ shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }]
          },
          clientActionId: "ws-a1"
        }
      })
    );

    const [accepted1, accepted2, sync1, sync2] = await Promise.all([
      waitForEvent(c1, (e) => e.type === "session.action_accepted"),
      waitForEvent(c2, (e) => e.type === "session.action_accepted"),
      waitForEvent(c1, (e) => e.type === "session.state_sync" && e.seq === 1),
      waitForEvent(c2, (e) => e.type === "session.state_sync" && e.seq === 1)
    ]);

    expect(accepted1.type).toBe("session.action_accepted");
    expect(accepted2.type).toBe("session.action_accepted");
    expect(sync1.type).toBe("session.state_sync");
    expect(sync2.type).toBe("session.state_sync");
    expect(JSON.stringify([accepted1, accepted2, sync1, sync2])).not.toContain("integrityHash");

    c1.close();
    c2.close();
    await wsServer.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
});
