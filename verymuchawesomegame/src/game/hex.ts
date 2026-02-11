import { BIOMES } from '@/lib/constants';
import type { BiomeType } from '@/lib/types';

export const HEX_SIZE = 40;

// Pointy-top hex vertices
export function hexVertices(cx: number, cy: number, size: number = HEX_SIZE): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(cx + size * Math.cos(angle));
    points.push(cy + size * Math.sin(angle));
  }
  return points;
}

// Axial to pixel (pointy-top)
export function axialToPixel(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = HEX_SIZE * (3 / 2) * r;
  return { x, y };
}

// Pixel to axial (pointy-top) with rounding
export function pixelToAxial(x: number, y: number): { q: number; r: number } {
  const q = (Math.sqrt(3) / 3 * x - y / 3) / HEX_SIZE;
  const r = (2 / 3 * y) / HEX_SIZE;

  // Cube rounding
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

export function getBiomeColor(biome: BiomeType): number {
  const hex = BIOMES[biome]?.color ?? '#333333';
  return parseInt(hex.replace('#', ''), 16);
}

export function getBiomeFogColor(): number {
  return 0x0a0a0a;
}

// --- Isometric rendering utilities ---

export const ISO_Y_RATIO = 0.5;
export const WALL_HEIGHT = 16;
export const ELEVATION_UNIT = 8;

export const BIOME_ELEVATION: Record<string, number> = {
  flats: 0,
  biolume_forest: 1,
  fungal_marsh: 0,
  crystal_ridge: 2,
  ruin: 1,
  vent_fields: 0,
  scar: 0,
  chasm: -1,
};

export const WALL_SHADING = {
  right: 0.70,
  front: 0.55,
  left: 0.85,
};

// Axial to isometric screen coords (compress Y by ISO_Y_RATIO)
export function axialToIso(q: number, r: number): { x: number; y: number } {
  const { x, y } = axialToPixel(q, r);
  return { x, y: y * ISO_Y_RATIO };
}

// Reverse isometric transform for click detection (unsquash Y, then cube-round)
export function isoToAxial(screenX: number, screenY: number): { q: number; r: number } {
  return pixelToAxial(screenX, screenY / ISO_Y_RATIO);
}

// 6 top-face vertices with Y squashed by ISO_Y_RATIO
export function isoHexVertices(size: number = HEX_SIZE): { x: number; y: number }[] {
  const vertices: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    vertices.push({
      x: size * Math.cos(angle),
      y: size * Math.sin(angle) * ISO_Y_RATIO,
    });
  }
  return vertices;
}

// Visible wall edges: right, front, left (vertex index pairs)
export function getVisibleWallEdges(): [number, number][] {
  return [[1, 2], [2, 3], [3, 4]];
}

// Multiply RGB channels by factor for directional shading
export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

// Depth sort key for back-to-front rendering
export function hexDepth(q: number, r: number, elevation: number): number {
  const { y } = axialToIso(q, r);
  return y * 10000 + elevation * 100;
}
