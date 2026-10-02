import { useEffect, useId, useRef, type CSSProperties } from 'react';

/** All instruments are drawn in a 400×400 viewBox centred on (200, 200). */
export const CENTER = 200;
export const DEFAULT_ANIMATION_MS = 300;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Returns `value` if it is a finite number, otherwise `fallback` (guards against NaN/undefined/Infinity). */
export const finite = (value: number | undefined | null, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const round = (n: number): number => Math.round(n * 100) / 100;

/** Point at radius `r` and angle `deg`, measured clockwise from 12 o'clock. */
export function polar(r: number, deg: number, cx = CENTER, cy = CENTER): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [round(cx + r * Math.sin(a)), round(cy - r * Math.cos(a))];
}

/** SVG path for an arc of radius `r` going clockwise from `startDeg` to `endDeg`. */
export function arcPath(r: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(r, startDeg);
  const [x2, y2] = polar(r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg >= startDeg ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

/** Radial tick line between radii `r1` and `r2` at angle `deg`. */
export function tickPath(r1: number, r2: number, deg: number): string {
  const [x1, y1] = polar(r1, deg);
  const [x2, y2] = polar(r2, deg);
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/** Inclusive numeric range. */
export function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(round(v));
  return out;
}

/** CSS transform style for an animated group; transform-origin is in viewBox units. */
export function motionStyle(
  transform: string,
  durationMs: number,
  originX = CENTER,
  originY = CENTER,
): CSSProperties {
  return {
    transform,
    transformOrigin: `${originX}px ${originY}px`,
    transformBox: 'view-box',
    transition: durationMs > 0 ? `transform ${durationMs}ms ease-out` : undefined,
  };
}

/**
 * Makes a cyclic angle continuous so CSS transitions take the shortest path.
 * Without this, going from 359° to 1° animates the long way round (358° backwards).
 */
export function useContinuousAngle(angle: number): number {
  const previous = useRef<number | null>(null);
  let next = angle;
  if (previous.current !== null) {
    const delta = ((((angle - previous.current) % 360) + 540) % 360) - 180;
    next = previous.current + delta;
  }
  useEffect(() => {
    previous.current = next;
  });
  return next;
}

/** useId() output sanitised for use in `url(#id)` references (React ids contain `:` or `«»`). */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
