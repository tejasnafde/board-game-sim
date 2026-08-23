export const SIGNAL_CHANNELS = ["azure", "amber", "magenta", "jade"] as const;
export const SIGNAL_RANKS = [1, 2, 3, 4] as const;

export type SignalChannel = (typeof SIGNAL_CHANNELS)[number];
export type SignalRank = (typeof SIGNAL_RANKS)[number];

export type SignalChannelDefinition = {
  id: SignalChannel;
  label: string;
  symbol: "triangle" | "circle" | "square" | "diamond";
  glyph: string;
};

export type SignalCrewConfig = {
  gameId: "signal-crew";
  version: string;
  minPlayers: 2;
  maxPlayers: 4;
  channels: SignalChannelDefinition[];
  ranks: SignalRank[];
  copiesPerFace: 2;
  relayNames: string[];
  socketsPerRelay: 2;
  handSize: Record<2 | 3 | 4, number>;
  bandwidth: Record<2 | 3 | 4, number>;
  interferenceLimit: number;
  relayBandwidthReward: number;
};

export type SignalFace = {
  channel: SignalChannel;
  rank: SignalRank;
};

export type CardKnowledge = {
  possibleChannels: SignalChannel[];
  possibleRanks: SignalRank[];
  clues: Array<{
    attribute: "channel" | "rank";
    value: SignalChannel | SignalRank;
    matches: boolean;
  }>;
};

export type SignalSocket = {
  id: string;
  required: SignalFace;
  filledPacketId: string | null;
};

export type SignalRelay = {
  id: string;
  name: string;
  sockets: SignalSocket[];
  completed: boolean;
};

export type RevealedPacket = {
  packetId: string;
  face: SignalFace;
  reason: "failed_transmission" | "recycled";
};

export type SignalCrewOutcome = "playing" | "won" | "lost";
export type SignalCrewTerminalReason =
  | "crew_victory"
  | "interference_overload"
  | "required_packet_exhausted"
  | "final_orbit_expired";

export type SignalCrewState = {
  phase: "play" | "terminal";
  outcome: SignalCrewOutcome;
  terminalReason: SignalCrewTerminalReason | null;
  config: SignalCrewConfig;
  players: string[];
  packetFaces: Record<string, SignalFace>;
  deck: string[];
  hands: Record<string, string[]>;
  discard: RevealedPacket[];
  relays: SignalRelay[];
  knowledge: Record<string, Record<string, CardKnowledge>>;
  bandwidth: number;
  maxBandwidth: number;
  interference: number;
  currentPlayerIndex: number;
  currentPlayerId: string;
  turnIndex: number;
  finalOrbitTurnsRemaining: number | null;
};

export type ConcealedPacketView = CardKnowledge & {
  packetId: string;
  concealed: true;
};

export type VisiblePacketView = CardKnowledge & {
  packetId: string;
  concealed: false;
  face: SignalFace;
};

export type SignalHandView = {
  playerId: string;
  packets: Array<ConcealedPacketView | VisiblePacketView>;
};

export type SignalCrewView = {
  phase: "play" | "terminal";
  outcome: SignalCrewOutcome;
  terminalReason: SignalCrewTerminalReason | null;
  config: SignalCrewConfig;
  players: string[];
  hands: SignalHandView[];
  relays: SignalRelay[];
  discard: RevealedPacket[];
  bandwidth: number;
  maxBandwidth: number;
  interference: number;
  currentPlayerId: string;
  turnIndex: number;
  finalOrbitTurnsRemaining: number | null;
  remainingPacketCount: number;
  youPlayerId: string | null;
  canAct: boolean;
  legalActionTypes: Array<"give_clue" | "transmit_packet" | "recycle_packet" | "stand_by">;
};
