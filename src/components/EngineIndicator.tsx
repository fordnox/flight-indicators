import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** A scaled gauge: where the value sits between `min` and `max`, and which bands are coloured. */
export interface EngineGauge {
  value?: number;
  /** Bottom of the scale. Default `0`. */
  min?: number;
  /** Top of the scale. Default `100`. */
  max?: number;
  /** Normal operating band `[from, to]`, drawn green. */
  green?: [number, number];
  /** Caution band `[from, to]`, drawn yellow. */
  yellow?: [number, number];
  /** Values at or below this are red (the scale from `min` to `low` is drawn red). */
  low?: number;
  /** Values at or above this are red (the scale from `high` to `max` is drawn red). */
  high?: number;
  /** Unit printed next to the readout. */
  unit?: string;
  /** Decimal places in the readout. Default `0`. */
  decimals?: number;
}

/** A horizontal bar gauge on the right-hand side of the display. */
export interface EngineBarGauge extends EngineGauge {
  /** Caption under the bar, e.g. `"Oil P"`. */
  label: string;
}

export interface EngineIndicatorProps extends InstrumentProps {
  /** Percent power printed at the top. */
  power?: number;
  /** Manifold pressure arc gauge. Defaults to a 10–35 inHg scale. */
  manifold?: EngineGauge;
  /** Engine speed arc gauge. Defaults to a 0–3000 RPM scale. */
  rpm?: EngineGauge;
  /** Cylinder head temperature per cylinder, up to `MAX_CYLINDERS`. */
  cht?: number[];
  /** Exhaust gas temperature per cylinder, up to `MAX_CYLINDERS`. */
  egt?: number[];
  /** Turbine inlet temperature, drawn as the `T` column. Omit to hide it. */
  tit?: number;
  /** CHT at which the red dashed limit line is drawn. Default `400`. */
  chtLimit?: number;
  /** CHT that fills the bar graph to the top. Default `500`. */
  chtScale?: number;
  /** EGT (and TIT) that fills the bar graph to the top. Default `1700`. */
  egtScale?: number;
  /** Temperature unit printed after CHT/EGT/TIT. Default `"°F"`. */
  temperatureUnit?: string;
  /** Horizontal bar gauges, top to bottom, up to `MAX_BAR_GAUGES`. Defaults to oil pressure, oil temperature, fuel pressure and fuel flow. */
  gauges?: EngineBarGauge[];
  /** Alternator current in amps. */
  amps?: number;
  /** Bus voltage. */
  volts?: number;
  /** Fuel in the left tank. */
  fuelLeft?: number;
  /** Fuel in the right tank. */
  fuelRight?: number;
  /** Full quantity of each tank, used to fill the tank icons. Default `30`. */
  fuelCapacity?: number;
  /** Fuel unit printed under the quantities. Default `"GAL"`. */
  fuelUnit?: string;
}

export const MAX_CYLINDERS = 6;
export const MAX_BAR_GAUGES = 4;

const GREEN = '#5fe04a';
const YELLOW = '#ffd400';
const RED = '#ff3030';
const BLUE = '#4fb7e8';
const LABEL = '#b9c8e6';
const LINE = '#8a8f99';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Full-width horizontal line at `y`, cut to fit inside the dial face (radius 182) with a small inset. */
const DIAL_R = 182;
function chord(y: number, inset = 8): string {
  const half = Math.sqrt(Math.max(0, DIAL_R * DIAL_R - (y - CENTER) ** 2)) - inset;
  return `M ${round2(CENTER - half)} ${y} H ${round2(CENTER + half)}`;
}

