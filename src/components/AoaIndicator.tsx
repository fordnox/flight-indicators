import { CENTER, clamp, finite } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export interface AoaIndicatorProps extends InstrumentProps {
  /** Current angle of attack in degrees. */
  aoa?: number;
  /** AoA at which the bottom bar lights, e.g. zero lift. Default `0`. */
  min?: number;
  /** Optimum AoA (approach / L/Dmax) at which the green donut lights. Default halfway between `min` and `max`. */
  optimum?: number;
  /** Critical (stall) AoA at which the top red chevron lights and the chevrons flash. Default `20`. */
  max?: number;
  /** Print the AoA in degrees under the display. Default `false`. */
  showValue?: boolean;
  /** Caption at the bottom of the dial. Default `"AOA"`. */
  label?: string;
}

const GREEN = '#3ddc3d';
const AMBER = '#ffb000';
const RED = '#ff2a2a';
const UNLIT_OPACITY = 0.15;

type Shape = 'bar' | 'donut' | 'split' | 'chevron';

/** Display rows from bottom (low AoA) to top (high AoA), as on a panel-mount LED AoA indicator. */
const ROWS: Array<{ shape: Shape; color: string; y: number }> = [
  { shape: 'bar', color: GREEN, y: 300 },
  { shape: 'bar', color: GREEN, y: 278 },
  { shape: 'bar', color: GREEN, y: 256 },
  { shape: 'bar', color: GREEN, y: 234 },
  { shape: 'donut', color: GREEN, y: 208 },
  { shape: 'bar', color: AMBER, y: 182 },
  { shape: 'split', color: AMBER, y: 160 },
  { shape: 'chevron', color: AMBER, y: 125 },
  { shape: 'chevron', color: AMBER, y: 103 },
  { shape: 'chevron', color: RED, y: 74 },
  { shape: 'chevron', color: RED, y: 52 },
];

/** Index of the donut row; rows below it span `min…optimum`, rows above span `optimum…max`. */
const DONUT = ROWS.findIndex((r) => r.shape === 'donut');
const ABOVE = ROWS.length - 1 - DONUT;

const HALF = 70;
const BAR_H = 12;
const CHEVRON_DEPTH = 26;

function RowShape({ shape, y }: { shape: Shape; y: number }) {
  const l = CENTER - HALF;
  const r = CENTER + HALF;
  switch (shape) {
    case 'bar':
      return <rect x={l} y={y - BAR_H / 2} width={HALF * 2} height={BAR_H} rx="2" />;
    case 'split':
      return (
        <>
          <rect x={l} y={y - BAR_H / 2} width={50} height={BAR_H} rx="2" />
          <rect x={r - 50} y={y - BAR_H / 2} width={50} height={BAR_H} rx="2" />
        </>
      );
    case 'donut':
      return (
        <>
          <rect x={l} y={y - BAR_H / 2} width={HALF - 24} height={BAR_H} rx="2" />
          <rect x={CENTER + 24} y={y - BAR_H / 2} width={HALF - 24} height={BAR_H} rx="2" />
          <circle cx={CENTER} cy={y} r={13} fill="none" strokeWidth="7" />
        </>
      );
    case 'chevron':
      return <path d={`M ${l} ${y} L ${CENTER} ${y + CHEVRON_DEPTH} L ${r} ${y}`} fill="none" strokeWidth="11" strokeLinejoin="miter" />;
  }
}

export function AoaIndicator({ aoa = 0, min = 0, optimum, max = 20, showValue = false, label = 'AOA', ...props }: AoaIndicatorProps) {
  const lo = finite(min, 0);
  const hi = Math.max(lo + 1e-6, finite(max, 20));
  const opt = clamp(finite(optimum, (lo + hi) / 2), lo, hi);
  const value = finite(aoa, NaN);

  // Lighting threshold for each row: evenly spaced below and above the donut.
  const thresholds = ROWS.map((_, i) => (i <= DONUT ? lo + (i / DONUT) * (opt - lo) : opt + ((i - DONUT) / ABOVE) * (hi - opt)));
  const lit = Number.isNaN(value) ? 0 : thresholds.filter((t) => value >= t - 1e-9).length;
  const stall = lit === ROWS.length;

  const reading = Number.isNaN(value) ? '---' : `${value.toFixed(1)}°`;
  const state = stall ? ' (stall warning)' : lit > DONUT + 1 ? ' (high)' : lit === DONUT + 1 ? ' (optimum)' : '';
  const title = `${label}: ${reading}${Number.isNaN(value) ? '' : state}`;

  return (
    <InstrumentFrame {...props} label={title}>
      <rect x={CENTER - HALF - 10} y={40} width={(HALF + 10) * 2} height={278} rx="10" fill="#000" stroke="#333" strokeWidth="1.5" />
      {ROWS.map((row, i) => {
        const on = i < lit;
        return (
          <g
            key={i}
            data-testid={`aoa-row-${i}`}
            data-lit={on ? 'true' : 'false'}
            fill={row.color}
            stroke={row.color}
            strokeWidth="0"
            opacity={on ? 1 : UNLIT_OPACITY}
            style={{ transition: 'opacity 150ms ease-out' }}
          >
            <RowShape shape={row.shape} y={row.y} />
            {on && stall && row.shape === 'chevron' && (
              <animate attributeName="opacity" values="1;0.25;1" dur="0.6s" repeatCount="indefinite" />
            )}
          </g>
        );
      })}

      {showValue && (
        <text data-testid="aoa-value" x={CENTER} y={340} fill="#fff" fontSize="18" fontWeight="bold" textAnchor="middle">
          {reading}
        </text>
      )}
      <text x={CENTER} y={showValue ? 362 : 345} fill="#ccc" fontSize="16" textAnchor="middle">
        {label.toUpperCase()}
      </text>
    </InstrumentFrame>
  );
}
