import {
  SIGNAL_CHANNELS,
  SIGNAL_RANKS,
  type SignalCrewConfig,
  type SignalFace
} from "./types";

function invalid(): never {
  throw new Error("invalid_signal_crew_definition");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parseSeatValues(value: unknown, packetCount: number): Record<2 | 3 | 4, number> {
  if (!isRecord(value)) return invalid();
  const result = {} as Record<2 | 3 | 4, number>;
  for (const seats of [2, 3, 4] as const) {
    const count = value[String(seats)];
    if (!positiveInteger(count) || count * seats >= packetCount) return invalid();
    result[seats] = count;
  }
  return result;
}

export function parseSignalCrewDefinition(input: unknown): SignalCrewConfig {
  if (!isRecord(input)
    || input.gameId !== "signal-crew"
    || typeof input.version !== "string"
    || input.minPlayers !== 2
    || input.maxPlayers !== 4
    || input.copiesPerFace !== 2
    || input.socketsPerRelay !== 2
    || !Array.isArray(input.channels)
    || !Array.isArray(input.ranks)
    || !Array.isArray(input.relayNames)
    || !positiveInteger(input.interferenceLimit)
    || !positiveInteger(input.relayBandwidthReward)) {
    return invalid();
  }
  if (input.channels.length !== SIGNAL_CHANNELS.length
    || input.channels.some((channel, index) => (
      !isRecord(channel)
      || channel.id !== SIGNAL_CHANNELS[index]
      || typeof channel.label !== "string"
      || typeof channel.symbol !== "string"
      || typeof channel.glyph !== "string"
    ))) return invalid();
  if (input.ranks.length !== SIGNAL_RANKS.length
    || input.ranks.some((rank, index) => rank !== SIGNAL_RANKS[index])) return invalid();
  if (input.relayNames.length !== 5
    || new Set(input.relayNames).size !== input.relayNames.length
    || input.relayNames.some((name) => typeof name !== "string" || name.length === 0)) return invalid();

  const packetCount = SIGNAL_CHANNELS.length * SIGNAL_RANKS.length * 2;
  return {
    gameId: "signal-crew",
    version: input.version,
    minPlayers: 2,
    maxPlayers: 4,
    channels: input.channels as SignalCrewConfig["channels"],
    ranks: [...SIGNAL_RANKS],
    copiesPerFace: 2,
    relayNames: input.relayNames as string[],
    socketsPerRelay: 2,
    handSize: parseSeatValues(input.handSize, packetCount),
    bandwidth: parseSeatValues(input.bandwidth, Number.MAX_SAFE_INTEGER),
    interferenceLimit: input.interferenceLimit as number,
    relayBandwidthReward: input.relayBandwidthReward as number
  };
}

export function createSignalCrewFaces(config: SignalCrewConfig): SignalFace[] {
  return config.channels.flatMap(({ id: channel }) => config.ranks.flatMap((rank) => (
    Array.from({ length: config.copiesPerFace }, () => ({ channel, rank }))
  )));
}
