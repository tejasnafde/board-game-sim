import {
  deterministicHash,
  type ApplyActionInput,
  type ApplyResult,
  type DomainEvent,
  type GameModule,
  type InitGameInput,
  type InitResult,
  type LegalAction,
  type PlayerView,
  type PlayerViewInput,
  type TerminalResult
} from "@board-game-sim/shared";
import type {
  Coord,
  Direction,
  Edge,
  InsertTilePayload,
  Insertion,
  LabyrinthConfig,
  LabyrinthPlayerState,
  LabyrinthState,
  MovePawnPayload,
  Tile,
  TileShape
} from "./types";
import { findObjectiveTile, findReachable as findReachableOnBoard, shiftBoard, shiftPosition } from "./board";

type LabyrinthDefinition = {
  board?: {
    rows?: number;
    cols?: number;
    insertionIndexes?: number[];
  };
  objectiveCatalog?: string[];
  objectivesPerPlayer?: number;
  playerCount?: {
    min?: number;
    max?: number;
  };
};


function cloneState(state: LabyrinthState): LabyrinthState {
  return JSON.parse(JSON.stringify(state)) as LabyrinthState;
}

function inBounds(c: Coord, config: LabyrinthConfig): boolean {
  return c.row >= 0 && c.row < config.rows && c.col >= 0 && c.col < config.cols;
}

function coordKey(c: Coord): string {
  return `${c.row}:${c.col}`;
}

function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

function nextCoord(c: Coord, dir: Direction): Coord {
  if (dir === "N") return { row: c.row - 1, col: c.col };
  if (dir === "S") return { row: c.row + 1, col: c.col };
  if (dir === "E") return { row: c.row, col: c.col + 1 };
  return { row: c.row, col: c.col - 1 };
}

