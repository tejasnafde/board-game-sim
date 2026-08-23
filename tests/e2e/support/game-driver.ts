import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { createSeededRng, type GameBot, type JsonValue } from "@board-game-sim/shared";
import { RealtimeGateway, SessionService, registerBuiltInGames } from "@board-game-sim/server";
import { expect } from "vitest";

export type DriverAction = {
  actorPlayerId: string;
  actionType: string;
  payload: JsonValue;
  seq: number;
};

export type CompletedGame = {
  sessionId: string;
  players: string[];
  actions: DriverAction[];
  terminal: { winnerPlayerId: string | null; reason: string };
  service: SessionService;
};

function createStack(seed: string) {
  const registry = new InMemoryGameRegistry();
  registerBuiltInGames(registry);
  const service = new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );
  const gateway = new RealtimeGateway(service, 0, undefined, undefined, () => seed);
  return { service, gateway };
}

function assertSerializable(value: JsonValue): void {
  expect(() => JSON.parse(JSON.stringify(value))).not.toThrow();
}

export async function runSyntheticGame(input: {
  gameId: string;
  definition: JsonValue;
  policies: GameBot[];
  seed: string;
  maxActions: number;
  verifyTerminalFreeze?: boolean;
}): Promise<CompletedGame> {
  const { service, gateway } = createStack(input.seed);
  const players = input.policies.map((_, index) => `player-${index + 1}`);
  const sessionId = `synthetic-${input.gameId}-${input.seed}-${players.length}`;
  const created = await gateway.handleClientEvent({
    type: "session.create",
    sessionId,
    gameId: input.gameId,
    playerId: players[0]!,
    players
  });
  expect(created[0]).toMatchObject({ type: "session.created" });

  const actions: DriverAction[] = [];
  for (let step = 0; step < input.maxActions && !service.getTerminalResult(sessionId); step += 1) {
    let acted = false;
    for (let index = 0; index < players.length; index += 1) {
      const playerId = players[index]!;
      const view = service.getPlayerView(sessionId, playerId) as JsonValue;
      assertSerializable(view);
      const action = input.policies[index]!({
        view,
        definition: input.definition,
        playerId,
        rng: createSeededRng(`${input.seed}:${playerId}:${service.getSessionSeq(sessionId)}`)
      });
      if (!action) continue;

      const expectedSeq = service.getSessionSeq(sessionId);
      const outbound = await gateway.handleClientEvent({
        type: "action.submit",
        envelope: {
          sessionId,
          expectedSeq,
          actorPlayerId: playerId,
          actionType: action.actionType,
          payload: action.payload,
          clientActionId: `synthetic-${step}`
        }
      });
      expect(outbound.find((event) => event.type === "session.action_rejected")).toBeUndefined();
      expect(service.getSessionSeq(sessionId)).toBe(expectedSeq + 1);
      actions.push({ actorPlayerId: playerId, ...action, seq: expectedSeq + 1 });
      acted = true;
      break;
    }
    expect(acted, `deadlock at seq ${service.getSessionSeq(sessionId)} in ${sessionId}`).toBe(true);
  }

  const terminal = service.getTerminalResult(sessionId);
  expect(terminal, `${sessionId} exceeded ${input.maxActions} actions`).not.toBeNull();
  if (input.verifyTerminalFreeze !== false) {
    const last = actions.at(-1)!;
    const frozen = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId,
        expectedSeq: service.getSessionSeq(sessionId),
        actorPlayerId: last.actorPlayerId,
        actionType: last.actionType,
        payload: last.payload,
        clientActionId: "after-terminal"
      }
    });
    expect(frozen[0]).toMatchObject({ type: "session.action_rejected" });
  }
  expect(service.getSessionSeq(sessionId)).toBe(actions.length);
  return { sessionId, players, actions, terminal: terminal!, service };
}

