import { finite } from '../utils';

export interface OdometerProps {
  /** Reading. The last drum shows tenths. */
  value: number;
  /** Number of drums, tenths included. */
  digits: number;
  /** Centre of the counter window. */
  x: number;
  y: number;
  /** Width of one drum. */
  digitWidth: number;
  /** Height of the window. */
  height: number;
  /** Clip-path id, unique per counter. */
  clipId: string;
  testId?: string;
}

/**
 * Drum positions for a mechanical counter. Drum 0 (rightmost, tenths) turns smoothly; each higher drum
 * stands still until every drum to its right reads 9, then rolls over with them (a Geneva drive).
 * Position `p` means the drum shows digit `p`, partly rolled towards `p + 1`; `10` is the extra 0 at the bottom of the drum.
 */
export function drumPositions(value: number, digits: number): number[] {
  const n = Math.max(1, Math.floor(digits));
  const span = 10 ** n;
  const tenths = ((finite(value) * 10) % span + span) % span;
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return Math.round((tenths % 10) * 1000) / 1000;
    const unit = 10 ** i;
    const digit = Math.floor(tenths / unit) % 10;
    const below = tenths % unit;
    const carry = below > unit - 1 ? below - (unit - 1) : 0;
    return Math.round((digit + carry) * 1000) / 1000;
  });
}

/** Rolling-drum counter, as on an hour meter. The tenths drum is drawn white with black digits. */
export function Odometer({ value, digits, x, y, digitWidth, height, clipId, testId = 'odometer' }: OdometerProps) {
  const positions = drumPositions(value, digits);
  const n = positions.length;
  const left = x - (n * digitWidth) / 2;
  const top = y - height / 2;
  const fontSize = height * 0.72;
  return (
    <g data-testid={testId}>
      <defs>
        <clipPath id={clipId}>
          <rect x={left} y={top} width={n * digitWidth} height={height} />
        </clipPath>
      </defs>
      <rect x={left - 4} y={top - 4} width={n * digitWidth + 8} height={height + 8} rx="3" fill="#000" stroke="#555" strokeWidth="2" />
      <g clipPath={`url(#${clipId})`}>
        {positions.map((p, k) => {
          // positions[0] is the rightmost drum.
          const i = n - 1 - k;
          const dx = left + i * digitWidth;
          const tenths = k === 0;
          return (
            <g key={k}>
              <rect x={dx + 1} y={top} width={digitWidth - 2} height={height} fill={tenths ? '#eee' : '#151515'} />
              <g data-testid={`${testId}-drum-${k}`} transform={`translate(0 ${Math.round(-p * height * 100) / 100})`}>
                {Array.from({ length: 11 }, (_, d) => (
                  <text
                    key={d}
                    x={dx + digitWidth / 2}
                    y={top + height / 2 + d * height}
                    fill={tenths ? '#111' : '#f2f2f2'}
                    fontSize={fontSize}
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {d % 10}
                  </text>
                ))}
              </g>
            </g>
          );
        })}
      </g>
      {/* Shading at the top and bottom of the window gives the drums some depth. */}
      <rect x={left} y={top} width={n * digitWidth} height={height * 0.18} fill="#000" opacity="0.35" pointerEvents="none" />
      <rect x={left} y={top + height * 0.82} width={n * digitWidth} height={height * 0.18} fill="#000" opacity="0.35" pointerEvents="none" />
    </g>
  );
}