function parseConfig(definition: LabyrinthDefinition): { config: LabyrinthConfig; objectiveCatalog: string[] } {
  const rows = definition.board?.rows ?? 7;
  const cols = definition.board?.cols ?? 7;
  const insertionIndexes = definition.board?.insertionIndexes ?? [1, 3, 5];
  const objectivesPerPlayer = definition.objectivesPerPlayer ?? 3;
  const objectiveCatalog = definition.objectiveCatalog ?? [
    "helmet",
    "ring",
    "keys",
    "book",
    "owl",
    "bat",
    "crown",
    "coin",
    "map",
    "scroll",
    "gem",
    "chalice",
    "lantern",
    "sword",
    "shield",
    "compass"
  ];

  return {
    config: {
      rows,
      cols,
      insertionIndexes,
      objectivesPerPlayer
    },
    objectiveCatalog
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed: string): () => number {
  let x = hashSeed(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

function randomInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

function rotateOpenings(base: Record<Direction, boolean>, rotationDeg: 0 | 90 | 180 | 270): Record<Direction, boolean> {
  if (rotationDeg === 0) return { ...base };
  if (rotationDeg === 90) {
    return { N: base.W, E: base.N, S: base.E, W: base.S };
  }
  if (rotationDeg === 180) {
    return { N: base.S, E: base.W, S: base.N, W: base.E };
  }
  return { N: base.E, E: base.S, S: base.W, W: base.N };
}

function baseOpenings(shape: TileShape): Record<Direction, boolean> {
  if (shape === "straight") return { N: true, E: false, S: true, W: false };
  if (shape === "corner") return { N: true, E: true, S: false, W: false };
  return { N: true, E: true, S: false, W: true };
}

function createTile(id: string, shape: TileShape, rotationDeg: 0 | 90 | 180 | 270, objectiveId: string | null = null): Tile {
  return {
    id,
    shape,
    rotationDeg,
    openings: rotateOpenings(baseOpenings(shape), rotationDeg),
    objectiveId
  };
}

function pickHome(index: number, config: LabyrinthConfig): Coord {
  const corners: Coord[] = [
    { row: 0, col: 0 },
    { row: 0, col: config.cols - 1 },
    { row: config.rows - 1, col: config.cols - 1 },
    { row: config.rows - 1, col: 0 }
  ];
  return corners[index] ?? corners[0];
}

function getCurrentPlayer(state: LabyrinthState): LabyrinthPlayerState {
  const player = state.players.find((p) => p.playerId === state.currentPlayerId);
  if (!player) {
    throw new Error("current_player_missing");
  }
  return player;
}

function nextPlayerId(state: LabyrinthState): string {
  const index = state.players.findIndex((player) => player.playerId === state.currentPlayerId);
  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = state.players[(index + step) % state.players.length];
    if (candidate && !state.finishOrder.includes(candidate.playerId)) return candidate.playerId;
  }
  return state.currentPlayerId;
}

function isValidInsertionSlot(state: LabyrinthState, payload: InsertTilePayload): boolean {
  const onCorrectEdge =
    (payload.edge === "top" || payload.edge === "bottom")
      ? payload.index >= 0 && payload.index < state.config.cols
      : payload.index >= 0 && payload.index < state.config.rows;

  return onCorrectEdge && state.config.insertionIndexes.includes(payload.index);
}

function oppositeEdge(edge: Edge): Edge {
  if (edge === "top") return "bottom";
  if (edge === "bottom") return "top";
  if (edge === "left") return "right";
  return "left";
}

function isReverseInsertion(last: Insertion | null, next: InsertTilePayload): boolean {
  if (!last) return false;
  return oppositeEdge(last.edge) === next.edge && last.index === next.index;
}

function applyInsertionShift(state: LabyrinthState, insertion: Insertion): void {
  const shifted = shiftBoard(state.board, state.spareTile, insertion, state.config);
  state.board = shifted.board;
  state.spareTile = shifted.spare;

  for (const player of state.players) {
    player.position = shiftPosition(player.position, insertion, state.config);
    player.home = shiftPosition(player.home, insertion, state.config);

  }
}

function findReachable(state: LabyrinthState, from: Coord): Set<string> {
  return findReachableOnBoard(state.board, state.config, from);
}

function collectObjectiveIfPresent(state: LabyrinthState, player: LabyrinthPlayerState): string | null {
  const currentObjective = player.remainingObjectives[0];
  if (!currentObjective) return null;
  const tile = state.board[player.position.row]?.[player.position.col];
  if (tile?.objectiveId !== currentObjective.id) return null;

  player.collectedObjectiveIds.push(currentObjective.id);
  player.remainingObjectives = player.remainingObjectives.slice(1);
  return currentObjective.id;
}


/**
 * Tiles at non-insertion rows AND columns never move. Random shapes there can
 * seal a corner (both openings facing off-board) — an unwinnable start, since
 * homes are corners. Prescribe them like the physical game: corners open
 * inward, edge tees point inward, interior tees rotate symmetrically.
 */
function applyFixedTiles(board: Tile[][], config: LabyrinthConfig): void {
  const isFixed = (i: number): boolean => !config.insertionIndexes.includes(i);
  const lastRow = config.rows - 1;
  const lastCol = config.cols - 1;

  const withOpenings = (id: string, shape: TileShape, want: Record<Direction, boolean>, objectiveId: string | null): Tile => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const tile = createTile(id, shape, rotation, objectiveId);
      if ((["N", "E", "S", "W"] as Direction[]).every((d) => tile.openings[d] === want[d])) return tile;
    }
    throw new Error(`no_rotation_for_openings:${shape}`);
  };

  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      if (!isFixed(row) || !isFixed(col)) continue;
      const old = board[row]![col]!;
      const onTop = row === 0;
      const onBottom = row === lastRow;
      const onLeft = col === 0;
      const onRight = col === lastCol;

      let want: Record<Direction, boolean>;
      let shape: TileShape;
      if ((onTop || onBottom) && (onLeft || onRight)) {
        shape = "corner";
        want = { N: onBottom, S: onTop, E: onLeft, W: onRight };
      } else if (onTop || onBottom || onLeft || onRight) {
        shape = "tee";
        want = { N: !onTop, S: !onBottom, E: !onRight, W: !onLeft };
      } else {
        // interior: tee excluding the direction of its quadrant (rotational symmetry)
        shape = "tee";
        const exclude: Direction =
          row * 2 < config.rows ? (col * 2 < config.cols ? "W" : "N") : (col * 2 < config.cols ? "S" : "E");
        want = { N: true, E: true, S: true, W: true };
        want[exclude] = false;
      }
      board[row]![col] = withOpenings(old.id, shape, want, old.objectiveId);
    }
  }
}

