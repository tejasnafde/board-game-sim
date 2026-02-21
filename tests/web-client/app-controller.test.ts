import { describe, expect, test } from "vitest";
import type { ClientEvent } from "../../packages/web-client/src/realtime-client";
import {
  createClientController,
  type ClientController,
  type ControllerTransport
} from "../../packages/web-client/src/client-controller";

class FakeTransport implements ControllerTransport {
  public sent: ClientEvent[] = [];
  private listeners: Array<(event: any) => void> = [];

  send(event: ClientEvent): void {
    this.sent.push(event);
  }

  subscribe(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((it) => it !== listener);
    };
  }

  emit(event: any): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("client controller", () => {
  test("joins, sends setup and fire intents with expected seq", () => {
    const transport = new FakeTransport();
    const controller: ClientController = createClientController(transport);

    controller.join("s1", "p1");
    expect(transport.sent[0]).toEqual({ type: "session.join", sessionId: "s1", playerId: "p1" });

    transport.emit({
      type: "session.state_sync",
      sessionId: "s1",
      seq: 2,
      view: { phase: "play", currentPlayerId: "p1" }
    });

    controller.submitPlaceShips([
      { shipId: "destroyer", cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }
    ]);

    const setup = transport.sent[1];
    expect(setup?.type).toBe("action.submit");
    if (setup?.type === "action.submit") {
      expect(setup.envelope.expectedSeq).toBe(2);
      expect(setup.envelope.actionType).toBe("place_ships");
    }

    transport.emit({
      type: "session.action_accepted",
      sessionId: "s1",
      seq: 3,
      events: []
    });

    controller.submitFire({ row: 1, col: 1 });
    const fire = transport.sent[2];
    if (fire?.type === "action.submit") {
      expect(fire.envelope.expectedSeq).toBe(3);
      expect(fire.envelope.actionType).toBe("fire");
    }
  });

  test("rejoin uses cached session identity", () => {
    const transport = new FakeTransport();
    const controller = createClientController(transport);

    controller.join("s2", "p2");
    controller.rejoin();

    expect(transport.sent[1]).toEqual({ type: "session.join", sessionId: "s2", playerId: "p2" });
  });

  test("generic submitAction forwards custom payload", () => {
    const transport = new FakeTransport();
    const controller = createClientController(transport);

    controller.join("s3", "p3");
    transport.emit({
      type: "session.state_sync",
      sessionId: "s3",
      seq: 0,
      view: { phase: "play", currentPlayerId: "p3" }
    });

    controller.submitAction("insert_tile", { edge: "top", index: 1 });
    const action = transport.sent[1];
    expect(action?.type).toBe("action.submit");
    if (action?.type === "action.submit") {
      expect(action.envelope.actionType).toBe("insert_tile");
      expect(action.envelope.payload).toEqual({ edge: "top", index: 1 });
    }
  });
});
