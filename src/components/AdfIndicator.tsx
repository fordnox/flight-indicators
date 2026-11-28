import { CENTER, DEFAULT_ANIMATION_MS, finite, motionStyle, polar, range, tickPath, useContinuousAngle } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';

export interface AdfIndicatorProps extends InstrumentProps {
  /**
   * Relative bearing to the station in degrees, measured clockwise from the aircraft's nose.
   * `0` means the station is dead ahead, `90` off the right wing.
   */
  bearing?: number;
  /**
   * Heading set on the compass card, in degrees. Leave at `0` for a fixed-card ADF.
   * Pass the aircraft heading for a rotatable-card ADF / RMI, where the needle then reads
   * the magnetic bearing to the station directly.
   */
  heading?: number;
  /** `false` parks the needle at 90° and shows the red ADF flag. Default `true`. */
  signal?: boolean;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const AMBER = '#ffb000';
const NEEDLE = '#ffe14d';
/** Where the needle rests when no station is received. */
const PARKED_DEG = 90;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
const pad3 = (deg: number): string => String(Math.round(norm(deg)) % 360).padStart(3, '0');

/** Relative bearing (0–360°, clockwise from the nose) of a station that lies on `bearingToStation` when flying `heading`. */
export function relativeBearing(heading: number, bearingToStation: number): number {
  return norm(finite(bearingToStation) - finite(heading));
}

export function AdfIndicator({ bearing = 0, heading = 0, signal = true, ...props }: AdfIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const rel = finite(bearing);
  const hdg = finite(heading);

  const displayCard = useContinuousAngle(hdg);
  const displayNeedle = useContinuousAngle(signal ? rel : PARKED_DEG);

  const label = signal
    ? `ADF indicator: station ${pad3(rel)}° relative, bearing ${pad3(rel + hdg)}° to station`
    : 'ADF indicator: no signal';

  return (
    <InstrumentFrame {...props} label={label} knobs={[{ id: 'hdg', label: 'HDG', position: 'bottom-left', angle: hdg }]}>
      {/* Compass card: fixed with 0 at the top, or turned to the aircraft heading. */}
      <g data-testid="adf-card" style={motionStyle(`rotate(${-displayCard}deg)`, duration)}>
        <g stroke="#fff" strokeLinecap="round">
          {range(0, 355, 5).map((a) => (
            <path key={a} d={tickPath(176, a % 10 === 0 ? 152 : 164, a)} strokeWidth={a % 10 === 0 ? 3 : 2} />
          ))}
        </g>
        {range(0, 330, 30).map((a) => {
          const [x, y] = polar(132, a);
          return (
            <text
              key={a}
              x={x}
              y={y}
              transform={`rotate(${a} ${x} ${y})`}
              fill={a % 90 === 0 ? AMBER : '#fff'}
              fontSize={a % 90 === 0 ? 28 : 24}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {CARDINALS[a] ?? String(a / 10)}
            </text>
          );
        })}
      </g>

      {/* Fixed nose index and 45° reference marks. */}
      <path d={`M ${CENTER} ${CENTER - 150} l -10 -28 h 20 z`} fill={AMBER} stroke="#000" strokeWidth="1.5" />
      <g stroke={AMBER} strokeWidth="4" strokeLinecap="round">
        {[45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d={tickPath(192, 178, a)} />
        ))}
      </g>

      {/* Fixed wing and nose reference lines. */}
      <g stroke={AMBER} strokeWidth="2" strokeLinecap="round" opacity="0.7">
        <path d={`M ${CENTER - 26} ${CENTER} H ${CENTER + 26}`} />
        <path d={`M ${CENTER} ${CENTER - 26} V ${CENTER + 14}`} />
      </g>

      <text x={CENTER} y={CENTER + 62} fill="#ccc" fontSize="15" fontWeight="bold" letterSpacing="2" textAnchor="middle" dominantBaseline="central">
        ADF
      </text>

      {/* Warning flag, shown when there is no usable signal. */}
      <g data-testid="adf-flag" opacity={signal ? 0 : 1} style={{ transition: 'opacity 200ms ease-out' }}>
        <rect x={CENTER - 28} y={CENTER - 76} width="56" height="24" rx="3" fill="#d42626" stroke="#000" strokeWidth="1.5" />
        <text x={CENTER} y={CENTER - 63} fill="#fff" fontSize="15" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          ADF
        </text>
      </g>

      {/* Bearing needle: the arrowhead points at the station, the tail away from it. */}
      <g data-testid="adf-needle" style={motionStyle(`rotate(${displayNeedle}deg)`, duration)}>
        <path
          d={`M ${CENTER} ${CENTER - 146} l -13 30 h 9 V ${CENTER + 140} h 8 V ${CENTER - 116} h 9 z`}
          fill={NEEDLE}
          stroke="#000"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
      <Hub r={10} />
    </InstrumentFrame>
  );
}
