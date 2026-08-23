import { axialKey, axialNeighbors, type AxialCoord } from "@board-game-sim/shared";
import {
  HEX_TERRAINS,
  type HexPlacement,
  type HexScore,
  type HexScoringConfig,
  type HexTerrain
} from "./types";

export type ScoreInput = {
  players: string[];
  capitals: Record<string, AxialCoord>;
  landmarks: AxialCoord[];
  placements: HexPlacement[];
  scoring: HexScoringConfig;
};

type ScoreContext = {
  placementsByCoordinate: Map<string, HexPlacement>;
  landmarkScores: Record<string, number>;
};

function connectedSize(
  starts: AxialCoord[],
  placementsByCoordinate: Map<string, HexPlacement>,
  accepts: (placement: HexPlacement) => boolean
): number {
  const pending = [...starts];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const coordinate = pending.pop()!;
    const key = axialKey(coordinate);
    if (visited.has(key)) continue;
    const placement = placementsByCoordinate.get(key);
    if (!placement || !accepts(placement)) continue;
    visited.add(key);
    pending.push(...axialNeighbors(coordinate));
  }
  return visited.size;
}

function largestProvince(
  playerId: string,
  terrain: HexTerrain,
  placements: HexPlacement[],
  placementsByCoordinate: Map<string, HexPlacement>
): number {
  const remaining = new Set(
    placements
      .filter((placement) => placement.ownerPlayerId === playerId && placement.terrain === terrain)
      .map((placement) => axialKey(placement.coordinate))
  );
  let largest = 0;
  while (remaining.size > 0) {
    const [startKey] = remaining;
    const start = placementsByCoordinate.get(startKey!)!;
    const region = [start.coordinate];
    const visited = new Set<string>();
    while (region.length > 0) {
      const coordinate = region.pop()!;
      const key = axialKey(coordinate);
      if (visited.has(key)) continue;
      const placement = placementsByCoordinate.get(key);
      if (!placement || placement.ownerPlayerId !== playerId || placement.terrain !== terrain) continue;
      visited.add(key);
      remaining.delete(key);
      region.push(...axialNeighbors(coordinate));
    }
    largest = Math.max(largest, visited.size);
  }
  return largest;
}

function scoreContext(input: ScoreInput): ScoreContext {
  const placementsByCoordinate = new Map(
    input.placements.map((placement) => [axialKey(placement.coordinate), placement])
  );
  const landmarkScores = Object.fromEntries(input.players.map((playerId) => [playerId, 0]));

  for (const landmark of input.landmarks) {
    const counts = Object.fromEntries(input.players.map((playerId) => [playerId, 0]));
    for (const neighbor of axialNeighbors(landmark)) {
      const placement = placementsByCoordinate.get(axialKey(neighbor));
      if (placement && placement.ownerPlayerId in counts) {
        counts[placement.ownerPlayerId] += 1;
      }
    }
    const highest = Math.max(...Object.values(counts));
    if (highest === 0) continue;
    const leaders = input.players.filter((playerId) => counts[playerId] === highest);
    for (const leader of leaders) {
      landmarkScores[leader] += leaders.length === 1
        ? input.scoring.landmarkUnique
        : input.scoring.landmarkTied;
    }
  }
  return { placementsByCoordinate, landmarkScores };
}

function scorePlayer(input: ScoreInput, playerId: string, context: ScoreContext): HexScore {
  const { placementsByCoordinate, landmarkScores } = context;
  const owned = input.placements.filter((placement) => placement.ownerPlayerId === playerId);
  const crownlands = connectedSize(
    axialNeighbors(input.capitals[playerId]!),
    placementsByCoordinate,
    (placement) => placement.ownerPlayerId === playerId
  ) * input.scoring.crownlandsPerTile;
  const provinces = Object.fromEntries(HEX_TERRAINS.map((terrain) => [
    terrain,
    largestProvince(playerId, terrain, input.placements, placementsByCoordinate)
  ])) as Record<HexTerrain, number>;
  const terrainCounts = Object.fromEntries(HEX_TERRAINS.map((terrain) => [
    terrain,
    owned.filter((placement) => placement.terrain === terrain).length
  ])) as Record<HexTerrain, number>;
  const diversity = Math.min(...Object.values(terrainCounts)) * input.scoring.diversitySet;
  let villages = 0;
  let keeps = 0;
  let shrines = 0;
  for (const placement of owned) {
    const neighbors = axialNeighbors(placement.coordinate)
      .map((coordinate) => placementsByCoordinate.get(axialKey(coordinate)))
      .filter((neighbor): neighbor is HexPlacement => Boolean(neighbor));
    if (placement.feature === "village") {
      villages += Math.min(input.scoring.villageCap, new Set(
        neighbors
          .filter((neighbor) => neighbor.ownerPlayerId === playerId)
          .map((neighbor) => neighbor.terrain)
      ).size);
    } else if (placement.feature === "keep") {
      keeps += Math.min(
        input.scoring.keepCap,
        neighbors.filter((neighbor) => neighbor.ownerPlayerId !== playerId).length
      );
    } else if (placement.feature === "shrine") {
      const besideLandmark = input.landmarks.some((landmark) => (
        axialNeighbors(placement.coordinate).some((neighbor) => axialKey(neighbor) === axialKey(landmark))
      ));
      if (besideLandmark) shrines += input.scoring.shrineByLandmark;
    }
  }
  const provinceTotal = Object.values(provinces).reduce((sum, value) => sum + value, 0);
  const features = { villages, keeps, shrines };
  const landmarks = landmarkScores[playerId]!;
  const total = crownlands + provinceTotal + diversity + villages + keeps + shrines + landmarks;
  return {
    crownlands,
    provinces,
    diversity,
    features,
    landmarks,
    largestProvince: Math.max(...Object.values(provinces)),
    total
  };
}

export function scoreHexKingdomPlayer(input: ScoreInput, playerId: string): HexScore {
  return scorePlayer(input, playerId, scoreContext(input));
}

export function scoreHexKingdoms(input: ScoreInput): Record<string, HexScore> {
  const context = scoreContext(input);
  return Object.fromEntries(input.players.map((playerId) => [
    playerId,
    scorePlayer(input, playerId, context)
  ]));
}

export function rankHexKingdoms(scores: Record<string, HexScore>): {
  winnerPlayerIds: string[];
  winnerPlayerId: string | null;
} {
  const ordered = Object.entries(scores).sort(([, a], [, b]) => (
    b.total - a.total
    || b.landmarks - a.landmarks
    || b.largestProvince - a.largestProvince
  ));
  const best = ordered[0]?.[1];
  const winnerPlayerIds = best
    ? ordered
      .filter(([, score]) => score.total === best.total
        && score.landmarks === best.landmarks
        && score.largestProvince === best.largestProvince)
      .map(([playerId]) => playerId)
    : [];
  return {
    winnerPlayerIds,
    winnerPlayerId: winnerPlayerIds.length === 1 ? winnerPlayerIds[0]! : null
  };
}
