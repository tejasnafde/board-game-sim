import { axialKey, coordinatesInRadius, isWithinRadius, type AxialCoord } from "@board-game-sim/shared";
import {
  HEX_FEATURES,
  HEX_TERRAINS,
  type HexFeature,
  type HexKingdomsConfig,
  type HexLayout,
  type HexScoringConfig,
  type HexTerrain,
  type HexTile
} from "./types";

function invalid(): never {
  throw new Error("invalid_hex_kingdoms_definition");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function coordinate(value: unknown): AxialCoord {
  if (!isRecord(value) || !Number.isInteger(value.q) || !Number.isInteger(value.r)) {
    return invalid();
  }
  return { q: value.q as number, r: value.r as number };
}

function parseLayout(value: unknown, playerCount: 2 | 3 | 4, turnsPerPlayer: number): HexLayout {
  if (!isRecord(value) || !positiveInteger(value.radius) || !Array.isArray(value.capitals) || !Array.isArray(value.landmarks)) {
    return invalid();
  }
  const capitals = value.capitals.map(coordinate);
  const landmarks = value.landmarks.map(coordinate);
  if (capitals.length !== playerCount || landmarks.length !== 3) {
    return invalid();
  }
  const occupied = [...capitals, ...landmarks];
  if (new Set(occupied.map(axialKey)).size !== occupied.length) {
    return invalid();
  }
  if (!occupied.every((item) => isWithinRadius(item, value.radius as number))) {
    return invalid();
  }
  if (coordinatesInRadius(value.radius as number).length - occupied.length < playerCount * turnsPerPlayer) {
    return invalid();
  }
  return { radius: value.radius as number, capitals, landmarks };
}

function parseScoring(value: unknown): HexScoringConfig {
  if (!isRecord(value)) {
    return invalid();
  }
  const keys: Array<keyof HexScoringConfig> = [
    "crownlandsPerTile",
    "diversitySet",
    "villageCap",
    "keepCap",
    "shrineByLandmark",
    "landmarkUnique",
    "landmarkTied"
  ];
  const result = {} as HexScoringConfig;
  for (const key of keys) {
    if (!Number.isInteger(value[key]) || (value[key] as number) < 0) {
      return invalid();
    }
    result[key] = value[key] as number;
  }
  return result;
}

export function parseHexKingdomsDefinition(input: unknown): HexKingdomsConfig {
  if (!isRecord(input)
    || input.gameId !== "hex-kingdoms"
    || typeof input.version !== "string"
    || input.minPlayers !== 2
    || input.maxPlayers !== 4
    || !positiveInteger(input.turnsPerPlayer)
    || !positiveInteger(input.marketSize)
    || !Array.isArray(input.terrains)
    || !isRecord(input.tileRecipe)
    || !isRecord(input.layouts)) {
    return invalid();
  }

  if (input.terrains.length !== HEX_TERRAINS.length
    || input.terrains.some((terrain, index) => terrain !== HEX_TERRAINS[index])) {
    return invalid();
  }
  if (Object.keys(input.tileRecipe).length !== HEX_FEATURES.length) {
    return invalid();
  }

  const tileRecipe = {} as Record<HexFeature, number>;
  for (const feature of HEX_FEATURES) {
    const count = input.tileRecipe[feature];
    if (!Number.isInteger(count) || (count as number) < 0) {
      return invalid();
    }
    tileRecipe[feature] = count as number;
  }

  const turnsPerPlayer = input.turnsPerPlayer as number;
  const layouts = {
    2: parseLayout(input.layouts["2"], 2, turnsPerPlayer),
    3: parseLayout(input.layouts["3"], 3, turnsPerPlayer),
    4: parseLayout(input.layouts["4"], 4, turnsPerPlayer)
  };
  const config: HexKingdomsConfig = {
    gameId: "hex-kingdoms",
    version: input.version,
    minPlayers: 2,
    maxPlayers: 4,
    turnsPerPlayer,
    marketSize: input.marketSize as number,
    terrains: [...HEX_TERRAINS],
    tileRecipe,
    layouts,
    scoring: parseScoring(input.scoring)
  };

  if (createHexKingdomsTiles(config).length < config.marketSize + config.maxPlayers * config.turnsPerPlayer) {
    return invalid();
  }
  return config;
}

export function createHexKingdomsTiles(config: HexKingdomsConfig): HexTile[] {
  const tiles: HexTile[] = [];
  for (const terrain of config.terrains) {
    for (const feature of HEX_FEATURES) {
      for (let copy = 1; copy <= config.tileRecipe[feature]; copy += 1) {
        tiles.push({ id: `${terrain}-${feature}-${copy}`, terrain: terrain as HexTerrain, feature });
      }
    }
  }
  return tiles;
}