function createInitialBoardAndPlayers(input: InitGameInput, config: LabyrinthConfig, objectiveCatalog: string[]): {
  board: Tile[][];
  spareTile: Tile;
  players: LabyrinthPlayerState[];
} {
  const rng = createRng(`${input.seed}:${input.sessionId}`);
  const shapes: TileShape[] = [];
  for (let i = 0; i < 13; i += 1) shapes.push("straight");
  for (let i = 0; i < 15; i += 1) shapes.push("corner");
  for (let i = 0; i < 22; i += 1) shapes.push("tee");

  for (let i = shapes.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const tmp = shapes[i];
    shapes[i] = shapes[j] as TileShape;
    shapes[j] = tmp as TileShape;
  }

  const rotationOptions: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
  const allTiles: Tile[] = shapes.map((shape, index) => {
    const rotationDeg = rotationOptions[randomInt(rng, rotationOptions.length)] ?? 0;
    return createTile(`tile-${index}`, shape, rotationDeg, null);
  });

  const board: Tile[][] = [];
  let cursor = 0;
  for (let row = 0; row < config.rows; row += 1) {
    const line: Tile[] = [];
    for (let col = 0; col < config.cols; col += 1) {
      line.push(allTiles[cursor] as Tile);
      cursor += 1;
    }
    board.push(line);
  }
  const spareTile = allTiles[cursor] as Tile;
  applyFixedTiles(board, config);

  const objectiveSlots: Coord[] = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      objectiveSlots.push({ row, col });
    }
  }

  const homes = input.players.map((_, idx) => pickHome(idx, config));
  const homeKeys = new Set(homes.map(coordKey));
  const availableSlots = objectiveSlots.filter((slot) => !homeKeys.has(coordKey(slot)));
  for (let i = availableSlots.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const tmp = availableSlots[i] as Coord;
    availableSlots[i] = availableSlots[j] as Coord;
    availableSlots[j] = tmp;
  }

  const players: LabyrinthPlayerState[] = input.players.map((playerId, index) => {
    const home = homes[index] as Coord;
    const objectives = Array.from({ length: config.objectivesPerPlayer }).map((_, objIndex) => {
      const objectiveId = objectiveCatalog[(index * config.objectivesPerPlayer + objIndex) % objectiveCatalog.length] as string;
      const slot = availableSlots.shift() as Coord;
      board[slot.row][slot.col].objectiveId = objectiveId;
      return { id: objectiveId, position: slot };
    });

    return {
      playerId,
      home,
      position: { ...home },
      remainingObjectives: objectives,
      collectedObjectiveIds: []
    };
  });

  return { board, spareTile, players };
}

export class LabyrinthModule implements GameModule<LabyrinthState> {
  initGame(input: InitGameInput): InitResult<LabyrinthState> {
    const parsed = parseConfig(input.definition as LabyrinthDefinition);
    const { board, spareTile, players } = createInitialBoardAndPlayers(input, parsed.config, parsed.objectiveCatalog);

    const state: LabyrinthState = {
      phase: "play",
      finishOrder: [],
      turnStage: "insert",
      config: parsed.config,
      board,
      spareTile,
      players,
      currentPlayerId: input.players[0] ?? "",
      winnerPlayerId: null,
      lastInsertion: null
    };

    return {
      initialState: state,
      emittedEvents: [{ eventType: "game.initialized", payload: { players: input.players } }],
      integrityHash: deterministicHash(state)
    };
  }

  listLegalActions(state: LabyrinthState, playerId: string): LegalAction[] {
    if (state.phase === "terminal") return [];
    if (state.finishOrder.includes(playerId)) return [];
    if (state.currentPlayerId !== playerId) return [];

    if (state.turnStage === "insert") {
      return [{ actionType: "insert_tile", description: "Insert spare tile from a legal edge slot" }];
    }

    return [{ actionType: "move_pawn", description: "Move pawn to any reachable cell" }];
  }

