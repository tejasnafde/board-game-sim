export type AxialCoord = Readonly<{
  q: number;
  r: number;
}>;

const DIRECTIONS: readonly AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export function axialKey(coordinate: AxialCoord): string {
  return `${coordinate.q}:${coordinate.r}`;
}

export function parseAxialKey(key: string): AxialCoord {
  const match = /^(-?\d+):(-?\d+)$/.exec(key);
  if (!match) {
    throw new Error(`invalid_axial_key:${key}`);
  }
  return { q: Number(match[1]), r: Number(match[2]) };
}

export function axialNeighbors(coordinate: AxialCoord): AxialCoord[] {
  return DIRECTIONS.map((direction) => ({
    q: coordinate.q + direction.q,
    r: coordinate.r + direction.r
  }));
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function isWithinRadius(coordinate: AxialCoord, radius: number): boolean {
  return axialDistance({ q: 0, r: 0 }, coordinate) <= radius;
}

export function coordinatesInRadius(radius: number): AxialCoord[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error(`invalid_axial_radius:${radius}`);
  }

  const coordinates: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    const minR = Math.max(-radius, -q - radius);
    const maxR = Math.min(radius, -q + radius);
    for (let r = minR; r <= maxR; r += 1) {
      coordinates.push({ q, r });
    }
  }
  return coordinates;
}
