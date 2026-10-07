import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** One tank shown on a `FuelIndicator`. */
export interface FuelTank {
  /** Caption above the bar, e.g. `"LEFT"`. */
  name: string;
  /** Fuel on board, in `unit`. */
  quantity: number;
  /** Full-tank quantity. Defaults to the indicator's `capacity`. */
  capacity?: number;
}

export interface FuelIndicatorProps extends InstrumentProps {
  /** Tanks to show, left to right. At most `MAX_TANKS` (4) are drawn. */
  tanks?: FuelTank[];
  /** Default full-tank quantity for tanks without their own `capacity`. Default `50`. */
  capacity?: number;
  /** Unit printed under each readout and in the accessible label. Default `"gal"`. */
  unit?: string;
  /** Quantity at or below which a tank's bar and readout turn red. Default 10% of that tank's capacity. */
  low?: number;
  /** Decimal places in the readouts. Default `1`. */
  decimals?: number;
  /** Caption along the bottom of the display. Default `"FUEL"`. */
  label?: string;
}

export const MAX_TANKS = 4;

const GREEN = '#2ee05a';
const RED = '#ff3b3b';
const GREY = '#9aa4b1';

/** Square display inscribed in the dial. */
const SIDE = 252;
const PAD = 6;
const ORIGIN = CENTER - SIDE / 2;
const INNER_LEFT = ORIGIN + PAD;
const INNER_W = SIDE - PAD * 2;
const FOOTER_Y = ORIGIN + SIDE - 36;
const BAR_TOP = ORIGIN + 38;
const BAR_H = 114;
const BAR_BOTTOM = BAR_TOP + BAR_H;

const DEFAULT_TANKS: FuelTank[] = [
  { name: 'LEFT', quantity: 0 },
  { name: 'RIGHT', quantity: 0 },
];

export function FuelIndicator({
  tanks = DEFAULT_TANKS,
  capacity = 50,
  unit = 'gal',
  low,
  decimals = 1,
  label = 'FUEL',
  ...props
}: FuelIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const places = Math.max(0, Math.floor(finite(decimals, 1)));
  const shown = tanks.slice(0, MAX_TANKS);
  const cols = Math.max(1, shown.length);
  const colW = INNER_W / cols;
  const barW = clamp(colW / 8, 8, 16);
  const valueSize = Math.min(26, colW / 4.4);

  const readings = shown.map((t) => {
    const cap = Math.max(1e-9, finite(t.capacity, finite(capacity, 50)));
    const qty = clamp(finite(t.quantity), 0, cap);
    const fraction = qty / cap;
    const full = fraction >= 0.995;
    const isLow = qty <= finite(low, cap * 0.1);
    return { name: t.name, qty, cap, fraction, full, isLow, text: full ? 'FULL' : qty.toFixed(places) };
  });

  const title =
    `${label}: ` +
    (readings.length
      ? readings.map((r) => `${r.name} ${r.full ? 'full' : `${r.text} of ${r.cap.toFixed(places)} ${unit}`}${r.isLow ? ' (low)' : ''}`).join(', ')
      : 'no tanks');

  return (
    <InstrumentFrame {...props} label={title}>
      <rect x={ORIGIN} y={ORIGIN} width={SIDE} height={SIDE} rx="10" fill="#000" stroke="#3a3f47" strokeWidth="2" />

      {readings.map((r, i) => {
        const cx = INNER_LEFT + colW * (i + 0.5);
        const color = r.isLow ? RED : GREEN;
        const tickX = cx - barW / 2 - 14;
        return (
          <g key={i} data-testid={`fuel-tank-${i}`}>
            {i > 0 && <path d={`M ${INNER_LEFT + colW * i} ${ORIGIN + 10} V ${FOOTER_Y}`} stroke="#555" strokeWidth="1.5" />}
            <text x={cx} y={ORIGIN + 22} fill="#fff" fontSize={Math.min(17, colW / 5)} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
              {r.name.toUpperCase()}
            </text>

            {/* Scale: full mark green at the top, empty mark red at the bottom. */}
            <g strokeWidth="2.5" strokeLinecap="round">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <path
                  key={f}
                  d={`M ${tickX - 7} ${BAR_BOTTOM - f * BAR_H} h 7`}
                  stroke={f === 1 ? GREEN : f === 0 ? RED : GREY}
                />
              ))}
            </g>

            {/* Bar: a track with a fill scaled from the bottom. */}
            <rect x={cx - barW / 2} y={BAR_TOP} width={barW} height={BAR_H} fill="#15181c" />
            <g data-testid={`fuel-bar-${i}`} style={motionStyle(`scaleY(${r.fraction})`, duration, cx, BAR_BOTTOM)}>
              <rect x={cx - barW / 2} y={BAR_TOP} width={barW} height={BAR_H} fill={color} />
            </g>

            <text
              data-testid={`fuel-value-${i}`}
              x={cx}
              y={BAR_BOTTOM + 22}
              fill={r.isLow ? RED : '#fff'}
              fontSize={valueSize}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {r.text}
            </text>
            <text x={cx} y={BAR_BOTTOM + 44} fill="#fff" fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
              {unit}
            </text>
          </g>
        );
      })}

      {/* Footer caption. */}
      <path d={`M ${ORIGIN + 8} ${FOOTER_Y} H ${ORIGIN + SIDE - 8}`} stroke="#555" strokeWidth="1.5" />
      <text x={CENTER} y={FOOTER_Y + 19} fill="#fff" fontSize="24" fontWeight="bold" letterSpacing="2" textAnchor="middle" dominantBaseline="central">
        {label.toUpperCase()}
      </text>
    </InstrumentFrame>
  );
}