  applyAction(input: ApplyActionInput<LabyrinthState>): ApplyResult<LabyrinthState> {
    const state = cloneState(input.state);

    if (state.phase === "terminal") {
      return {
        accepted: false,
        reason: "terminal_state",
        nextState: state,
        emittedEvents: [],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    if (input.actorPlayerId !== state.currentPlayerId) {
      return {
        accepted: false,
        reason: "not_your_turn",
        nextState: state,
        emittedEvents: [],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    if (input.actionType === "insert_tile") {
      if (state.turnStage !== "insert") {
        return {
          accepted: false,
          reason: "unexpected_turn_stage",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const payload = input.payload as InsertTilePayload;
      if (!isValidInsertionSlot(state, payload)) {
        return {
          accepted: false,
          reason: "invalid_insertion_slot",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      if (isReverseInsertion(state.lastInsertion, payload)) {
        return {
          accepted: false,
          reason: "reverse_insertion_forbidden",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      applyInsertionShift(state, payload);
      state.lastInsertion = payload;
      state.turnStage = "move";

      return {
        accepted: true,
        nextState: state,
        emittedEvents: [{ eventType: "tile.inserted", payload }],
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    if (input.actionType === "move_pawn") {
      if (state.turnStage !== "move") {
        return {
          accepted: false,
          reason: "unexpected_turn_stage",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const payload = input.payload as MovePawnPayload;
      if (!inBounds(payload, state.config)) {
        return {
          accepted: false,
          reason: "move_out_of_bounds",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      const player = getCurrentPlayer(state);
      const reachable = findReachable(state, player.position);
      if (!reachable.has(coordKey(payload))) {
        return {
          accepted: false,
          reason: "unreachable_destination",
          nextState: state,
          emittedEvents: [],
          nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
          integrityHash: deterministicHash(state)
        };
      }

      player.position = payload;
      const events: DomainEvent[] = [{ eventType: "pawn.moved", payload }];

      const collected = collectObjectiveIfPresent(state, player);
      if (collected) {
        events.push({ eventType: "objective.collected", payload: { playerId: player.playerId, objectiveId: collected } });
      }

      const completedAllObjectives = player.remainingObjectives.length === 0;
      const atHome = sameCoord(player.position, player.home);
      if (completedAllObjectives && atHome) {
        state.finishOrder.push(player.playerId);
        events.push({
          eventType: "player.finished",
          payload: { playerId: player.playerId, rank: state.finishOrder.length }
        });
        if (state.finishOrder.length >= state.players.length - 1) {
          // rank the one player left, then close the game
          const last = state.players.find((p) => !state.finishOrder.includes(p.playerId));
          if (last) state.finishOrder.push(last.playerId);
          state.phase = "terminal";
          state.winnerPlayerId = state.finishOrder[0] ?? player.playerId;
          state.turnStage = "insert";
          events.push({ eventType: "game.ended", payload: { winnerPlayerId: state.winnerPlayerId } });
        } else {
          state.currentPlayerId = nextPlayerId(state);
          state.turnStage = "insert";
        }
      } else {
        state.currentPlayerId = nextPlayerId(state);
        state.turnStage = "insert";
      }

      return {
        accepted: true,
        nextState: state,
        emittedEvents: events,
        nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
        integrityHash: deterministicHash(state)
      };
    }

    return {
      accepted: false,
      reason: "unsupported_action",
      nextState: state,
      emittedEvents: [],
      nextTurnInfo: { currentPlayerId: state.currentPlayerId, phase: state.phase },
      integrityHash: deterministicHash(state)
    };
  }

  getPlayerView(input: PlayerViewInput<LabyrinthState>): PlayerView {
    const state = cloneState(input.state);
    const me = state.players.find((player) => player.playerId === input.playerId);

    if (!me) {
      return { visibleState: state };
    }

    const reachable =
      state.currentPlayerId === me.playerId && state.turnStage === "move"
        ? Array.from(findReachable(state, me.position)).map((key) => {
            const [row, col] = key.split(":").map((it) => Number(it));
            return { row, col };
          })
        : [];

    return {
      visibleState: {
        phase: state.phase,
        turnStage: state.turnStage,
        currentPlayerId: state.currentPlayerId,
        winnerPlayerId: state.winnerPlayerId,
        config: state.config,
        board: state.board,
        spareTile: state.spareTile,
        lastInsertion: state.lastInsertion,
        players: state.players.map((player) => {
          const rank = state.finishOrder.indexOf(player.playerId);
          return {
            playerId: player.playerId,
            position: player.position,
            home: player.home,
            objectivesRemainingCount: player.remainingObjectives.length,
            collectedObjectiveIds: player.collectedObjectiveIds,
            finishedRank: rank === -1 ? null : rank + 1
          };
        }),
        myState: {
          playerId: me.playerId,
          position: me.position,
          home: me.home,
          remainingObjectives: me.remainingObjectives.map((objective) => ({
            id: objective.id,
            position: findObjectiveTile(state.board, objective.id)
          })),
          collectedObjectiveIds: me.collectedObjectiveIds,
          reachableCells: reachable
        }
      }
    };
  }

  isTerminal(state: LabyrinthState): TerminalResult | null {
    if (state.phase !== "terminal") {
      return null;
    }

    return {
      winnerPlayerId: state.winnerPlayerId,
      reason: "objectives_collected_and_returned_home"
    };
  }
}
