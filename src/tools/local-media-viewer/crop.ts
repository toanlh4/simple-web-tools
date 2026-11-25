export const THUMB_SIZE = 320;
export const THUMB_TYPE = 'image/webp';
export const THUMB_QUALITY = 0.8;

export interface Crop {
  x: number;
  y: number;
  /** Edge of the centered source square. */
  source: number;
  /** Edge of the thumbnail; small images are not enlarged. */
  target: number;
}

export function centerCrop(width: number, height: number): Crop {
  const source = Math.min(width, height);
  return { x: (width - source) / 2, y: (height - source) / 2, source, target: Math.max(1, Math.min(THUMB_SIZE, source)) };
}
