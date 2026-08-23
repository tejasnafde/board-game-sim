import { axialDistance, axialKey, axialNeighbors, type GameBot } from "@board-game-sim/shared";
import type { HexKingdomsView, HexTerrain, HexTile } from "@board-game-sim/hex-kingdoms";

function asGame(view: unknown, playerId: string): HexKingdomsView | null {
  const game = view as HexKingdomsView;
  return game.phase === "play" && game.canAct && game.currentPlayerId === playerId ? game : null;
}

function intent(tile: HexTile, coordinate: { q: number; r: number }) {
  return {
    actionType: "draft_and_place",
    payload: { marketTileId: tile.id, q: coordinate.q, r: coordinate.r }
  };
}

export const firstLegalHexPolicy: GameBot = ({ view, playerId }) => {
  const game = asGame(view, playerId);
  if (!game) return null;
  const tile = game.market[0];
  const coordinate = game.legalCoordinates[0];
  return tile && coordinate ? intent(tile, coordinate) : null;
};

export const provinceHexPolicy: GameBot = ({ view, playerId }) => {
  const game = asGame(view, playerId);
  if (!game) return null;
  let best: { tile: HexTile; coordinate: { q: number; r: number }; utility: number } | null = null;
  const ownByKey = new Map(game.placements
    .filter((placement) => placement.ownerPlayerId === playerId)
    .map((placement) => [axialKey(placement.coordinate), placement]));
  for (const tile of game.market) {
    for (const coordinate of game.legalCoordinates) {
      const matchingNeighbors = axialNeighbors(coordinate)
        .filter((neighbor) => ownByKey.get(axialKey(neighbor))?.terrain === tile.terrain).length;
      const ownNeighbors = axialNeighbors(coordinate)
        .filter((neighbor) => ownByKey.has(axialKey(neighbor))).length;
      const utility = matchingNeighbors * 10 + ownNeighbors;
      if (!best || utility > best.utility) best = { tile, coordinate, utility };
    }
  }
  return best ? intent(best.tile, best.coordinate) : null;
};

export const landmarkHexPolicy: GameBot = ({ view, playerId }) => {
  const game = asGame(view, playerId);
  if (!game) return null;
  const tile = game.market.find((candidate) => candidate.feature === "shrine") ?? game.market[0];
  const coordinate = [...game.legalCoordinates].sort((a, b) => {
    const aDistance = Math.min(...game.landmarks.map((landmark) => axialDistance(a, landmark)));
    const bDistance = Math.min(...game.landmarks.map((landmark) => axialDistance(b, landmark)));
    return aDistance - bDistance;
  })[0];
  return tile && coordinate ? intent(tile, coordinate) : null;
};

export const diversityHexPolicy: GameBot = ({ view, playerId }) => {
  const game = asGame(view, playerId);
  if (!game) return null;
  const terrains: HexTerrain[] = ["meadow", "forest", "mountain", "water"];
  const counts = Object.fromEntries(terrains.map((terrain) => [terrain, 0])) as Record<HexTerrain, number>;
  for (const placement of game.placements) {
    if (placement.ownerPlayerId === playerId) counts[placement.terrain] += 1;
  }
  const tile = [...game.market].sort((a, b) => counts[a.terrain] - counts[b.terrain])[0];
  const coordinate = game.legalCoordinates[0];
  return tile && coordinate ? intent(tile, coordinate) : null;
};

export const HEX_TEST_POLICIES = [
  firstLegalHexPolicy,
  provinceHexPolicy,
  landmarkHexPolicy,
  diversityHexPolicy
] as const;
