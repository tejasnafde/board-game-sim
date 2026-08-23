import { describe, expect, test } from "vitest";
import {
  parseHexKingdomsDefinition,
  rankHexKingdoms,
  scoreHexKingdoms,
  type HexPlacement
} from "@board-game-sim/hex-kingdoms";
import definition from "../../../packages/games/hex-kingdoms/definition.json";

const config = parseHexKingdomsDefinition(definition);
const players = ["p1", "p2"];
const capitals = {
  p1: { q: -3, r: 0 },
  p2: { q: 3, r: 0 }
};
const landmarks = [{ q: 0, r: 0 }, { q: 3, r: -3 }, { q: -3, r: 3 }];

function placement(
  id: string,
  ownerPlayerId: string,
  q: number,
  r: number,
  terrain: HexPlacement["terrain"],
  feature: HexPlacement["feature"] = "plain"
): HexPlacement {
  return { tileId: id, ownerPlayerId, coordinate: { q, r }, terrain, feature };
}

function scores(placements: HexPlacement[]) {
  return scoreHexKingdoms({ players, capitals, landmarks, placements, scoring: config.scoring });
}

describe("Hex Kingdoms scoring", () => {
  test("scores Crownlands only through friendly paths and reconnects expeditions", () => {
    const disconnected = scores([
      placement("a", "p1", -2, 0, "forest"),
      placement("b", "p1", 0, -1, "forest")
    ]);
    expect(disconnected.p1!.crownlands).toBe(1);

    const reconnected = scores([
      placement("a", "p1", -2, 0, "forest"),
      placement("bridge", "p1", -1, 0, "meadow"),
      placement("b", "p1", 0, -1, "forest")
    ]);
    expect(reconnected.p1!.crownlands).toBe(3);
  });

  test("scores only the largest province for each terrain and complete diversity sets", () => {
    const result = scores([
      placement("f1", "p1", -2, 0, "forest"),
      placement("f2", "p1", -1, 0, "forest"),
      placement("f3", "p1", 2, -2, "forest"),
      placement("m1", "p1", -2, 1, "meadow"),
      placement("w1", "p1", -1, 1, "water"),
      placement("n1", "p1", -1, -1, "mountain")
    ]).p1!;

    expect(result.provinces).toEqual({ meadow: 1, forest: 2, mountain: 1, water: 1 });
    expect(result.diversity).toBe(3);
    expect(result.largestProvince).toBe(2);
  });

  test("scores villages by distinct friendly terrain and caps keeps at three enemies", () => {
    const result = scores([
      placement("v", "p1", -1, 0, "meadow", "village"),
      placement("vf", "p1", -2, 0, "forest"),
      placement("vw", "p1", -1, 1, "water"),
      placement("vf2", "p1", 0, -1, "forest"),
      placement("k", "p1", 1, 0, "mountain", "keep"),
      placement("e1", "p2", 2, 0, "forest"),
      placement("e2", "p2", 2, -1, "forest"),
      placement("e3", "p2", 1, 1, "forest"),
      placement("e4", "p2", 0, 1, "forest")
    ]).p1!;

    expect(result.features.villages).toBe(2);
    expect(result.features.keeps).toBe(3);
  });

  test("scores shrines once and resolves unique, tied, and untouched landmarks", () => {
    const unique = scores([
      placement("s", "p1", -1, 0, "meadow", "shrine"),
      placement("p1-land", "p1", 0, 1, "forest"),
      placement("p2-land", "p2", 1, 0, "water")
    ]);
    expect(unique.p1!.features.shrines).toBe(4);
    expect(unique.p1!.landmarks).toBe(5);
    expect(unique.p2!.landmarks).toBe(0);

    const tied = scores([
      placement("left", "p1", -1, 0, "meadow"),
      placement("right", "p2", 1, 0, "water")
    ]);
    expect(tied.p1!.landmarks).toBe(2);
    expect(tied.p2!.landmarks).toBe(2);

    const untouched = scores([]);
    expect(untouched.p1!.landmarks).toBe(0);
    expect(untouched.p2!.landmarks).toBe(0);
  });

  test("keeps totals equal to categories and ranks by public tiebreaks", () => {
    const scoreByPlayer = scores([
      placement("a", "p1", -2, 0, "forest"),
      placement("b", "p2", 2, 0, "forest")
    ]);
    for (const score of Object.values(scoreByPlayer)) {
      expect(score.total).toBe(
        score.crownlands
        + Object.values(score.provinces).reduce((sum, value) => sum + value, 0)
        + score.diversity
        + score.features.villages
        + score.features.keeps
        + score.features.shrines
        + score.landmarks
      );
    }

    expect(rankHexKingdoms({
      p1: { ...scoreByPlayer.p1!, total: 20, landmarks: 5, largestProvince: 3 },
      p2: { ...scoreByPlayer.p2!, total: 20, landmarks: 2, largestProvince: 8 }
    })).toEqual({ winnerPlayerIds: ["p1"], winnerPlayerId: "p1" });

    expect(rankHexKingdoms({
      p1: { ...scoreByPlayer.p1!, total: 20, landmarks: 5, largestProvince: 3 },
      p2: { ...scoreByPlayer.p2!, total: 20, landmarks: 5, largestProvince: 3 }
    })).toEqual({ winnerPlayerIds: ["p1", "p2"], winnerPlayerId: null });
  });
});
