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
import { RealtimeGateway, SessionService, createWsRealtimeServer, type ServerEvent } from "@board-game-sim/server";
import definition from "../../packages/games/battleship/definition.json";

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

  test.skipIf(!socketTestsEnabled)("joins and broadcasts accepted action events", async () => {
    const registry = new InMemoryGameRegistry();
    registry.register({
      gameId: "battleship",
      version: "0.1.0",
      definition,
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

    const [accepted1, accepted2, patch1, patch2] = await Promise.all([
      waitForEvent(c1, (e) => e.type === "session.action_accepted"),
      waitForEvent(c2, (e) => e.type === "session.action_accepted"),
      waitForEvent(c1, (e) => e.type === "session.state_patch"),
      waitForEvent(c2, (e) => e.type === "session.state_patch")
    ]);

    expect(accepted1.type).toBe("session.action_accepted");
    expect(accepted2.type).toBe("session.action_accepted");
    expect(patch1.type).toBe("session.state_patch");
    expect(patch2.type).toBe("session.state_patch");

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
