import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar, range, tickPath, useContinuousAngle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export type ToFrom = 'TO' | 'FROM' | 'OFF';

export interface VorIndicatorProps extends InstrumentProps {
  /** Selected course (OBS) in degrees. The compass card turns so this course sits under the top index. */
  course?: number;
  /**
   * Radial the aircraft is on, measured from the station, in degrees.
   * When given, the needle deflection and the TO/FROM flag are worked out from `course` and `radial`.
   */
  radial?: number;
  /**
   * Course deviation in degrees, positive when the course lies to the right.
   * Full scale is ±10° (5 dots of 2°). Overrides the value computed from `radial`.
   */
  deviation?: number;
  /** TO/FROM flag. Overrides the value computed from `radial`. `"OFF"` hides both triangles. */
  toFrom?: ToFrom;
  /** `false` shows the red NAV flag, centres the needle and hides TO/FROM. Default `true`. */
  signal?: boolean;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const AMBER = '#ffb000';
const FULL_SCALE_DEG = 10;
const DOT_SPACING = 22;
const FULL_SCALE_PX = DOT_SPACING * 5;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
/** Signed difference `a - b` wrapped into (-180, 180]. */
const signedDiff = (a: number, b: number): number => ((((a - b) % 360) + 540) % 360) - 180;

/** Needle deflection (°, positive = course to the right) and flag for an aircraft on `radial` with `course` selected. */
export function vorDeviation(course: number, radial: number): { deviation: number; toFrom: ToFrom } {
  const d = signedDiff(radial, course);
  // Within 90° of the selected radial the course line is the radial itself (FROM);
  // otherwise it is the reciprocal and we are heading towards the station (TO).
  return Math.abs(d) <= 90 ? { deviation: -d, toFrom: 'FROM' } : { deviation: signedDiff(d, 180), toFrom: 'TO' };
}

/** TO/FROM arrow: an arrowhead with a short shaft, labelled beside it. */
function Flag({ y, up, visible, testId }: { y: number; up: boolean; visible: boolean; testId: string }) {
  const dir = up ? -1 : 1;
  const tip = y + dir * 17;
  const headBase = y + dir * 1;
  const tail = y - dir * 15;
  return (
    <g data-testid={testId} opacity={visible ? 1 : 0} style={{ transition: 'opacity 200ms ease-out' }}>
      <path
        d={`M ${CENTER} ${tip} L ${CENTER - 13} ${headBase} H ${CENTER - 4} V ${tail} H ${CENTER + 4} V ${headBase} H ${CENTER + 13} Z`}
        fill="#fff"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <text x={CENTER + 22} y={y} fill="#fff" fontSize="15" fontWeight="bold" dominantBaseline="central">
        {up ? 'TO' : 'FROM'}
      </text>
    </g>
  );
}

export function VorIndicator({ course = 0, radial, deviation, toFrom, signal = true, ...props }: VorIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const crs = finite(course);
  const computed = typeof radial === 'number' && Number.isFinite(radial) ? vorDeviation(crs, radial) : undefined;

  const rawDeviation = finite(deviation, computed?.deviation ?? 0);
  const dev = signal ? clamp(rawDeviation, -FULL_SCALE_DEG, FULL_SCALE_DEG) : 0;
  const flag: ToFrom = !signal ? 'OFF' : (toFrom ?? computed?.toFrom ?? 'OFF');

  const displayCourse = useContinuousAngle(crs);
  const courseText = String(Math.round(norm(crs)) || 360).padStart(3, '0');
  const needleX = (dev / FULL_SCALE_DEG) * FULL_SCALE_PX;

  const devText = Math.abs(dev) < 0.05 ? 'centred' : `${Math.abs(dev).toFixed(1)}° ${dev > 0 ? 'right' : 'left'}`;
  const label = signal
    ? `VOR indicator: course ${courseText}°, needle ${devText}, ${flag === 'OFF' ? 'no TO/FROM indication' : flag}`
    : `VOR indicator: course ${courseText}°, no signal`;

  return (
    <InstrumentFrame {...props} label={label}>
      {/* Rotating compass card, turned by the OBS so the selected course is at the top. */}
      <g data-testid="vor-card" style={motionStyle(`rotate(${-displayCourse}deg)`, duration)}>
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

      {/* Fixed course index at the top, reciprocal index at the bottom, 45° marks. */}
      <path d={`M ${CENTER} ${CENTER - 150} l -10 -28 h 20 z`} fill={AMBER} stroke="#000" strokeWidth="1.5" />
      <path d={`M ${CENTER} ${CENTER + 150} l -8 24 h 16 z`} fill="#fff" stroke="#000" strokeWidth="1.5" />
      <g stroke={AMBER} strokeWidth="4" strokeLinecap="round">
        {[45, 90, 135, 225, 270, 315].map((a) => (
          <path key={a} d={tickPath(192, 178, a)} />
        ))}
      </g>

      {/* Deviation scale: 5 dots each side of the centre circle, 2° per dot. */}
      <g fill="#fff" stroke="#000" strokeWidth="1">
        {range(1, 5, 1).flatMap((i) => [-i, i]).map((i) => (
          <circle key={i} cx={CENTER + i * DOT_SPACING} cy={CENTER} r="5" />
        ))}
      </g>
      <circle cx={CENTER} cy={CENTER} r="9" fill="none" stroke="#fff" strokeWidth="2.5" />

      {/* TO (above) and FROM (below) triangles. */}
      <Flag y={CENTER - 54} up visible={flag === 'TO'} testId="vor-to" />
      <Flag y={CENTER + 54} up={false} visible={flag === 'FROM'} testId="vor-from" />

      {/* Course deviation needle, moved sideways by the deviation. */}
      <g data-testid="vor-needle" style={motionStyle(`translate(${needleX}px, 0px)`, duration)}>
        <rect x={CENTER - 3} y={CENTER - 68} width="6" height="136" rx="3" fill="#fff" stroke="#000" strokeWidth="1.5" />
      </g>

      {/* Selected course readout. */}
      <rect x={CENTER - 44} y={CENTER + 72} width="88" height="26" rx="4" fill="#000" stroke="#555" strokeWidth="2" />
      <text
        data-testid="vor-course"
        x={CENTER}
        y={CENTER + 86}
        fill="#fff"
        fontSize="17"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
      >
        <tspan fill="#ccc">CRS </tspan>
        {courseText}
      </text>

      {/* NAV warning flag, shown when there is no usable signal. */}
      <g data-testid="vor-nav-flag" opacity={signal ? 0 : 1} style={{ transition: 'opacity 200ms ease-out' }}>
        <rect x={CENTER - 28} y={CENTER - 98} width="56" height="24" rx="3" fill="#d42626" stroke="#000" strokeWidth="1.5" />
        <text x={CENTER} y={CENTER - 85} fill="#fff" fontSize="15" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          NAV
        </text>
      </g>
    </InstrumentFrame>
  );
}
