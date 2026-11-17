// Full HD for the actual Blender picture, or native density when sharper.
// Resolution stays independent of frame timing; allocations remain bounded.
export const HARDWARE_PIXEL_BUDGET = 8 * 1024 * 1024;
export function hardwareResolution(width, height, dpr = 1, maxDimension = 8192, pictureWidth, pictureHeight) {
  const w = Math.max(1, Number(width) || 1), h = Math.max(1, Number(height) || 1);
  const native = Math.max(1, Number(dpr) || 1);
  const fittedWidth = Math.min(w, h * 16 / 9), fittedHeight = fittedWidth * 9 / 16;
  const fw = Math.max(1, Number(pictureWidth) || fittedWidth), fh = Math.max(1, Number(pictureHeight) || fittedHeight);
  const minimum = Math.max(1920 / fw, 1080 / fh);
  const requested = Math.max(native, minimum * (1 + 1e-10));
  const ratio = Math.min(requested, Math.sqrt(HARDWARE_PIXEL_BUDGET / (w * h)), maxDimension / w, maxDimension / h);
  return { ratio, width: Math.floor(w * ratio), height: Math.floor(h * ratio) };
}
