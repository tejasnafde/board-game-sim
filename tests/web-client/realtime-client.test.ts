import { describe, expect, test } from "vitest";
import { RealtimeClient, type ClientEvent, type ServerEvent, type SocketLike } from "../../packages/web-client/src/realtime-client";

class FakeSocket implements SocketLike {
  public readyState = 0;
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  emitOpen(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  emitMessage(event: ServerEvent): void {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe("realtime client", () => {
  test("connects, sends events, and receives server events", () => {
    const socket = new FakeSocket();
    const received: ServerEvent[] = [];
    const sent: ClientEvent[] = [];

    const client = new RealtimeClient(() => socket);
    client.onServerEvent((event) => {
      received.push(event);
    });
    client.onClientEvent((event) => {
      sent.push(event);
    });

    client.connect();
    socket.emitOpen();

    client.send({ type: "session.join", sessionId: "s1", playerId: "p1" });
    expect(sent[0]?.type).toBe("session.join");
    expect(JSON.parse(socket.sent[0] ?? "{}").type).toBe("session.join");

    socket.emitMessage({ type: "session.action_rejected", sessionId: "s1", reason: "x" });
    expect(received[0]?.type).toBe("session.action_rejected");
  });

  test("reconnect re-sends last join event", () => {
    const sockets: FakeSocket[] = [];
    const client = new RealtimeClient(() => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });

    client.connect();
    sockets[0]?.emitOpen();
    client.send({ type: "session.join", sessionId: "s1", playerId: "p1" });

    client.reconnect();
    sockets[1]?.emitOpen();

    const reconnectJoin = JSON.parse(sockets[1]?.sent[0] ?? "{}") as ClientEvent;
    expect(reconnectJoin.type).toBe("session.join");
  });
});
