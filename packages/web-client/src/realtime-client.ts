import type { EngineActionEnvelope, JsonValue } from "@board-game-sim/shared";

export type ClientEvent =
  | { type: "session.join"; sessionId: string; playerId: string }
  | { type: "action.submit"; envelope: EngineActionEnvelope }
  | { type: "session.leave"; sessionId: string; playerId: string }
  | { type: "chat.send"; sessionId: string; playerId: string; message: string };

export type ServerEvent =
  | { type: "session.state_sync"; sessionId: string; seq: number; view: JsonValue }
  | { type: "session.action_accepted"; sessionId: string; seq: number; events: JsonValue[] }
  | { type: "session.action_rejected"; sessionId: string; reason: string }
  | { type: "session.state_patch"; sessionId: string; seq: number; patch: JsonValue }
  | { type: "session.terminal"; sessionId: string; winnerPlayerId: string | null; reason: string };

export interface SocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = () => SocketLike;

export class RealtimeClient {
  private socket: SocketLike | null = null;
  private lastJoinEvent: Extract<ClientEvent, { type: "session.join" }> | null = null;
  private readonly serverListeners = new Set<(event: ServerEvent) => void>();
  private readonly clientListeners = new Set<(event: ClientEvent) => void>();
  private readonly logListeners = new Set<(entry: string) => void>();

  constructor(private readonly socketFactory: SocketFactory) {}

  connect(): void {
    this.socket = this.socketFactory();
    this.emitLog("connect");
    this.socket.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as ServerEvent;
      this.emitLog(`recv ${parsed.type}`);
      for (const listener of this.serverListeners) {
        listener(parsed);
      }
    };
    this.socket.onopen = () => {
      if (this.lastJoinEvent) {
        this.send(this.lastJoinEvent);
      }
    };
  }

  disconnect(): void {
    this.emitLog("disconnect");
    this.socket?.close();
    this.socket = null;
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  send(event: ClientEvent): void {
    if (!this.socket) {
      throw new Error("socket_not_connected");
    }
    if (event.type === "session.join") {
      this.lastJoinEvent = event;
    }
    this.emitLog(`send ${event.type}`);
    this.socket.send(JSON.stringify(event));
    for (const listener of this.clientListeners) {
      listener(event);
    }
  }

  onServerEvent(listener: (event: ServerEvent) => void): () => void {
    this.serverListeners.add(listener);
    return () => this.serverListeners.delete(listener);
  }

  onClientEvent(listener: (event: ClientEvent) => void): () => void {
    this.clientListeners.add(listener);
    return () => this.clientListeners.delete(listener);
  }

  onLog(listener: (entry: string) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private emitLog(entry: string): void {
    for (const listener of this.logListeners) {
      listener(entry);
    }
  }
}
