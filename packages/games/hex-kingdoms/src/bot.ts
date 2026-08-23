import { axialKey, axialNeighbors, type GameBot } from "@board-game-sim/shared";
import { scoreHexKingdomPlayer } from "./rules/scoring";
import type { HexKingdomsView, HexPlacement, HexScore, HexTile } from "./rules/types";

export type HexKingdomsBotStance = "architect" | "warden" | "steward";

export function hexKingdomsBotStance(playerId: string): HexKingdomsBotStance {
  let hash = 0;
  for (const character of playerId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return (["architect", "warden", "steward"] as const)[hash % 3]!;
}

function playerScore(view: HexKingdomsView, placements: HexPlacement[], playerId: string): HexScore {
  return scoreHexKingdomPlayer({
    players: view.players,
    capitals: view.capitals,
    landmarks: view.landmarks,
    placements,
    scoring: view.config.scoring
  }, playerId);
}

function featureTotal(score: HexScore): number {
  return score.features.villages + score.features.keeps + score.features.shrines;
}

function stanceBonus(stance: HexKingdomsBotStance, before: HexScore, after: HexScore): number {
  if (stance === "architect") {
    const provinceBefore = Object.values(before.provinces).reduce((sum, value) => sum + value, 0);
    const provinceAfter = Object.values(after.provinces).reduce((sum, value) => sum + value, 0);
    return (after.crownlands - before.crownlands) * 3 + (provinceAfter - provinceBefore);
  }
  if (stance === "warden") {
    return (after.landmarks - before.landmarks) * 2
      + (after.features.keeps - before.features.keeps);
  }
  return (after.diversity - before.diversity) * 2
    + (after.features.villages - before.features.villages);
}

function frontierValue(view: HexKingdomsView, coordinate: { q: number; r: number }): number {
  const occupied = new Set([
    ...Object.values(view.capitals).map(axialKey),
    ...view.landmarks.map(axialKey),
    ...view.placements.map((placement) => axialKey(placement.coordinate))
  ]);
  return axialNeighbors(coordinate).filter((neighbor) => !occupied.has(axialKey(neighbor))).length;
}

function candidatePlacement(tile: HexTile, playerId: string, coordinate: { q: number; r: number }): HexPlacement {
  return {
    tileId: tile.id,
    ownerPlayerId: playerId,
    coordinate,
    terrain: tile.terrain,
    feature: tile.feature
  };
}

export const hexKingdomsBot: GameBot = ({ view, playerId, rng }) => {
  const game = view as unknown as HexKingdomsView;
  if (game.phase !== "play" || game.currentPlayerId !== playerId || !game.canAct) return null;
  if (game.market.length === 0 || game.legalCoordinates.length === 0) return null;

  const before = playerScore(game, game.placements, playerId);
  const stance = hexKingdomsBotStance(playerId);
  let bestUtility = -Infinity;
  const best: Array<{ tile: HexTile; coordinate: { q: number; r: number } }> = [];

  for (const tile of game.market) {
    for (const coordinate of game.legalCoordinates) {
      const after = playerScore(
        game,
        [...game.placements, candidatePlacement(tile, playerId, coordinate)],
        playerId
      );
      const utility = (after.total - before.total) * 100
        + stanceBonus(stance, before, after) * 5
        + (featureTotal(after) - featureTotal(before))
        + frontierValue(game, coordinate) * 0.1;
      if (utility > bestUtility) {
        bestUtility = utility;
        best.length = 0;
        best.push({ tile, coordinate });
      } else if (utility === bestUtility) {
        best.push({ tile, coordinate });
      }
    }
  }

  const selected = best[Math.min(best.length - 1, Math.floor(rng() * best.length))]!;
  return {
    actionType: "draft_and_place",
    payload: {
      marketTileId: selected.tile.id,
      q: selected.coordinate.q,
      r: selected.coordinate.r
    }
  };
};