export async function runProductTable(input: {
  gameId: string;
  definition: JsonValue;
  humanPolicies: GameBot[];
  botSeats: number;
  seed: string;
  maxActions: number;
}): Promise<CompletedGame> {
  const { service, gateway } = createStack(input.seed);
  const humanNames = input.humanPolicies.map((_, index) => `human-${index + 1}`);
  const sessionId = `product-${input.gameId}-${input.seed}-${humanNames.length}h${input.botSeats}b`;
  const botActions: DriverAction[] = [];
  gateway.onSessionChanged = (_changedSessionId, action) => {
    botActions.push({
      actorPlayerId: action.actorPlayerId,
      actionType: "bot_action",
      payload: action.items as JsonValue,
      seq: action.seq
    });
  };

  const created = await gateway.handleClientEvent({
    type: "session.create",
    sessionId,
    gameId: input.gameId,
    playerId: humanNames[0]!,
    tablePlan: { humanSeats: humanNames.length, botSeats: input.botSeats }
  });
  expect(created[0]).toMatchObject({ type: "session.created" });
  const players = (created[0] as { players: string[] }).players;
  const seatByName = new Map<string, string>();
  const creatorSync = created[1] as { type: string; youAre: string; table: { ready: boolean } };
  expect(creatorSync.type).toBe("session.state_sync");
  seatByName.set(humanNames[0]!, creatorSync.youAre);

  if (humanNames.length > 1) {
    expect(creatorSync.table.ready).toBe(false);
    const blocked = await gateway.handleClientEvent({
      type: "action.submit",
      envelope: {
        sessionId,
        expectedSeq: service.getSessionSeq(sessionId),
        actorPlayerId: humanNames[0]!,
        actionType: "waiting_probe",
        payload: {},
        clientActionId: "waiting-probe"
      }
    });
    expect(blocked[0]).toMatchObject({ type: "session.action_rejected", reason: "table_not_ready" });
  }

  for (const humanName of humanNames.slice(1)) {
    const [sync] = await gateway.handleClientEvent({ type: "session.join", sessionId, playerId: humanName });
    expect(sync).toMatchObject({ type: "session.state_sync" });
    seatByName.set(humanName, (sync as { youAre: string }).youAre);
  }

  const actions: DriverAction[] = [...botActions];
  let previousBotCount = botActions.length;
  for (let step = 0; step < input.maxActions && !service.getTerminalResult(sessionId); step += 1) {
    let acted = false;
    for (let index = 0; index < humanNames.length; index += 1) {
      const humanName = humanNames[index]!;
      const seat = seatByName.get(humanName)!;
      const view = service.getPlayerView(sessionId, seat) as JsonValue;
      assertSerializable(view);
      const action = input.humanPolicies[index]!({
        view,
        definition: input.definition,
        playerId: seat,
        rng: createSeededRng(`${input.seed}:${seat}:${service.getSessionSeq(sessionId)}`)
      });
      if (!action) continue;

      const expectedSeq = service.getSessionSeq(sessionId);
      const outbound = await gateway.handleClientEvent({
        type: "action.submit",
        envelope: {
          sessionId,
          expectedSeq,
          actorPlayerId: humanName,
          actionType: action.actionType,
          payload: action.payload,
          clientActionId: `product-${step}`
        }
      });
      expect(outbound.find((event) => event.type === "session.action_rejected")).toBeUndefined();
      actions.push({ actorPlayerId: seat, ...action, seq: expectedSeq + 1 });
      for (const botAction of botActions.slice(previousBotCount)) actions.push(botAction);
      previousBotCount = botActions.length;
      acted = true;
      break;
    }
    expect(acted, `product deadlock at seq ${service.getSessionSeq(sessionId)} in ${sessionId}`).toBe(true);
  }

  const terminal = service.getTerminalResult(sessionId);
  expect(terminal, `${sessionId} exceeded ${input.maxActions} actions`).not.toBeNull();
  expect(service.getSessionSeq(sessionId)).toBe(actions.length);
  const frozen = await gateway.handleClientEvent({
    type: "action.submit",
    envelope: {
      sessionId,
      expectedSeq: service.getSessionSeq(sessionId),
      actorPlayerId: humanNames[0]!,
      actionType: "after_terminal",
      payload: {},
      clientActionId: "after-terminal"
    }
  });
  expect(frozen[0]).toMatchObject({ type: "session.action_rejected" });
  return { sessionId, players, actions, terminal: terminal!, service };
}
