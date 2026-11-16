// Sphere and copy share one angular coordinate. No clocks or entrance timers:
// moving back through an angle also winds its content back in.
export const clamp = value => Math.min(1, Math.max(0, value));
export const turnRate = height => Math.PI * 2 / (Math.max(480, height) * 2.4);
export const angleAt = (scroll, top, base, rate) => base + (scroll - top) * rate;
export const revealAt = (angle, start, end) => clamp((angle - start) / Math.max(.0001, end - start));
export function surfacePoint(angle, {x, y, radius}, mobile) {
  const latitude = Math.sin(angle * .72) * .24;
  return mobile
    ? {x: x + latitude * radius, y: y + Math.sqrt(1 - latitude * latitude) * radius * .91}
    : {x: x + Math.sqrt(1 - latitude * latitude) * radius * .72, y: y + latitude * radius};
}
export function emergePose(progress, fromX, fromY, mobile) {
  const p = clamp(progress), eased = p * p * (3 - 2 * p);
  const remaining = 1 - eased, arc = Math.sin(p * Math.PI);
  return {
    x: fromX * remaining + arc * (mobile ? 22 : 36),
    y: fromY * remaining - arc * (mobile ? 12 : 38),
    scale: .48 + .52 * eased,
    turn: (mobile ? 12 : -38) * remaining,
    roll: (mobile ? -5 : -7) * remaining,
    opacity: clamp(p / .22),
    trail: arc * remaining * 2.2
  };
}
