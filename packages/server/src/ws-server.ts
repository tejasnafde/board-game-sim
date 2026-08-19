import type { IncomingMessage, Server as HttpServer } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "@board-game-sim/shared";
import type { ClientEvent, ServerEvent } from "./protocol";
import { RealtimeGateway } from "./realtime-gateway";

export type WsServerOptions = {
  server: HttpServer;
  gateway: RealtimeGateway;
  path?: string;
};

type ConnectionContext = {
  playerBySession: Map<string, string>;
};

function safeParseClientEvent(raw: string): ClientEvent | null {
  try {
    return JSON.parse(raw) as ClientEvent;
  } catch {
    return null;
  }
}

function send(socket: WebSocket, event: ServerEvent): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(event));
}

const log = createLogger("ws");

// One line per meaningful event so `npm run dev:server` is tail-able.
function logTraffic(event: ClientEvent | ServerEvent): void {
  if (event.type === "action.submit") {
    const e = event.envelope;
    log.info(`${e.sessionId} ${e.actorPlayerId} → ${e.actionType} ${JSON.stringify(e.payload)}`);
  } else if (event.type === "session.action_rejected") {
    log.warn(`${event.sessionId} ✗ rejected: ${event.reason}`);
  } else if (event.type === "session.terminal") {
    log.info(`${event.sessionId} ▣ game over — winner: ${event.winnerPlayerId ?? "draw"}`);
  } else if ("sessionId" in event && "playerId" in event) {
    log.info(`${event.sessionId} ${event.playerId} → ${event.type}`);
  }
}

export function createWsRealtimeServer(options: WsServerOptions) {
  const path = options.path ?? "/realtime";
  const wss = new WebSocketServer({ noServer: true });
  const contexts = new WeakMap<WebSocket, ConnectionContext>();
  const sessionRooms = new Map<string, Set<WebSocket>>();

  // Paced bot moves land outside any request; push fresh views to the room.
  options.gateway.onSessionChanged = async (sessionId: string, action: { seq: number; actorPlayerId: string; items: unknown[] }) => {
    const room = sessionRooms.get(sessionId);
    if (!room || room.size === 0) return;
    for (const peer of room) {
      const playerId = contexts.get(peer)?.playerBySession.get(sessionId);
      if (!playerId) continue;
      // domain events first (objective collected, disc dropped…), then the view
      send(peer, {
        type: "session.action_accepted",
        sessionId,
        seq: action.seq,
        actorPlayerId: action.actorPlayerId,
        events: action.items as never[]
      });
      send(peer, await options.gateway.createStateSyncEvent(sessionId, playerId));
    }
    const terminal = options.gateway.getTerminal(sessionId);
    if (terminal) {
      const event: ServerEvent = {
        type: "session.terminal",
        sessionId,
        winnerPlayerId: terminal.winnerPlayerId,
        reason: terminal.reason
      };
      logTraffic(event);
      for (const peer of room) send(peer, event);
    }
  };

  function joinRoom(socket: WebSocket, sessionId: string, playerId: string): void {
    const room = sessionRooms.get(sessionId) ?? new Set<WebSocket>();
    room.add(socket);
    sessionRooms.set(sessionId, room);
    const ctx = contexts.get(socket);
    if (ctx) {
      ctx.playerBySession.set(sessionId, playerId);
    }
  }

  function leaveRoom(socket: WebSocket, sessionId: string): void {
    const room = sessionRooms.get(sessionId);
    if (room) {
      room.delete(socket);
      if (room.size === 0) {
        sessionRooms.delete(sessionId);
      }
    }
    const ctx = contexts.get(socket);
    if (ctx) {
      ctx.playerBySession.delete(sessionId);
    }
  }

  function cleanupSocket(socket: WebSocket): void {
    const ctx = contexts.get(socket);
    if (!ctx) return;
    for (const sessionId of ctx.playerBySession.keys()) {
      leaveRoom(socket, sessionId);
    }
    contexts.delete(socket);
  }

  options.server.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== path) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket: WebSocket) => {
    log.info(`connection opened (${wss.clients.size} total)`);
    contexts.set(socket, { playerBySession: new Map<string, string>() });

    socket.on("message", async (data: WebSocket.RawData) => {
      const incoming = safeParseClientEvent(data.toString());
      if (!incoming) {
        log.warn("dropped frame: invalid json");
        send(socket, {
          type: "session.action_rejected",
          sessionId: "unknown",
          reason: "invalid_json"
        });
        return;
      }

      logTraffic(incoming);

      if (incoming.type === "session.join" || incoming.type === "session.create") {
        joinRoom(socket, incoming.sessionId, incoming.playerId);
      }

      if (incoming.type === "session.leave") {
        leaveRoom(socket, incoming.sessionId);
        return;
      }

      const outbound = await options.gateway.handleClientEvent(incoming);
      for (const event of outbound) {
        if (event.type === "session.action_rejected" || event.type === "session.terminal") {
          logTraffic(event);
        }
      }

      if (incoming.type === "session.join" || incoming.type === "session.create") {
        for (const event of outbound) {
          send(socket, event);
        }
        return;
      }

      if (incoming.type === "action.submit") {
        if (outbound.length === 1 && outbound[0]?.type === "session.action_rejected") {
          send(socket, outbound[0]);
          return;
        }

        const room = sessionRooms.get(incoming.envelope.sessionId) ?? new Set<WebSocket>();
        for (const peer of room) {
          const peerCtx = contexts.get(peer);
          const playerId = peerCtx?.playerBySession.get(incoming.envelope.sessionId);
          for (const event of outbound) {
            send(peer, event);
          }
          if (playerId) {
            const sync = await options.gateway.createStateSyncEvent(incoming.envelope.sessionId, playerId);
            send(peer, sync);
          }
        }
      }
    });

    socket.on("close", () => {
      log.info(`connection closed (${Math.max(0, wss.clients.size - 1)} remaining)`);
      cleanupSocket(socket);
    });

    socket.on("error", () => {
      cleanupSocket(socket);
    });
  });

  return {
    wss,
    close: async (): Promise<void> => {
      for (const client of wss.clients) {
        client.close();
      }
      await new Promise<void>((resolve, reject) => {
        wss.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
