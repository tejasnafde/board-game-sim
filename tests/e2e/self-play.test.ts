import { describe, expect, it } from "vitest";
import {
  InMemoryEventRepository,
  InMemoryGameRegistry,
  InMemorySessionRepository,
  InMemorySnapshotRepository
} from "@board-game-sim/engine";
import { createSeededRng, type GameBot, type JsonValue } from "@board-game-sim/shared";
import { battleshipBot } from "@board-game-sim/battleship";
import { labyrinthBot } from "@board-game-sim/labyrinth";
import { connect4Bot } from "@board-game-sim/connect4";
import { hexKingdomsBot } from "@board-game-sim/hex-kingdoms";
import { signalCrewBot } from "@board-game-sim/signal-crew";
import { RealtimeGateway, SessionService, registerBuiltInGames } from "@board-game-sim/server";
import battleshipDefinition from "../../packages/games/battleship/definition.json";
import labyrinthDefinition from "../../packages/games/labyrinth/definition.json";
import connect4Definition from "../../packages/games/connect4/definition.json";
import hexKingdomsDefinition from "../../packages/games/hex-kingdoms/definition.json";
import signalCrewDefinition from "../../packages/games/signal-crew/definition.json";

/**
 * Self-play harness: bots play the full server stack (gateway → session
 * service → engine → rules) to a terminal state using ONLY player views —
 * exactly what a browser client sees. This is the playability gate:
 * if it stalls, rejects a bot action, or never terminates, the game is
 * broken for humans too.
 *
 * ADDING A GAME? Add one entry to GAMES below (and ship a bot from your
 * game package). That's the whole integration.
 */

type SelfPlayGame = {
  gameId: string;
  bot: GameBot;
  definition: JsonValue;
  rosters: string[][]; // each roster is one full game run
  maxActions: number;
};

const GAMES: SelfPlayGame[] = [
  {
    gameId: "battleship",
    bot: battleshipBot,
    definition: battleshipDefinition as JsonValue,
    rosters: [["alice", "bob"]],
    maxActions: 250
  },
  {
    gameId: "labyrinth",
    bot: labyrinthBot,
    definition: labyrinthDefinition as JsonValue,
    // 2 players proves rosters aren't hardcoded to 4 seats; 4 proves full table.
    rosters: [["alice", "bob"], ["alice", "bob", "carol", "dave"]],
    maxActions: 4000
  },
  {
    gameId: "connect4",
    bot: connect4Bot,
    definition: connect4Definition as JsonValue,
    rosters: [["alice", "bob"]],
    maxActions: 50
  },
  {
    gameId: "hex-kingdoms",
    bot: hexKingdomsBot,
    definition: hexKingdomsDefinition as JsonValue,
    rosters: [
      ["alice", "bob"],
      ["alice", "bob", "carol"],
      ["alice", "bob", "carol", "dave"]
    ],
    maxActions: 50
  },
  {
    gameId: "signal-crew",
    bot: signalCrewBot,
    definition: signalCrewDefinition as JsonValue,
    rosters: [
      ["alice", "bob"],
      ["alice", "bob", "carol"],
      ["alice", "bob", "carol", "dave"]
    ],
    maxActions: 100
  }
];

async function runSelfPlay(game: SelfPlayGame, players: string[]) {
  const registry = new InMemoryGameRegistry();
  registerBuiltInGames(registry);
  const sessions = new SessionService(
    registry,
    new InMemoryEventRepository(),
    new InMemorySessionRepository(),
    new InMemorySnapshotRepository()
  );
  const gateway = new RealtimeGateway(sessions);
  const sessionId = `selfplay-${game.gameId}-${players.length}p`;
  const rng = createSeededRng(sessionId);

  const created = await gateway.handleClientEvent({
    type: "session.create",
    sessionId,
    gameId: game.gameId,
    playerId: players[0]!,
    players
  });
  expect(created[0]?.type, JSON.stringify(created[0])).toBe("session.created");

  for (let step = 0; step < game.maxActions; step += 1) {
    if (sessions.getTerminalResult(sessionId)) {
      return { terminal: sessions.getTerminalResult(sessionId)!, actions: step };
    }

    // Every player's view must render without throwing, every step.
    // (SessionService.getPlayerView already unwraps .visibleState.)
    const views = players.map((p) => sessions.getPlayerView(sessionId, p) as JsonValue);

    let acted = false;
    for (let i = 0; i < players.length; i += 1) {
      const playerId = players[i]!;
      const action = game.bot({
        view: views[i]!,
        definition: game.definition,
        playerId,
        rng
      });
      if (!action) continue;

      const outbound = await gateway.handleClientEvent({
        type: "action.submit",
        envelope: {
          sessionId,
          expectedSeq: sessions.getSessionSeq(sessionId),
          actorPlayerId: playerId,
          actionType: action.actionType,
          payload: action.payload,
          clientActionId: `selfplay-${step}`
        }
      });

      const rejected = outbound.find((e) => e.type === "session.action_rejected");
      expect(
        rejected,
        `bot action rejected at step ${step}: ${playerId} ${action.actionType} → ${JSON.stringify(rejected)}`
      ).toBeUndefined();
      acted = true;
      break; // one action per step, then re-fetch views
    }

    // Deadlock detector: game not over, but no player can act from their view.
    expect(acted, `deadlock at step ${step}: no player has a move (roster: ${players.join(", ")})`).toBe(true);
  }

  const terminal = sessions.getTerminalResult(sessionId);
  expect(terminal, `game did not terminate within ${game.maxActions} actions`).not.toBeNull();
  return { terminal: terminal!, actions: game.maxActions };
}

describe("self-play e2e", () => {
  for (const game of GAMES) {
    for (const roster of game.rosters) {
      it(`${game.gameId} plays to completion with ${roster.length} players`, async () => {
        const { terminal } = await runSelfPlay(game, roster);
        // A draw (null winner) is a legitimate terminal state; a named winner
        // must be someone actually at the table.
        if (terminal.winnerPlayerId !== null) {
          expect(roster).toContain(terminal.winnerPlayerId);
        }
      });
    }
  }
});