export const DEFAULT_MANIFOLD: EngineGauge = { min: 10, max: 35, green: [15, 29], yellow: [29, 31], high: 31, unit: 'IN', decimals: 1 };
export const DEFAULT_RPM: EngineGauge = { min: 0, max: 3000, green: [800, 2500], yellow: [2500, 2700], high: 2700, decimals: 0 };
export const DEFAULT_BAR_GAUGES: EngineBarGauge[] = [
  { label: 'Oil P', min: 0, max: 100, green: [30, 60], low: 10, high: 95, unit: 'PSI' },
  { label: 'Oil T', min: 0, max: 250, green: [75, 240], high: 240, unit: '°F' },
  { label: 'Fuel P', min: 0, max: 30, low: 1, high: 28, unit: 'PSI', decimals: 1 },
  { label: 'Fuel F', min: 0, max: 30, green: [8, 20], unit: 'GPH', decimals: 1 },
];

interface Resolved {
  value: number;
  min: number;
  max: number;
  fraction: number;
  color: string;
  text: string;
  unit?: string;
  green?: [number, number];
  yellow?: [number, number];
  low?: number;
  high?: number;
}

function resolve(g: EngineGauge, defaults: EngineGauge = {}): Resolved {
  const min = finite(g.min, finite(defaults.min, 0));
  const max = Math.max(min + 1e-9, finite(g.max, finite(defaults.max, 100)));
  const value = clamp(finite(g.value), min, max);
  const fraction = (value - min) / (max - min);
  const decimals = Math.max(0, Math.floor(finite(g.decimals, finite(defaults.decimals, 0))));
  const low = g.low ?? defaults.low;
  const high = g.high ?? defaults.high;
  const yellow = g.yellow ?? defaults.yellow;
  const inRed = (low !== undefined && value <= low) || (high !== undefined && value >= high);
  const inYellow = yellow !== undefined && value >= yellow[0] && value <= yellow[1];
  return {
    value,
    min,
    max,
    fraction,
    color: inRed ? RED : inYellow ? YELLOW : '#fff',
    text: value.toFixed(decimals),
    unit: g.unit ?? defaults.unit,
    green: g.green ?? defaults.green,
    yellow,
    low,
    high,
  };
}

/* ---------- Top: arc gauges ---------- */

const ARC_R = 46;
const ARC_SWEEP = 100; // degrees either side of 12 o'clock
const ARC_Y = 112;

