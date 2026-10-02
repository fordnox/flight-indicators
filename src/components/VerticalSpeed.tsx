import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar, range, tickPath } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';

export interface VerticalSpeedProps extends InstrumentProps {
  /** Vertical speed in feet per minute. Positive = climb. Clamped to ±`max`. */
  verticalSpeed?: number;
  /** Full-scale value in ft/min. Default `2000`. */
  max?: number;
}

/** Degrees of needle travel either side of zero (zero is at 9 o'clock). */
const HALF_SWEEP = 170;

const formatThousands = (v: number): string => {
  const s = String(Math.abs(v) / 1000);
  return s.startsWith('0.') ? s.slice(1) : s;
};

export function VerticalSpeed({ verticalSpeed = 0, max = 2000, ...props }: VerticalSpeedProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const safeMax = Math.max(100, Math.abs(finite(max, 2000)));
  const vs = clamp(finite(verticalSpeed), -safeMax, safeMax);
  const angle = (v: number) => -90 + (v / safeMax) * HALF_SWEEP;

  const step = safeMax <= 2000 ? 500 : 1000;
  const minor = step / 5;

  return (
    <InstrumentFrame {...props} label={`Vertical speed indicator: ${Math.round(vs)} feet per minute`}>
      <g stroke="#fff" strokeLinecap="round">
        {range(-safeMax, safeMax, minor).map((v) => {
          const major = Math.abs(v % step) < 1e-9;
          return <path key={v} d={tickPath(178, major ? 150 : 164, angle(v))} strokeWidth={major ? 4 : 2} />;
        })}
      </g>
      {range(-safeMax, safeMax, step).map((v) => {
        const [x, y] = polar(124, angle(v));
        return (
          <text key={v} x={x} y={y} fill="#fff" fontSize="28" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {v === 0 ? '0' : formatThousands(v)}
          </text>
        );
      })}

      <text x={CENTER - 80} y={CENTER - 40} fill="#ccc" fontSize="18" textAnchor="middle">UP</text>
      <text x={CENTER - 80} y={CENTER + 50} fill="#ccc" fontSize="18" textAnchor="middle">DN</text>
      <text x={CENTER + 10} y={CENTER - 75} fill="#ccc" fontSize="13" textAnchor="middle">VERTICAL SPEED</text>
      <text x={CENTER + 10} y={CENTER + 82} fill="#ccc" fontSize="12" textAnchor="middle">1000 FT PER MIN</text>

      <g data-testid="vsi-needle" style={motionStyle(`rotate(${angle(vs)}deg)`, duration)}>
        <path d={`M ${CENTER - 5} ${CENTER + 30} L ${CENTER - 4} ${CENTER - 140} L ${CENTER} ${CENTER - 165} L ${CENTER + 4} ${CENTER - 140} L ${CENTER + 5} ${CENTER + 30} Z`} fill="#fff" />
      </g>
      <Hub />
    </InstrumentFrame>
  );
}
