import { CENTER, DEFAULT_ANIMATION_MS, arcPath, clamp, finite, motionStyle, polar, tickPath } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** One half of a dual-needle gauge: its scale, coloured bands and current value. */
export interface DualGaugeScale {
  value?: number;
  /** Bottom of the scale. Default `0`. */
  min?: number;
  /** Top of the scale. Default `100`. */
  max?: number;
  /** Caption at the top of this half, e.g. `"OIL PRESS"` or `"L"`. */
  label?: string;
  /** Unit printed at the bottom of this half, e.g. `"PSI"`. */
  unit?: string;
  /** Numbered scale marks. A number is printed as is; `{ value, text }` prints `text` at `value`. Default: `min` and `max`. Pass `[]` for an unnumbered scale. */
  marks?: Array<number | { value: number; text: string }>;
  /** Number of minor tick intervals between `min` and `max`. Default `10`. Marks get a longer tick of their own. */
  ticks?: number;
  /** Normal operating band `[from, to]`, drawn green. */
  green?: [number, number];
  /** Caution band `[from, to]`, drawn yellow. */
  yellow?: [number, number];
  /** Low limit, drawn as a red radial line. */
  low?: number;
  /** High limit, drawn as a red radial line. */
  high?: number;
  /** Decimal places in the accessible label. Default `0`. */
  decimals?: number;
}

export interface DualGaugeProps extends InstrumentProps {
  /** Scale and needle on the left half. The needle pivots at the left edge of the dial. */
  left?: DualGaugeScale;
  /** Scale and needle on the right half. The needle pivots at the right edge of the dial. */
  right?: DualGaugeScale;
  /** Caption across the top of the dial, e.g. `"FUEL QTY"`. */
  label?: string;
  /** Second caption across the bottom of the dial, e.g. `"GALLONS"`. */
  sublabel?: string;
}

const GREEN = '#2fb54a';
const YELLOW = '#f2c200';
const RED = '#e02020';
/** Half of the needle sweep in degrees; each needle swings 2 × SWEEP. */
const SWEEP = 56;
const PIVOT_OFFSET = 130;
const R = 118;

type Side = -1 | 1;

const pivotX = (side: Side): number => CENTER + side * PIVOT_OFFSET;

/** Needle angle (clockwise from 12 o'clock) for `fraction` of the scale. Both scales read up: min at the bottom, max at the top. */
const angleAt = (side: Side, fraction: number): number => (side < 0 ? 90 + SWEEP - fraction * 2 * SWEEP : 270 - SWEEP + fraction * 2 * SWEEP);

const round2 = (n: number): number => Math.round(n * 100) / 100;

function resolve(scale: DualGaugeScale | undefined) {
  const min = finite(scale?.min, 0);
  const rawMax = finite(scale?.max, 100);
  const max = rawMax > min ? rawMax : min + 1;
  const value = clamp(finite(scale?.value, min), min, max);
  return { ...scale, min, max, value };
}

function Half({ side, scale, duration }: { side: Side; scale: ReturnType<typeof resolve>; duration: number }) {
  const px = pivotX(side);
  const frac = (v: number) => (clamp(v, scale.min, scale.max) - scale.min) / (scale.max - scale.min);
  const deg = (v: number) => angleAt(side, frac(v));
  const band = (b: [number, number] | undefined, color: string, key: string) => {
    if (!b) return null;
    const a = Math.min(deg(b[0]), deg(b[1]));
    const c = Math.max(deg(b[0]), deg(b[1]));
    return <path key={key} d={arcPath(R - 5, a, c, px, CENTER)} stroke={color} strokeWidth="10" fill="none" />;
  };
  const ticks = Math.max(1, Math.round(finite(scale.ticks, 10)));
  const marks = (scale.marks ?? [scale.min, scale.max]).map((m) => (typeof m === 'number' ? { value: m, text: String(m) } : m));
  const labelX = CENTER + side * 76;

  return (
    <g data-testid={`dual-${side < 0 ? 'left' : 'right'}`}>
      {band(scale.green, GREEN, 'green')}
      {band(scale.yellow, YELLOW, 'yellow')}
      <g stroke="#fff" strokeLinecap="round">
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <path key={i} d={tickPath(R, R - 10, angleAt(side, i / ticks), px, CENTER)} strokeWidth="2" />
        ))}
        {marks.map(({ value }) => (
          <path key={value} d={tickPath(R, R - 18, deg(value), px, CENTER)} strokeWidth="3.5" />
        ))}
      </g>
      <g stroke={RED} strokeWidth="5">
        {[scale.low, scale.high].map((l, i) =>
          typeof l === 'number' && Number.isFinite(l) ? <path key={i} d={tickPath(R + 4, R - 20, deg(l), px, CENTER)} /> : null,
        )}
      </g>
      {marks.map(({ value, text }) => {
        const [x, y] = polar(R - 36, deg(value), px, CENTER);
        return (
          <text key={`${value}-${text}`} x={x} y={y} fill="#fff" fontSize="19" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {text}
          </text>
        );
      })}
      {scale.label && (
        <text x={labelX} y={CENTER - 116} fill="#ddd" fontSize={scale.label.length > 3 ? 15 : 22} fontWeight="bold" textAnchor="middle">
          {scale.label}
        </text>
      )}
      {scale.unit && (
        <text x={labelX} y={CENTER + 128} fill="#bbb" fontSize="14" textAnchor="middle">
          {scale.unit}
        </text>
      )}
      <g data-testid={`dual-${side < 0 ? 'left' : 'right'}-needle`} style={motionStyle(`rotate(${round2(deg(scale.value))}deg)`, duration, px, CENTER)}>
        <path d={`M ${px - 4} ${CENTER + 14} L ${px - 3} ${CENTER - R + 22} L ${px} ${CENTER - R + 6} L ${px + 3} ${CENTER - R + 22} L ${px + 4} ${CENTER + 14} Z`} fill="#fff" />
      </g>
      <circle cx={px} cy={CENTER} r="11" fill="#2a2a2a" stroke="#555" strokeWidth="2" />
    </g>
  );
}

