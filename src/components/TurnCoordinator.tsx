import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar, tickPath } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';

export interface TurnCoordinatorProps extends InstrumentProps {
  /** Rate of turn in degrees per second. Positive = right. 3°/s is a standard-rate (2 minute) turn. */
  turnRate?: number;
  /** Inclinometer ball deflection from -1 (full left) to 1 (full right). */
  slip?: number;
}

const STANDARD_RATE = 3;
/** Symbol bank (degrees) that lines the wings up with the standard-rate marks. */
const STANDARD_RATE_TILT = 20;
const MAX_TILT = 35;

/** The inclinometer tube is an arc of a circle centred above the dial. */
const TUBE_CY = 40;
const TUBE_R = 240;
const TUBE_SPAN = 16;
const BALL_TRAVEL = 13;

function tubePoint(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CENTER + TUBE_R * Math.sin(a), TUBE_CY + TUBE_R * Math.cos(a)];
}

export function TurnCoordinator({ turnRate = 0, slip = 0, ...props }: TurnCoordinatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const rate = finite(turnRate);
  const ball = clamp(finite(slip), -1, 1);
  const tilt = clamp((rate / STANDARD_RATE) * STANDARD_RATE_TILT, -MAX_TILT, MAX_TILT);

  const [tx1, ty1] = tubePoint(-TUBE_SPAN);
  const [tx2, ty2] = tubePoint(TUBE_SPAN);
  const wireOffset = 3.6;

  return (
    <InstrumentFrame {...props} label={`Turn coordinator: ${rate.toFixed(1)}° per second, slip ${ball.toFixed(2)}`}>
      {/* Wings-level and standard-rate reference marks. */}
      <g stroke="#fff" strokeWidth="6" strokeLinecap="round">
        {[-90 - STANDARD_RATE_TILT, -90, 90, 90 + STANDARD_RATE_TILT].map((a) => (
          <path key={a} d={tickPath(178, 150, a)} />
        ))}
      </g>
      <text {...xy(polar(128, -90 - STANDARD_RATE_TILT - 8))} fill="#fff" fontSize="26" fontWeight="bold" textAnchor="middle" dominantBaseline="central">L</text>
      <text {...xy(polar(128, 90 + STANDARD_RATE_TILT + 8))} fill="#fff" fontSize="26" fontWeight="bold" textAnchor="middle" dominantBaseline="central">R</text>
      <text x={CENTER} y={CENTER - 92} fill="#ccc" fontSize="16" textAnchor="middle">TURN COORDINATOR</text>
      <text x={CENTER} y={CENTER + 130} fill="#ccc" fontSize="16" textAnchor="middle">2 MIN</text>
      <text x={CENTER} y={CENTER + 150} fill="#999" fontSize="10" textAnchor="middle">NO PITCH INFORMATION</text>

      {/* Inclinometer */}
      <path
        d={`M ${tx1} ${ty1} A ${TUBE_R} ${TUBE_R} 0 0 0 ${tx2} ${ty2}`}
        fill="none"
        stroke="#dcdcdc"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <g stroke="#111" strokeWidth="3">
        {[-wireOffset, wireOffset].map((d) => {
          const [x1, y1] = tubePoint(d);
          return <path key={d} d={`M ${x1} ${y1 - 15} V ${y1 + 15}`} />;
        })}
      </g>
      <g data-testid="turn-ball" style={motionStyle(`rotate(${-ball * BALL_TRAVEL}deg)`, duration, CENTER, TUBE_CY)}>
        <circle cx={CENTER} cy={TUBE_CY + TUBE_R} r="13" fill="#111" />
      </g>

      {/* Miniature aircraft, rear view. */}
      <g data-testid="turn-aircraft" style={motionStyle(`rotate(${tilt}deg)`, duration)}>
        <path d={`M ${CENTER - 140} ${CENTER} H ${CENTER + 140}`} stroke="#fff" strokeWidth="10" strokeLinecap="round" />
        <path d={`M ${CENTER} ${CENTER} V ${CENTER - 40}`} stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <path d={`M ${CENTER - 30} ${CENTER - 8} H ${CENTER + 30}`} stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <circle cx={CENTER} cy={CENTER} r="18" fill="#fff" />
      </g>
      <Hub r={8} />
    </InstrumentFrame>
  );
}

const xy = ([x, y]: [number, number]) => ({ x, y });
