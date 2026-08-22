import {
  createLogger,
  type EngineActionEnvelope,
  type JsonValue,
  type TablePlan,
  type TableSummary
} from "@board-game-sim/shared";

const log = createLogger("client");

export type ClientEvent =
  | { type: "session.create"; sessionId: string; gameId: string; playerId: string; players?: string[]; tablePlan?: TablePlan }
  | { type: "session.join"; sessionId: string; playerId: string }
  | { type: "action.submit"; envelope: EngineActionEnvelope }
  | { type: "session.leave"; sessionId: string; playerId: string }
  | { type: "chat.send"; sessionId: string; playerId: string; message: string };

export type ServerEvent =
  | { type: "session.state_sync"; sessionId: string; seq: number; view: JsonValue; youAre?: string; seats?: Record<string, string>; table?: TableSummary }
  | { type: "session.created"; sessionId: string; gameId: string; players: string[] }
  | { type: "session.action_accepted"; sessionId: string; seq: number; actorPlayerId?: string; events: JsonValue[] }
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
  // Track both the last join and last create so we can replay on reconnect
  private lastJoinEvent: Extract<ClientEvent, { type: "session.join" }> | Extract<ClientEvent, { type: "session.create" }> | null = null;
  private readonly serverListeners = new Set<(event: ServerEvent) => void>();
  private readonly clientListeners = new Set<(event: ClientEvent) => void>();
  private readonly logListeners = new Set<(entry: string) => void>();
  private readonly pendingEvents: ClientEvent[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  constructor(private readonly socketFactory: SocketFactory) { }

  connect(): void {
    if (this.socket && this.socket.readyState === 0) {
      return;
    }
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
      this.emitLog("open");
      this.flushPending();
    };
    this.socket.onclose = () => {
      this.emitLog("close");
      this.socket = null;
      if (this.shouldReconnect && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, 1000);
      }
    };
    this.socket.onerror = () => {
      this.emitLog("error");
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.emitLog("disconnect");
    this.socket?.close();
    this.socket = null;
  }

  reconnect(): void {
    this.shouldReconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.connect();
  }

  send(event: ClientEvent): void {
    if (!this.socket) {
      throw new Error("socket_not_connected");
    }
    if (event.type === "session.join" || event.type === "session.create") {
      this.lastJoinEvent = event;
    }
    this.emitLog(`send ${event.type}`);
    if (this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(event));
    } else {
      if (event.type === "session.join" || event.type === "session.create") {
        const filtered = this.pendingEvents.filter(
          (item) => item.type !== "session.join" && item.type !== "session.create"
        );
        this.pendingEvents.splice(0, this.pendingEvents.length, ...filtered, event);
      } else {
        this.pendingEvents.push(event);
      }
      this.emitLog(`send_queued readyState=${this.socket.readyState}`);
    }
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
    log.debug(entry);
    for (const listener of this.logListeners) {
      listener(entry);
    }
  }

  private flushPending(): void {
    if (!this.socket || this.socket.readyState !== 1) {
      return;
    }
    if (
      this.lastJoinEvent &&
      !this.pendingEvents.some(
        (event) => event.type === "session.join" || event.type === "session.create"
      )
    ) {
      this.pendingEvents.unshift(this.lastJoinEvent);
    }
    while (this.pendingEvents.length > 0) {
      const event = this.pendingEvents.shift();
      if (!event) break;
      this.socket.send(JSON.stringify(event));
      this.emitLog(`send_flushed ${event.type}`);
    }
  }
}
