import { describe, expect, test } from "vitest";
import definition from "../../../packages/games/signal-crew/definition.json";
import {
  createSignalCrewFaces,
  parseSignalCrewDefinition
} from "@board-game-sim/signal-crew";

describe("Signal Crew definition", () => {
  test("defines 32 packets and ten public relay requirements", () => {
    const config = parseSignalCrewDefinition(definition);
    const faces = createSignalCrewFaces(config);

    expect(faces).toHaveLength(32);
    expect(new Set(faces.map((face) => `${face.channel}:${face.rank}`)).size).toBe(16);
    expect(config.relayNames).toHaveLength(5);
    expect(config.socketsPerRelay * config.relayNames.length).toBe(10);
  });

  test("rejects malformed components", () => {
    expect(() => parseSignalCrewDefinition({ ...definition, channels: definition.channels.slice(0, 3) }))
      .toThrow("invalid_signal_crew_definition");
    expect(() => parseSignalCrewDefinition({ ...definition, copiesPerFace: 1 }))
      .toThrow("invalid_signal_crew_definition");
    expect(() => parseSignalCrewDefinition({ ...definition, handSize: { ...definition.handSize, 4: 20 } }))
      .toThrow("invalid_signal_crew_definition");
  });
});
