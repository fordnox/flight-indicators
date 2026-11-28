import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar, range, tickPath, useContinuousAngle, useSvgId } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';
import { vorDeviation, type ToFrom } from './VorIndicator';

/**
 * How the crossed needles move.
 * `"slide"`: both needles move parallel to themselves over hatched scales.
 * `"swing"`: the course needle is hinged near the bottom and the glideslope needle near the left, so they pivot.
 */
export type IlsNeedles = 'slide' | 'swing';

export interface IlsIndicatorProps extends InstrumentProps {
  /** Selected course (OBS) in degrees. The compass card turns so this course sits under the top index. */
  course?: number;
  /** Radial the aircraft is on, measured from the station, in degrees. Drives the course needle and TO/FROM. */
  radial?: number;
  /** Course (VOR/LOC) deviation in degrees, positive when the course lies to the right. Overrides `radial`. */
  deviation?: number;
  /** Deviation in degrees at full-scale deflection of the course needle (5 dots). Default `10` (VOR); use `2.5` for a localizer. */
  fullScale?: number;
  /** TO/FROM indication. Overrides the value computed from `radial`. */
  toFrom?: ToFrom;
  /** `false` drops the orange NAV flag (bottom window), centres the course needle and hides TO/FROM. Default `true`. */
  signal?: boolean;
  /**
   * Glideslope deviation in degrees, positive when the glidepath is above the aircraft (fly up).
   * Leave it out when no glideslope is received: the GS flag (right window) drops and the needle is parked.
   */
  glideslope?: number;
  /** Glideslope deviation in degrees at full-scale deflection (5 dots). Default `0.7`. */
  glideslopeFullScale?: number;
  /** Overrides whether the glideslope is received. Defaults to `true` when `glideslope` is a finite number. */
  glideslopeSignal?: boolean;
  /** `"slide"` (default) or `"swing"`; see {@link IlsNeedles}. */
  needles?: IlsNeedles;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const YELLOW = '#d8e03a';
const FLAG = '#d9814f';
const SCALE_GREY = '#2c2c2c';
const DOT_SPACING = 18;
const FULL_SCALE_PX = DOT_SPACING * 5;
/** Swinging needles: the course needle hinges below the centre, the glideslope needle left of it. */
const LOC_PIVOT_Y = CENTER + 108;
const GS_PIVOT_X = CENTER - 108;
const SWING_LENGTH = 260;
/** Flag windows sit on the ends of the scales, just inside the card numbers. */
const FLAG_OFFSET = 108;
/** Needles are clipped to this radius so a full swing never crosses the compass ticks. */
const NEEDLE_CLIP_R = 150;
const SCALE_HALF = 112;
/** Where a parked swinging glideslope needle rests, in px above the centre line (out of the scale, as on the real thing). */
const GS_PARK_PX = -120;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
const round2 = (n: number): number => Math.round(n * 100) / 100 + 0;
const deg = (rad: number): number => round2((rad * 180) / Math.PI);

/** Orange warning flag in a black window, with a double-headed arrow along `axis`. */
function FlagWindow({ x, y, axis, visible, testId }: { x: number; y: number; axis: 'h' | 'v'; visible: boolean; testId: string }) {
  const [w, h] = axis === 'h' ? [52, 24] : [24, 52];
  const arrow =
    axis === 'h'
      ? `M ${x - 18} ${y} H ${x + 18} M ${x - 12} ${y - 6} L ${x - 18} ${y} L ${x - 12} ${y + 6} M ${x + 12} ${y - 6} L ${x + 18} ${y} L ${x + 12} ${y + 6}`
      : `M ${x} ${y - 18} V ${y + 18} M ${x - 6} ${y - 12} L ${x} ${y - 18} L ${x + 6} ${y - 12} M ${x - 6} ${y + 12} L ${x} ${y + 18} L ${x + 6} ${y + 12}`;
  return (
    <g>
      <rect x={x - w / 2 - 3} y={y - h / 2 - 3} width={w + 6} height={h + 6} rx="3" fill="#050505" stroke="#444" strokeWidth="1.5" />
      <g data-testid={testId} opacity={visible ? 1 : 0} style={{ transition: 'opacity 200ms ease-out' }}>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="2" fill={FLAG} />
        <path d={arrow} stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/** White needle with a thin black outline. */
function NeedleLine({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke="#000" strokeWidth="7" strokeLinecap="round" />
      <path d={d} stroke="#eee" strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

/**
 * Crossed-needle VOR/LOC and glideslope indicator with an OBS card, as fitted to many light aircraft.
 * The vertical needle shows course deviation, the horizontal needle glideslope deviation,
 * and orange flags drop into windows at the bottom (NAV) and right (GS) when a signal is lost.
 */
export function IlsIndicator({
  course = 0,
  radial,
  deviation,
  fullScale = 10,
  toFrom,
  signal = true,
  glideslope,
  glideslopeFullScale = 0.7,
  glideslopeSignal,
  needles = 'slide',
  ...props
}: IlsIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const crs = finite(course);
  const computed = typeof radial === 'number' && Number.isFinite(radial) ? vorDeviation(crs, radial) : undefined;
  const locScale = finite(fullScale, 10) > 0 ? finite(fullScale, 10) : 10;
  const gsScale = finite(glideslopeFullScale, 0.7) > 0 ? finite(glideslopeFullScale, 0.7) : 0.7;

  const dev = signal ? clamp(finite(deviation, computed?.deviation ?? 0), -locScale, locScale) : 0;
  const flag: ToFrom = !signal ? 'OFF' : (toFrom ?? computed?.toFrom ?? 'OFF');
  const hasGs = glideslopeSignal ?? (typeof glideslope === 'number' && Number.isFinite(glideslope));
  const gs = hasGs ? clamp(finite(glideslope), -gsScale, gsScale) : 0;

  const swing = needles === 'swing';
  // Needle offsets in px: course right moves the needle right, glidepath above moves the needle up.
  const locX = round2((dev / locScale) * FULL_SCALE_PX);
  const gsY = hasGs ? round2(-(gs / gsScale) * FULL_SCALE_PX) : swing ? GS_PARK_PX : 0;
  // Swinging needles turn about their hinge so they cross the straight scales exactly at the matching dot.
  const locAngle = deg(Math.atan2(locX, LOC_PIVOT_Y - CENTER));
  const gsAngle = deg(Math.atan2(gsY, CENTER - GS_PIVOT_X));

  const displayCourse = useContinuousAngle(crs);
  const courseText = String(Math.round(norm(crs)) || 360).padStart(3, '0');
  const devText = Math.abs(dev) < 0.05 ? 'centred' : `${Math.abs(dev).toFixed(1)}° ${dev > 0 ? 'right' : 'left'}`;
  const gsText = !hasGs ? 'glideslope off' : Math.abs(gs) < 0.005 ? 'glideslope centred' : `glideslope ${Math.abs(gs).toFixed(2)}° ${gs > 0 ? 'up' : 'down'}`;
  const label = signal
    ? `ILS indicator: course ${courseText}°, course needle ${devText}, ${gsText}, ${flag === 'OFF' ? 'no TO/FROM indication' : flag}`
    : `ILS indicator: course ${courseText}°, no NAV signal, ${gsText}`;

  const clipId = useSvgId('fi-ils-clip');
  const dots = range(1, 5, 1).flatMap((i) => [-i, i]);

  return (
    <InstrumentFrame {...props} label={label} knobs={[{ id: 'obs', label: 'OBS', position: 'bottom-left', angle: crs }]}>
      {/* Compass card, turned by the OBS so the selected course is at the top. */}
      <g data-testid="ils-card" style={motionStyle(`rotate(${-displayCourse}deg)`, duration)}>
        <g stroke="#eee" strokeLinecap="butt">
          {range(0, 355, 5).map((a) => (
            <path key={a} d={tickPath(170, a % 10 === 0 ? 154 : 162, a)} strokeWidth={a % 10 === 0 ? 4 : 2.5} />
          ))}
        </g>
        {range(0, 330, 30).map((a) => {
          const [x, y] = polar(136, a);
          return (
            <text
              key={a}
              x={x}
              y={y}
              transform={`rotate(${a} ${x} ${y})`}
              fill="#ddd"
              fontSize={a % 90 === 0 ? 26 : 22}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {CARDINALS[a] ?? String(a / 10)}
            </text>
          );
        })}
      </g>

      {/* Course index at the top and reciprocal index at the bottom. */}
      <path d={`M ${CENTER} ${CENTER - 151} l -11 -19 h 22 z`} fill={YELLOW} stroke="#000" strokeWidth="1" />
      <path d={`M ${CENTER} ${CENTER + 151} l -8 13 h 16 z`} fill={YELLOW} stroke="#000" strokeWidth="1" />

      {/* TO and FROM windows. */}
      <g fontSize="13" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        <rect x={CENTER + 34} y={CENTER - 86} width="40" height="22" rx="2" fill="#050505" stroke="#333" />
        <text data-testid="ils-to" x={CENTER + 54} y={CENTER - 75} fill="#eee" opacity={flag === 'TO' ? 1 : 0} style={{ transition: 'opacity 200ms ease-out' }}>
          TO
        </text>
        <rect x={CENTER - 74} y={CENTER + 64} width="40" height="22" rx="2" fill="#050505" stroke="#333" />
        <text data-testid="ils-from" x={CENTER - 54} y={CENTER + 75} fill="#eee" opacity={flag === 'FROM' ? 1 : 0} style={{ transition: 'opacity 200ms ease-out' }}>
          FR
        </text>
      </g>

      {swing ? (
        <>
          {/* Straight scales: lollipop dots across, short ticks up and down. */}
          <rect x={CENTER - SCALE_HALF} y={CENTER - 9} width={SCALE_HALF * 2} height="18" rx="3" fill={SCALE_GREY} />
          <rect x={CENTER - 9} y={CENTER - SCALE_HALF} width="18" height={SCALE_HALF * 2} rx="3" fill={SCALE_GREY} />
          <g fill="#eee" stroke="#eee">
            {dots.map((i) => (
              <g key={i}>
                <circle cx={CENTER + i * DOT_SPACING} cy={CENTER} r="4" stroke="none" />
                <path d={`M ${CENTER + i * DOT_SPACING} ${CENTER - 8} V ${CENTER + 8}`} strokeWidth="1.5" />
              </g>
            ))}
            {range(-5, 5, 0.5)
              .filter((i) => i !== 0)
              .map((i) => (
                <path key={i} d={`M ${CENTER - (i % 1 ? 4 : 7)} ${CENTER + i * DOT_SPACING} h ${i % 1 ? 8 : 14}`} strokeWidth="2" />
              ))}
          </g>
        </>
      ) : (
        <>
          {/* Hatched scales along both axes: a tick per dot, half ticks between. */}
          <rect x={CENTER - SCALE_HALF} y={CENTER - 9} width={SCALE_HALF * 2} height="18" rx="3" fill={SCALE_GREY} />
          <rect x={CENTER - 9} y={CENTER - SCALE_HALF} width="18" height={SCALE_HALF * 2} rx="3" fill={SCALE_GREY} />
          <g stroke="#eee" strokeWidth="2">
            {range(-5, 5, 0.5)
              .filter((i) => i !== 0)
              .map((i) => {
                const half = i % 1 ? 4 : 7;
                return (
                  <g key={i}>
                    <path d={`M ${CENTER + i * DOT_SPACING} ${CENTER - half} v ${half * 2}`} />
                    <path d={`M ${CENTER - half} ${CENTER + i * DOT_SPACING} h ${half * 2}`} />
                  </g>
                );
              })}
          </g>
        </>
      )}

      {/* Centre circle. */}
      <circle cx={CENTER} cy={CENTER} r="16" fill="none" stroke="#000" strokeWidth="7" />
      <circle cx={CENTER} cy={CENTER} r="16" fill="none" stroke="#eee" strokeWidth="4" />

      <clipPath id={clipId}>
        <circle cx={CENTER} cy={CENTER} r={NEEDLE_CLIP_R} />
      </clipPath>
      {swing ? (
        <g clipPath={`url(#${clipId})`}>
          <g data-testid="ils-gs-needle" style={motionStyle(`rotate(${gsAngle}deg)`, duration, GS_PIVOT_X, CENTER)}>
            <NeedleLine d={`M ${GS_PIVOT_X} ${CENTER} H ${GS_PIVOT_X + SWING_LENGTH}`} />
          </g>
          <g data-testid="ils-loc-needle" style={motionStyle(`rotate(${locAngle}deg)`, duration, CENTER, LOC_PIVOT_Y)}>
            <NeedleLine d={`M ${CENTER} ${LOC_PIVOT_Y} V ${LOC_PIVOT_Y - SWING_LENGTH}`} />
          </g>
        </g>
      ) : (
        <>
          <g data-testid="ils-gs-needle" style={motionStyle(`translate(0px, ${gsY}px)`, duration)}>
            <NeedleLine d={`M ${CENTER - 104} ${CENTER} H ${CENTER + 104}`} />
          </g>
          <g data-testid="ils-loc-needle" style={motionStyle(`translate(${locX}px, 0px)`, duration)}>
            <NeedleLine d={`M ${CENTER} ${CENTER - 104} V ${CENTER + 104}`} />
          </g>
        </>
      )}

      {/* Warning flags: NAV (course) at the bottom, GS on the right. They also hide the swinging needles' hinges. */}
      <FlagWindow x={CENTER} y={CENTER + FLAG_OFFSET} axis="h" visible={!signal} testId="ils-nav-flag" />
      <FlagWindow x={CENTER + FLAG_OFFSET} y={CENTER} axis="v" visible={!hasGs} testId="ils-gs-flag" />
      {swing && <circle cx={GS_PIVOT_X} cy={CENTER} r="7" fill="#1a1a1a" stroke="#555" strokeWidth="2" />}

    </InstrumentFrame>
  );
}
