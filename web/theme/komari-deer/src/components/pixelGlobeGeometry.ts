/** Fixed resolution keeps work and memory independent of the viewport size. */
export const GLOBE_GRID = 96;
export const GLOBE_PITCH = 4;
export const GLOBE_SIZE = GLOBE_GRID * GLOBE_PITCH;
export const GLOBE_RADIUS = 45;
export const TEXTURE_WIDTH = 720;
export const TEXTURE_HEIGHT = 360;
const RAD = Math.PI / 180;
const TILT = 15 * RAD;
const SIN_TILT = Math.sin(TILT);
const COS_TILT = Math.cos(TILT);

export interface GlobeSample {
  x: number;
  y: number;
  longitude: number;
  row: number;
  shade: number;
}

/** Precompute the visible sphere once; rotation only shifts texture columns. */
export function createGlobeSamples(): GlobeSample[] {
  const samples = new Array<GlobeSample>(GLOBE_GRID * GLOBE_GRID);
  let count = 0;
  for (let row = 0; row < GLOBE_GRID; row++) {
    for (let column = 0; column < GLOBE_GRID; column++) {
      const x = (column + 0.5 - GLOBE_GRID / 2) / GLOBE_RADIUS;
      const y = (GLOBE_GRID / 2 - row - 0.5) / GLOBE_RADIUS;
      const depth = 1 - x * x - y * y;
      if (depth <= 0) continue;
      const z = Math.sqrt(depth);
      const latitude = Math.asin(y * COS_TILT + z * SIN_TILT);
      samples[count++] = {
        x: column * GLOBE_PITCH, y: row * GLOBE_PITCH,
        longitude: Math.atan2(x, z * COS_TILT - y * SIN_TILT) / RAD,
        row: Math.min(TEXTURE_HEIGHT - 1, Math.floor((0.5 - latitude / Math.PI) * TEXTURE_HEIGHT)),
        shade: Math.round((0.6 + 0.4 * z) * 4) / 4,
      };
    }
  }
  samples.length = count;
  return samples;
}

export function textureColumn(longitude: number): number {
  return Math.floor(((longitude + 180) % 360 + 360) % 360 / 360 * TEXTURE_WIDTH);
}

/** The inverse of the sample projection. Back-facing locations are excluded. */
export function projectGlobeLocation(longitude: number, latitude: number, center: number): { x: number; y: number } | null {
  const lon = (longitude - center) * RAD;
  const lat = latitude * RAD;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat) * COS_TILT - Math.cos(lat) * Math.cos(lon) * SIN_TILT;
  const z = Math.sin(lat) * SIN_TILT + Math.cos(lat) * Math.cos(lon) * COS_TILT;
  if (z <= 0) return null;
  return { x: (GLOBE_GRID / 2 + x * GLOBE_RADIUS) * GLOBE_PITCH, y: (GLOBE_GRID / 2 - y * GLOBE_RADIUS) * GLOBE_PITCH };
}
