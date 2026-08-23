import type {
  CardKnowledge,
  SignalChannel,
  SignalCrewConfig,
  SignalFace,
  SignalRank
} from "./types";

export function createInitialCardKnowledge(config: SignalCrewConfig): CardKnowledge {
  return {
    possibleChannels: config.channels.map((channel) => channel.id),
    possibleRanks: [...config.ranks],
    clues: []
  };
}

export function possibleSignalFaces(knowledge: CardKnowledge): SignalFace[] {
  return knowledge.possibleChannels.flatMap((channel) => (
    knowledge.possibleRanks.map((rank) => ({ channel, rank }))
  ));
}

export function knowledgeProvesFace(knowledge: CardKnowledge, face: SignalFace): boolean {
  return knowledge.possibleChannels.length === 1
    && knowledge.possibleChannels[0] === face.channel
    && knowledge.possibleRanks.length === 1
    && knowledge.possibleRanks[0] === face.rank;
}

export function applyExhaustiveClue(input: {
  knowledge: Record<string, CardKnowledge>;
  packetIds: string[];
  packetFaces: Record<string, SignalFace>;
  attribute: "channel" | "rank";
  value: SignalChannel | SignalRank;
}): Record<string, CardKnowledge> {
  const next = structuredClone(input.knowledge);
  for (const packetId of input.packetIds) {
    const face = input.packetFaces[packetId]!;
    const card = next[packetId]!;
    const matches = face[input.attribute] === input.value;
    if (input.attribute === "channel") {
      const value = input.value as SignalChannel;
      card.possibleChannels = matches
        ? [value]
        : card.possibleChannels.filter((channel) => channel !== value);
    } else {
      const value = input.value as SignalRank;
      card.possibleRanks = matches
        ? [value]
        : card.possibleRanks.filter((rank) => rank !== value);
    }
    card.clues.push({ attribute: input.attribute, value: input.value, matches });
  }
  return next;
}