const describe = (s: ReturnType<typeof resolve>, fallback: string): string =>
  `${s.label ?? fallback} ${s.value.toFixed(Math.max(0, Math.floor(finite(s.decimals, 0))))}${s.unit ? ` ${s.unit}` : ''}`;

/**
 * Small dual-needle engine gauge in the style of the Cessna 172 / 182 panel: two independent scales,
 * each with a needle pivoting at its own edge of the dial, so the two needles meet in the middle.
 * Both scales read upwards. Used for fuel quantity, oil temperature / pressure, vacuum / ammeter and so on;
 * see the preset gauges for ready-made scales.
 */
export function DualGauge({ left, right, label, sublabel, ...props }: DualGaugeProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const l = resolve(left);
  const r = resolve(right);
  const title = `${label ?? 'Gauge'}: ${describe(l, 'left')}, ${describe(r, 'right')}`;
  return (
    <InstrumentFrame {...props} label={title}>
      {label && (
        <text x={CENTER} y={CENTER - 146} fill="#eee" fontSize="17" fontWeight="bold" textAnchor="middle" letterSpacing="1">
          {label}
        </text>
      )}
      {sublabel && (
        <text x={CENTER} y={CENTER + 158} fill="#bbb" fontSize="14" textAnchor="middle" letterSpacing="1">
          {sublabel}
        </text>
      )}
      <Half side={-1} scale={l} duration={duration} />
      <Half side={1} scale={r} duration={duration} />
    </InstrumentFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Ready-made gauges with Cessna 182T style scales.                    */
/* ------------------------------------------------------------------ */

type ScaleOverride = Omit<DualGaugeScale, 'value'>;

interface PresetProps extends InstrumentProps {
  /** Overrides for the left scale (range, bands, marks, unit...). */
  leftScale?: ScaleOverride;
  /** Overrides for the right scale. */
  rightScale?: ScaleOverride;
}

export const FUEL_QUANTITY_SCALE: ScaleOverride = { min: 0, max: 44, marks: [0, 10, 20, 30, { value: 44, text: 'F' }], ticks: 11, yellow: [0, 5], low: 0, unit: 'GAL' };
export const OIL_TEMPERATURE_SCALE: ScaleOverride = { label: 'OIL TEMP', min: 75, max: 250, marks: [100, 150, 200, 250], ticks: 7, green: [100, 245], high: 245, unit: '°F' };
export const OIL_PRESSURE_SCALE: ScaleOverride = { label: 'OIL PRESS', min: 0, max: 115, marks: [0, 50, 100], ticks: 23, green: [50, 90], low: 20, high: 115, unit: 'PSI' };
export const VACUUM_SCALE: ScaleOverride = { label: 'VAC', min: 3, max: 7, marks: [3, 5, 7], ticks: 8, green: [4.5, 5.5], unit: 'IN HG', decimals: 1 };
export const AMMETER_SCALE: ScaleOverride = { label: 'AMP', min: -60, max: 60, marks: [{ value: -60, text: '−' }, 0, { value: 60, text: '+' }], ticks: 12, unit: 'AMPS' };
export const EGT_SCALE: ScaleOverride = { label: 'EGT', min: 1250, max: 1650, marks: [], ticks: 8, unit: '°F' };
export const FUEL_FLOW_SCALE: ScaleOverride = { label: 'FUEL FLOW', min: 0, max: 20, marks: [0, 10, 20], ticks: 10, green: [0, 17], unit: 'GAL/HR', decimals: 1 };
export const MANIFOLD_SCALE: ScaleOverride = { label: 'MAN PRESS', min: 10, max: 35, marks: [10, 20, 30], ticks: 25, green: [15, 23], unit: 'IN HG', decimals: 1 };

export interface FuelQuantityGaugeProps extends PresetProps {
  /** Fuel in the left tank. */
  leftQuantity?: number;
  /** Fuel in the right tank. */
  rightQuantity?: number;
}

/** Dual fuel quantity gauge: left tank on the left needle, right tank on the right. Default scale 0–44 gal with a yellow 0–5 band. */
export function FuelQuantityGauge({ leftQuantity, rightQuantity, leftScale, rightScale, ...props }: FuelQuantityGaugeProps) {
  return (
    <DualGauge
      {...props}
      label="FUEL QTY"
      left={{ ...FUEL_QUANTITY_SCALE, label: 'L', ...leftScale, value: leftQuantity }}
      right={{ ...FUEL_QUANTITY_SCALE, label: 'R', ...rightScale, value: rightQuantity }}
    />
  );
}

export interface OilGaugeProps extends PresetProps {
  /** Oil temperature, left needle. Default scale 75–250 °F. */
  temperature?: number;
  /** Oil pressure, right needle. Default scale 0–115 PSI. */
  pressure?: number;
}

/** Oil temperature (left) and oil pressure (right) dual gauge. */
export function OilGauge({ temperature, pressure, leftScale, rightScale, ...props }: OilGaugeProps) {
  return (
    <DualGauge
      {...props}
      label="OIL"
      left={{ ...OIL_TEMPERATURE_SCALE, ...leftScale, value: temperature }}
      right={{ ...OIL_PRESSURE_SCALE, ...rightScale, value: pressure }}
    />
  );
}

export interface VacuumAmmeterGaugeProps extends PresetProps {
  /** Vacuum (suction) in inHg, left needle. Default scale 3–7 with a green 4.5–5.5 band. */
  vacuum?: number;
  /** Alternator current in amps, right needle. Centre-zero scale −60…+60. */
  amps?: number;
}

/** Vacuum (suction) on the left and a centre-zero ammeter on the right. */
export function VacuumAmmeterGauge({ vacuum, amps, leftScale, rightScale, ...props }: VacuumAmmeterGaugeProps) {
  return (
    <DualGauge
      {...props}
      label="VAC / AMP"
      left={{ ...VACUUM_SCALE, ...leftScale, value: vacuum }}
      right={{ ...AMMETER_SCALE, ...rightScale, value: amps }}
    />
  );
}

export interface EgtFuelFlowGaugeProps extends PresetProps {
  /** Exhaust gas temperature, left needle. Unnumbered 1250–1650 °F scale, as EGT is read relative to peak. */
  egt?: number;
  /** Fuel flow in gallons per hour, right needle. Default scale 0–20. */
  fuelFlow?: number;
}

/** Exhaust gas temperature (left) and fuel flow (right) dual gauge. */
export function EgtFuelFlowGauge({ egt, fuelFlow, leftScale, rightScale, ...props }: EgtFuelFlowGaugeProps) {
  return (
    <DualGauge
      {...props}
      label="EGT / FF"
      left={{ ...EGT_SCALE, ...leftScale, value: egt }}
      right={{ ...FUEL_FLOW_SCALE, ...rightScale, value: fuelFlow }}
    />
  );
}

export interface ManifoldFuelFlowGaugeProps extends PresetProps {
  /** Manifold pressure in inHg, left needle. Default scale 10–35 with a green 15–23 band. */
  manifold?: number;
  /** Fuel flow in gallons per hour, right needle. Default scale 0–20. */
  fuelFlow?: number;
}

/** The constant-speed propeller panel's combined manifold pressure (left) and fuel flow (right) gauge. */
export function ManifoldFuelFlowGauge({ manifold, fuelFlow, leftScale, rightScale, ...props }: ManifoldFuelFlowGaugeProps) {
  return (
    <DualGauge
      {...props}
      label="MAP / FF"
      left={{ ...MANIFOLD_SCALE, ...leftScale, value: manifold }}
      right={{ ...FUEL_FLOW_SCALE, ...rightScale, value: fuelFlow }}
    />
  );
}
