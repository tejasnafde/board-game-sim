export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type LegalAction = {
  actionType: string;
  description?: string;
  payloadSchema?: JsonValue;
};

export type InitGameInput = {
  sessionId: string;
  gameId: string;
  gameVersion: string;
  seed: string;
  players: string[];
  definition: JsonValue;
};

export type InitResult<State = JsonValue> = {
  initialState: State;
  emittedEvents: DomainEvent[];
  integrityHash: string;
};

export type ApplyActionInput<State = JsonValue> = {
  sessionId: string;
  seq: number;
  actorPlayerId: string;
  actionType: string;
  payload: JsonValue;
  state: State;
  seed: string;
};

export type DomainEvent = {
  eventType: string;
  payload: JsonValue;
};

export type ApplyResult<State = JsonValue> = {
  accepted: boolean;
  reason?: string;
  nextState: State;
  emittedEvents: DomainEvent[];
  nextTurnInfo: {
    currentPlayerId: string;
    phase: string;
  };
  integrityHash: string;
};

export type PlayerViewInput<State = JsonValue> = {
  state: State;
  playerId: string;
};

export type PlayerView = {
  visibleState: JsonValue;
};

export type TerminalResult = {
  winnerPlayerId: string | null;
  reason: string;
};

export interface GameModule<State = JsonValue> {
  initGame(input: InitGameInput): InitResult<State>;
  listLegalActions(state: State, playerId: string): LegalAction[];
  applyAction(input: ApplyActionInput<State>): ApplyResult<State>;
  getPlayerView(input: PlayerViewInput<State>): PlayerView;
  isTerminal(state: State): TerminalResult | null;
}
