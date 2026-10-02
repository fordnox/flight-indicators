import { CENTER, DEFAULT_ANIMATION_MS, arcPath, clamp, finite, motionStyle, polar, range, tickPath } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';

export interface AirspeedArcs {
  /** Flap operating range [Vs0, Vfe]. */
  white?: [number, number];
  /** Normal operating range [Vs1, Vno]. */
  green?: [number, number];
  /** Caution range [Vno, Vne]. */
  yellow?: [number, number];
  /** Never-exceed speed (Vne). */
  red?: number;
}

export interface AirspeedProps extends InstrumentProps {
  /** Indicated airspeed in knots. Clamped to 0…`max`. */
  speed?: number;
  /** Top of the scale in knots. Default `200`. */
  max?: number;
  /** Coloured V-speed arcs. Defaults roughly match a Cessna 172. Pass `{}` to hide. */
  arcs?: AirspeedArcs;
  /** Unit text printed on the dial. Default `"KNOTS"`. */
  unit?: string;
}

const SWEEP = 320;
const DEFAULT_ARCS: AirspeedArcs = { white: [33, 85], green: [44, 129], yellow: [129, 163], red: 163 };

function labelStep(max: number): number {
  const raw = max / 10;
  const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500];
  return steps.find((s) => s >= raw) ?? Math.ceil(raw / 100) * 100;
}

export function Airspeed({ speed = 0, max = 200, arcs = DEFAULT_ARCS, unit = 'KNOTS', ...props }: AirspeedProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const safeMax = Math.max(1, finite(max, 200));
  const safeSpeed = clamp(finite(speed), 0, safeMax);
  const angle = (v: number) => (clamp(v, 0, safeMax) / safeMax) * SWEEP;

  const step = labelStep(safeMax);
  const minor = step / (step % 4 === 0 ? 4 : 5);

  return (
    <InstrumentFrame {...props} label={`Airspeed indicator: ${Math.round(safeSpeed)} ${unit.toLowerCase()}`}>
      <g fill="none">
        {arcs.white && <path d={arcPath(150, angle(arcs.white[0]), angle(arcs.white[1]))} stroke="#fff" strokeWidth="8" />}
        {arcs.green && <path d={arcPath(166, angle(arcs.green[0]), angle(arcs.green[1]))} stroke="#2fb54a" strokeWidth="12" />}
        {arcs.yellow && <path d={arcPath(166, angle(arcs.yellow[0]), angle(arcs.yellow[1]))} stroke="#f2c200" strokeWidth="12" />}
        {arcs.red !== undefined && <path d={tickPath(178, 146, angle(arcs.red))} stroke="#e02020" strokeWidth="6" />}
      </g>

      <g stroke="#fff" strokeLinecap="round">
        {range(0, safeMax, minor).map((v) => {
          const major = Math.abs(v % step) < 1e-9;
          return <path key={v} d={tickPath(178, major ? 150 : 162, angle(v))} strokeWidth={major ? 3 : 2} />;
        })}
      </g>
      {range(0, safeMax, step).map((v) => {
        const [x, y] = polar(124, angle(v));
        return (
          <text key={v} x={x} y={y} fill="#fff" fontSize="24" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {v}
          </text>
        );
      })}

      <text x={CENTER} y={CENTER - 42} fill="#ccc" fontSize="18" textAnchor="middle">AIRSPEED</text>
      <text x={CENTER} y={CENTER + 56} fill="#ccc" fontSize="16" textAnchor="middle">{unit}</text>

      <g data-testid="airspeed-needle" style={motionStyle(`rotate(${angle(safeSpeed)}deg)`, duration)}>
        <path d={`M ${CENTER - 5} ${CENTER + 30} L ${CENTER - 4} ${CENTER - 140} L ${CENTER} ${CENTER - 165} L ${CENTER + 4} ${CENTER - 140} L ${CENTER + 5} ${CENTER + 30} Z`} fill="#fff" />
      </g>
      <Hub />
    </InstrumentFrame>
  );
}
