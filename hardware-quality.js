// Preserve native display pixels. Only extreme viewport/DPR combinations hit
// this allocation ceiling; slow frames never progressively blur the picture.
export const HARDWARE_PIXEL_BUDGET = 8 * 1024 * 1024;
export function hardwareResolution(width, height, dpr = 1, maxDimension = 8192) {
  const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
  const native = Math.max(1, Number(dpr) || 1);
  const ratio = Math.min(native, Math.sqrt(HARDWARE_PIXEL_BUDGET / (w * h)), maxDimension / w, maxDimension / h);
  return { ratio, width: Math.floor(w * ratio), height: Math.floor(h * ratio) };
}
