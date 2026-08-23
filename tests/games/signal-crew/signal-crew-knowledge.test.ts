import { describe, expect, test } from "vitest";
import definition from "../../../packages/games/signal-crew/definition.json";
import {
  applyExhaustiveClue,
  createInitialCardKnowledge,
  knowledgeProvesFace,
  parseSignalCrewDefinition,
  possibleSignalFaces,
  type SignalFace
} from "@board-game-sim/signal-crew";

const config = parseSignalCrewDefinition(definition);

describe("Signal Crew knowledge", () => {
  test("starts with every face possible", () => {
    const knowledge = createInitialCardKnowledge(config);
    expect(knowledge.possibleChannels).toEqual(["azure", "amber", "magenta", "jade"]);
    expect(knowledge.possibleRanks).toEqual([1, 2, 3, 4]);
    expect(possibleSignalFaces(knowledge)).toHaveLength(16);
  });

  test("an exhaustive clue records positive and negative information", () => {
    const faces: Record<string, SignalFace> = {
      a: { channel: "azure", rank: 2 },
      b: { channel: "jade", rank: 2 },
      c: { channel: "azure", rank: 4 }
    };
    const knowledge = Object.fromEntries(Object.keys(faces).map((id) => [id, createInitialCardKnowledge(config)]));
    const next = applyExhaustiveClue({
      knowledge,
      packetIds: ["a", "b", "c"],
      packetFaces: faces,
      attribute: "channel",
      value: "azure"
    });

    expect(next.a?.possibleChannels).toEqual(["azure"]);
    expect(next.c?.possibleChannels).toEqual(["azure"]);
    expect(next.b?.possibleChannels).toEqual(["amber", "magenta", "jade"]);
    expect(next.a?.clues.at(-1)).toEqual({ attribute: "channel", value: "azure", matches: true });
    expect(next.b?.clues.at(-1)).toEqual({ attribute: "channel", value: "azure", matches: false });
    expect(knowledge.a?.possibleChannels).toHaveLength(4);
  });

  test("certainty requires one channel and one rank", () => {
    const knowledge = createInitialCardKnowledge(config);
    knowledge.possibleChannels = ["amber"];
    knowledge.possibleRanks = [3];
    expect(knowledgeProvesFace(knowledge, { channel: "amber", rank: 3 })).toBe(true);
    expect(knowledgeProvesFace(knowledge, { channel: "amber", rank: 2 })).toBe(false);
  });
});
