import { describe, expect, test } from "vitest";
import type { EngineActionEnvelope } from "@board-game-sim/shared";
import {
  createInitialClientState,
  applyServerEvent,
  type ClientState,
  type ServerEvent,
  createActionEnvelope
} from "../../packages/web-client/src/realtime-state";

describe("web-client realtime state", () => {
  test("applies state_sync and terminal events", () => {
    let state = createInitialClientState();

    state = applyServerEvent(state, {
      type: "session.state_sync",
      sessionId: "s1",
      seq: 4,
      view: {
        phase: "play",
        currentPlayerId: "p1",
        winnerPlayerId: null
      }
    });

    expect(state.seq).toBe(4);
    expect((state.view as { phase: string }).phase).toBe("play");

    state = applyServerEvent(state, {
      type: "session.terminal",
      sessionId: "s1",
      winnerPlayerId: "p1",
      reason: "all_opponent_ships_sunk"
    });

    expect(state.terminal?.winnerPlayerId).toBe("p1");
  });

  test("stores the authoritative table summary from state sync", () => {
    const state = applyServerEvent(createInitialClientState(), {
      type: "session.state_sync",
      sessionId: "mixed",
      seq: 0,
      view: { phase: "play" },
      table: { humanSeats: 2, botSeats: 1, claimedHumanSeats: 1, ready: false }
    });

    expect(state.table).toEqual({
      humanSeats: 2,
      botSeats: 1,
      claimedHumanSeats: 1,
      ready: false
    });
  });

  test("handles accepted/rejected actions and patches", () => {
    const state0: ClientState = {
      ...createInitialClientState(),
      pendingActionId: "a1"
    };

    const accepted = applyServerEvent(state0, {
      type: "session.action_accepted",
      sessionId: "s1",
      seq: 2,
      actorPlayerId: "p1",
      events: []
    });
    expect(accepted.seq).toBe(2);
    expect(accepted.pendingActionId).toBeNull();
    expect(accepted.acceptedActions).toEqual([{
      seq: 2,
      actorPlayerId: "p1",
      events: []
    }]);

    const patched = applyServerEvent(accepted, {
      type: "session.state_patch",
      sessionId: "s1",
      seq: 2,
      patch: { integrityHash: "h1" }
    });
    expect((patched.patch as { integrityHash: string }).integrityHash).toBe("h1");

    const rejected = applyServerEvent(
      {
        ...patched,
        pendingActionId: "a2"
      },
      {
        type: "session.action_rejected",
        sessionId: "s1",
        reason: "illegal_action"
      }
    );
    expect(rejected.pendingActionId).toBeNull();
    expect(rejected.lastError).toBe("illegal_action");
  });

  test("builds envelopes using client state seq", () => {
    const state: ClientState = {
      ...createInitialClientState(),
      sessionId: "s1",
      playerId: "p1",
      seq: 7
    };
    const env: EngineActionEnvelope = createActionEnvelope(state, "fire", { row: 1, col: 2 }, "a-7");

    expect(env.expectedSeq).toBe(7);
    expect(env.actorPlayerId).toBe("p1");
    expect(env.actionType).toBe("fire");
  });

  test("ignores mismatched session events", () => {
    const state = {
      ...createInitialClientState(),
      sessionId: "s1",
      seq: 1
    };

    const next = applyServerEvent(state, {
      type: "session.action_accepted",
      sessionId: "s2",
      seq: 4,
      events: []
    } as ServerEvent);

    expect(next.seq).toBe(1);
  });

  test("keeps the twenty most recent accepted actions", () => {
    let state = createInitialClientState();
    for (let seq = 1; seq <= 25; seq += 1) {
      state = applyServerEvent(state, {
        type: "session.action_accepted",
        sessionId: "s1",
        seq,
        actorPlayerId: seq % 2 ? "p1" : "p2",
        events: [{ eventType: "shot.miss", payload: { at: { row: 0, col: seq } } }]
      });
    }

    expect(state.acceptedActions).toHaveLength(20);
    expect(state.acceptedActions[0]?.seq).toBe(6);
    expect(state.acceptedActions.at(-1)?.seq).toBe(25);
  });
});
