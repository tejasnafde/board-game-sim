import { createServer } from "node:http";
import { InMemoryEventRepository, InMemoryGameRegistry, InMemorySessionRepository, InMemorySnapshotRepository } from "@board-game-sim/engine";
import { RealtimeGateway } from "./realtime-gateway";
import { SessionService } from "./session-service";
import { createWsRealtimeServer } from "./ws-server";
import { registerBuiltInGames } from "./game-registration";

export type StartServerOptions = {
  port?: number;
  host?: string;
  demoSessionId?: string;
  labyrinthDemoSessionId?: string | null;
};

export async function startServer(options: StartServerOptions = {}): Promise<{
  close: () => Promise<void>;
}> {
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? 8080;
  const demoSessionId = options.demoSessionId ?? "demo-battleship";
  const labyrinthDemoSessionId = options.labyrinthDemoSessionId ?? null;

  const registry = new InMemoryGameRegistry();
  registerBuiltInGames(registry);

  const service = new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );

  await service.createSession({
    sessionId: demoSessionId,
    gameId: "battleship",
    gameVersion: "0.1.0",
    seed: "demo-seed",
    players: ["player-1", "player-2"]
  });

  if (labyrinthDemoSessionId) {
    await service.createSession({
      sessionId: labyrinthDemoSessionId,
      gameId: "labyrinth",
      gameVersion: "0.1.0",
      seed: "labyrinth-demo-seed",
      players: ["player-1", "player-2", "player-3", "player-4"]
    });
  }

  // Paced bot replies (ms between moves) so games feel turn-based, not instant.
  const botMoveDelayMs = Number(process.env.BOT_MOVE_DELAY_MS ?? "1500");
  const gateway = new RealtimeGateway(service, botMoveDelayMs);
  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.statusCode = 200;
      res.end("ok");
      return;
    }

    res.statusCode = 404;
    res.end("not_found");
  });

  const wsServer = createWsRealtimeServer({ server: httpServer, gateway, path: "/realtime" });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => resolve());
  });

  return {
    close: async () => {
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
    }
  };
}