function arcAt(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(r, a0, cx, cy);
  const [x1, y1] = polar(r, a1, cx, cy);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function ArcGauge({ cx, label, g, duration, testId }: { cx: number; label: string; g: Resolved; duration: number; testId: string }) {
  const span = g.max - g.min;
  const angle = (v: number) => round2(-ARC_SWEEP + 2 * ARC_SWEEP * clamp((v - g.min) / span, 0, 1));
  const band = (from: number, to: number, color: string) => (
    <path d={arcAt(cx, ARC_Y, ARC_R, angle(from), angle(to))} stroke={color} strokeWidth="6" fill="none" />
  );
  const [tipX, tipY] = polar(ARC_R - 4, 0, cx, ARC_Y);
  const [lx, ly] = polar(ARC_R - 16, -7, cx, ARC_Y);
  const [rx, ry] = polar(ARC_R - 16, 7, cx, ARC_Y);
  return (
    <g>
      <path d={arcAt(cx, ARC_Y, ARC_R, -ARC_SWEEP, ARC_SWEEP)} stroke="#fff" strokeWidth="1.5" fill="none" />
      {g.green && band(g.green[0], g.green[1], GREEN)}
      {g.yellow && band(g.yellow[0], g.yellow[1], YELLOW)}
      {g.low !== undefined && band(g.min, g.low, RED)}
      {g.high !== undefined && band(g.high, g.max, RED)}
      <g data-testid={testId} style={motionStyle(`rotate(${angle(g.value)}deg)`, duration, cx, ARC_Y)}>
        <path d={`M ${tipX} ${tipY} L ${lx} ${ly} L ${rx} ${ry} Z`} fill="#fff" stroke="#000" strokeWidth="1" />
      </g>
      <text x={cx} y={ARC_Y - 20} fill={LABEL} fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
      <text x={cx} y={ARC_Y + 4} fill={g.color} fontSize="28" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        {g.text}
        {g.unit && (
          <tspan fontSize="11" dx="2">
            {g.unit}
          </tspan>
        )}
      </text>
    </g>
  );
}

/* ---------- Right: horizontal bar gauges ---------- */

const BAR_X0 = 210;
const BAR_X1 = 296;
const BAR_ROW_H = 39;
const BAR_TOP = 137;

function BarGauge({ top, g, label, duration, testId }: { top: number; g: Resolved; label: string; duration: number; testId: string }) {
  const y = top + 14;
  const at = (v: number) => round2(BAR_X0 + (BAR_X1 - BAR_X0) * clamp((v - g.min) / (g.max - g.min), 0, 1));
  const seg = (from: number, to: number, color: string, w = 7) => <path d={`M ${at(from)} ${y} H ${at(to)}`} stroke={color} strokeWidth={w} />;
  return (
    <g>
      <path d={`M ${BAR_X0} ${y} H ${BAR_X1}`} stroke="#fff" strokeWidth="2" />
      <path d={`M ${BAR_X0} ${y - 4} v 8 M ${BAR_X1} ${y - 4} v 8`} stroke="#fff" strokeWidth="2" />
      {g.green && seg(g.green[0], g.green[1], GREEN)}
      {g.yellow && seg(g.yellow[0], g.yellow[1], YELLOW)}
      {g.low !== undefined && seg(g.min, g.low, RED)}
      {g.high !== undefined && seg(g.high, g.max, RED)}
      <g data-testid={testId} style={motionStyle(`translate(${round2(at(g.value) - BAR_X0)}px, 0px)`, duration)}>
        <path d={`M ${BAR_X0} ${y - 3} l -5 -9 h 10 z`} fill="#fff" stroke="#000" strokeWidth="1" />
      </g>
      <text x={BAR_X0} y={top + 31} fill={LABEL} fontSize="13" fontWeight="bold" dominantBaseline="central">
        {label}
      </text>
      <text x={350} y={top + 15} fill={g.color} fontSize="20" fontWeight="bold" textAnchor="end" dominantBaseline="central">
        {g.text}
      </text>
      {g.unit && (
        <text x={350} y={top + 31} fill={LABEL} fontSize="10" fontWeight="bold" textAnchor="end" dominantBaseline="central">
          {g.unit}
        </text>
      )}
    </g>
  );
}

/* ---------- Bottom: fuel tank icon ---------- */

function Tank({ x, fraction, duration, testId }: { x: number; fraction: number; duration: number; testId: string }) {
  const top = 304;
  const h = 40;
  return (
    <g>
      <rect x={x - 7} y={top} width="14" height={h} rx="3" fill="#000" stroke="#fff" strokeWidth="1.5" />
      <g data-testid={testId} style={motionStyle(`scaleY(${fraction})`, duration, x, top + h - 2)}>
        <rect x={x - 5.5} y={top + 2} width="11" height={h - 4} fill={BLUE} />
      </g>
      <rect x={x - 5.5} y={top + h - 5} width="11" height="3" fill={RED} />
    </g>
  );
}

/* ---------- The instrument ---------- */

const hottest = (values: number[]): number | undefined => {
  const finite_ = values.map((v) => finite(v, NaN)).filter((v) => !Number.isNaN(v));
  return finite_.length ? Math.max(...finite_) : undefined;
};

export function EngineIndicator({
  power,
  manifold = {},
  rpm = {},
  cht = [],
  egt = [],
  tit,
  chtLimit = 400,
  chtScale = 500,
  egtScale = 1700,
  temperatureUnit = '°F',
  gauges = DEFAULT_BAR_GAUGES,
  amps,
  volts,
  fuelLeft,
  fuelRight,
  fuelCapacity = 30,
  fuelUnit = 'GAL',
  ...props
}: EngineIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const man = resolve(manifold, DEFAULT_MANIFOLD);
  const speed = resolve(rpm, DEFAULT_RPM);
  const bars = gauges.slice(0, MAX_BAR_GAUGES).map((g) => ({ label: g.label, g: resolve(g) }));

  const chtValues = cht.slice(0, MAX_CYLINDERS);
  const egtValues = egt.slice(0, MAX_CYLINDERS);
  const cylinders = Math.max(chtValues.length, egtValues.length);
  const hasTit = typeof tit === 'number' && Number.isFinite(tit);
  const columns = cylinders + (hasTit ? 1 : 0);
  const chtMax = hottest(chtValues);
  const egtMax = hottest(egtValues);

  // Bar graph geometry (left-middle section).
  const chartX0 = 50;
  const chartX1 = 192;
  const chartBase = 284;
  const chartH = 88;
  const colW = columns > 0 ? (chartX1 - chartX0) / columns : 0;
  const barW = clamp(colW * 0.35, 4, 9);
  const chtFrac = (v: number) => clamp(finite(v) / Math.max(1e-9, finite(chtScale, 500)), 0, 1);
  const egtFrac = (v: number) => clamp(finite(v) / Math.max(1e-9, finite(egtScale, 1700)), 0, 1);
  const limitY = chartBase - chartH * chtFrac(chtLimit);

  const cap = Math.max(1e-9, finite(fuelCapacity, 30));
  const left = clamp(finite(fuelLeft), 0, cap);
  const right = clamp(finite(fuelRight), 0, cap);
  const fmt = (v: number | undefined, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '---');

  const readouts = [
    { name: 'CHT', value: chtMax, color: GREEN, x: 62 },
    { name: 'EGT', value: egtMax, color: BLUE, x: 118 },
    { name: 'TIT', value: hasTit ? tit : undefined, color: '#fff', x: 170 },
  ].filter((r): r is { name: string; value: number; color: string; x: number } => r.value !== undefined);

  const label =
    'Engine: ' +
    [
      power !== undefined ? `power ${fmt(power)}%` : null,
      `MAN ${man.text}${man.unit ? ` ${man.unit}` : ''}`,
      `RPM ${speed.text}`,
      chtMax !== undefined ? `CHT ${fmt(chtMax)}${temperatureUnit}` : null,
      egtMax !== undefined ? `EGT ${fmt(egtMax)}${temperatureUnit}` : null,
      hasTit ? `TIT ${fmt(tit)}${temperatureUnit}` : null,
      ...bars.map((b) => `${b.label} ${b.g.text}${b.g.unit ? ` ${b.g.unit}` : ''}`),
      amps !== undefined ? `${fmt(amps)} A` : null,
      fuelLeft !== undefined || fuelRight !== undefined ? `fuel ${fmt(fuelLeft)}/${fmt(fuelRight)} ${fuelUnit}` : null,
      volts !== undefined ? `${fmt(volts, 1)} V` : null,
    ]
      .filter(Boolean)
      .join(', ');

  return (
    <InstrumentFrame {...props} label={label}>
      {/* Top: power and the two arc gauges. */}
      {power !== undefined && (
        <text x={CENTER} y={44} fill="#fff" fontSize="18" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          <tspan fill={LABEL} fontSize="11">
            POWER{' '}
          </tspan>
          {fmt(power)}
          <tspan fontSize="11">%</tspan>
        </text>
      )}
      <ArcGauge cx={118} label="MAN" g={man} duration={duration} testId="engine-man" />
      <ArcGauge cx={282} label="RPM" g={speed} duration={duration} testId="engine-rpm" />

      {/* Section dividers. */}
      <g stroke={LINE} strokeWidth="1.5">
        <path d={chord(133)} />
        <path d="M 200 133 V 298" />
        <path d={chord(298)} />
        <path d="M 136 298 V 348 M 264 298 V 348" />
      </g>

      {/* Left-middle: hottest CHT/EGT/TIT and per-cylinder bar graph. */}
      <g fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        {readouts.map((r) => (
          <g key={r.name}>
            <text x={r.x} y={144} fill={LABEL} fontSize="13">
              {r.name}
              <tspan fontSize="9">{temperatureUnit}</tspan>
            </text>
            <text data-testid={`engine-${r.name.toLowerCase()}`} x={r.x} y={165} fill={r.color} fontSize="22">
              {fmt(r.value)}
            </text>
          </g>
        ))}
      </g>
      <path d="M 40 178 H 190" stroke={LINE} strokeWidth="1" />

      {columns > 0 && (
        <g>
          <path d={`M ${chartX0} ${limitY} H ${chartX1}`} stroke={RED} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={chartX0 - 4} y={limitY} fill="#fff" fontSize="10" fontWeight="bold" textAnchor="end" dominantBaseline="central">
            CHT
          </text>
          {Array.from({ length: cylinders }, (_, i) => {
            const x0 = chartX0 + colW * i;
            const mid = x0 + colW / 2;
            const c = chtValues[i];
            const e = egtValues[i];
            return (
              <g key={i}>
                {c !== undefined && (
                  <g data-testid={`engine-cht-${i}`} style={motionStyle(`scaleY(${chtFrac(c)})`, duration, mid, chartBase)}>
                    <rect x={mid - barW - 1} y={chartBase - chartH} width={barW} height={chartH} fill={GREEN} />
                  </g>
                )}
                {e !== undefined && (
                  <g data-testid={`engine-egt-${i}`} style={motionStyle(`scaleY(${egtFrac(e)})`, duration, mid, chartBase)}>
                    <rect x={mid + 1} y={chartBase - chartH} width={barW} height={chartH} fill={BLUE} />
                  </g>
                )}
                <text x={mid} y={294} fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                  {i + 1}
                </text>
              </g>
            );
          })}
          {hasTit && (
            <g>
              <g data-testid="engine-tit-bar" style={motionStyle(`scaleY(${egtFrac(tit)})`, duration, chartX1 - colW / 2, chartBase)}>
                <rect x={chartX1 - colW / 2 - barW / 2} y={chartBase - chartH} width={barW} height={chartH} fill="#fff" />
              </g>
              <text x={chartX1 - colW / 2} y={294} fill="#fff" fontSize="12" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                T
              </text>
            </g>
          )}
        </g>
      )}

      {/* Right-middle: horizontal bar gauges. */}
      {bars.map((b, i) => (
        <g key={b.label}>
          {i > 0 && <path d={`M 206 ${BAR_TOP + BAR_ROW_H * i - 2} H 352`} stroke={LINE} strokeWidth="1" />}
          <BarGauge top={BAR_TOP + BAR_ROW_H * i} g={b.g} label={b.label} duration={duration} testId={`engine-bar-${i}`} />
        </g>
      ))}

      {/* Bottom: alternator, fuel tanks, battery. */}
      <g fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        <text data-testid="engine-amps" x={104} y={318} fill="#fff" fontSize="20">
          {fmt(amps)}
          <tspan fontSize="11" dx="2">
            A
          </tspan>
        </text>
        <text x={104} y={338} fill={LABEL} fontSize="13">
          ALT
        </text>

        <Tank x={152} fraction={left / cap} duration={duration} testId="engine-fuel-left" />
        <Tank x={248} fraction={right / cap} duration={duration} testId="engine-fuel-right" />
        <text data-testid="engine-fuel" x={200} y={316} fill="#fff" fontSize="20">
          {fmt(left)}
          <tspan dx="14">{fmt(right)}</tspan>
        </text>
        <text x={200} y={335} fill={LABEL} fontSize="13">
          Fuel
        </text>
        <text x={200} y={348} fill={LABEL} fontSize="9">
          {fuelUnit}
        </text>

        <text data-testid="engine-volts" x={296} y={318} fill="#fff" fontSize="20">
          {fmt(volts, 1)}
          <tspan fontSize="11" dx="2">
            V
          </tspan>
        </text>
        <text x={296} y={338} fill={LABEL} fontSize="13">
          BATT
        </text>
      </g>
    </InstrumentFrame>
  );
}
