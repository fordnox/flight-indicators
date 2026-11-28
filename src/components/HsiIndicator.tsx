import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, polar, range, tickPath, useContinuousAngle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';
import { vorDeviation, type ToFrom } from './VorIndicator';

export interface HsiIndicatorProps extends InstrumentProps {
  /** Aircraft heading in degrees. The compass card turns so it sits under the lubber line at the top. */
  heading?: number;
  /** Heading bug in degrees, set with the HDG knob. Leave it out to hide the bug. */
  headingBug?: number;
  /** Selected course in degrees, set with the CRS knob. The course pointer turns with the card to point at it. */
  course?: number;
  /** Radial the aircraft is on, measured from the station, in degrees. Drives the deviation bar and TO/FROM. */
  radial?: number;
  /** Course deviation in degrees, positive when the course lies to the right. Overrides `radial`. */
  deviation?: number;
  /** Deviation in degrees at full-scale deflection of the bar (2 dots). Default `10` (VOR); use `2.5` for a localizer. */
  fullScale?: number;
  /** TO/FROM indication. Overrides the value computed from `radial`. */
  toFrom?: ToFrom;
  /** `false` shows the red NAV flag, centres the deviation bar and hides TO/FROM. Default `true`. */
  signal?: boolean;
  /**
   * Glideslope deviation in degrees, positive when the glidepath is above the aircraft (fly up).
   * Leave it out when no glideslope is received: the GS flag covers the scale and the pointers are hidden.
   */
  glideslope?: number;
  /** Glideslope deviation in degrees at full-scale deflection (2 dots). Default `0.7`. */
  glideslopeFullScale?: number;
  /** Overrides whether the glideslope is received. Defaults to `true` when `glideslope` is a finite number. */
  glideslopeSignal?: boolean;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const AMBER = '#ffb000';
const COURSE = '#e6d930';
const BUG = '#ff7a1a';
const FLAG = '#e0342a';
/** Two dots either side; the deviation bar is at full scale on the outer dot. */
const DOT_SPACING = 36;
const FULL_SCALE_PX = DOT_SPACING * 2;
const BAR_HALF = 58;
/** Glideslope scales sit on both sides of the dial, inside the card numbers. */
const GS_X = 108;
const GS_DOT_SPACING = 24;
const GS_FULL_SCALE_PX = GS_DOT_SPACING * 2;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
const round2 = (n: number): number => Math.round(n * 100) / 100 + 0;
const pad3 = (deg: number): string => String(Math.round(norm(deg)) % 360 || 360).padStart(3, '0');

/** Red warning flag with black lettering, shown when `visible`. */
function WarningFlag({ x, y, text, visible, testId, vertical }: { x: number; y: number; text: string; visible: boolean; testId: string; vertical?: boolean }) {
  const [w, h] = vertical ? [20, 46] : [44, 20];
  return (
    <g data-testid={testId} opacity={visible ? 1 : 0} style={{ transition: 'opacity 200ms ease-out' }}>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="2" fill={FLAG} stroke="#000" strokeWidth="1.5" />
      {vertical ? (
        text.split('').map((c, i) => (
          <text key={i} x={x} y={y + (i - (text.length - 1) / 2) * 15} fill="#111" fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {c}
          </text>
        ))
      ) : (
        <text x={x} y={y} fill="#111" fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          {text}
        </text>
      )}
    </g>
  );
}

/** One glideslope scale with its pointer. `side` is `-1` for the left scale and `1` for the right. */
function GlideslopeScale({ side, y, visible, duration }: { side: -1 | 1; y: number; visible: boolean; duration: number }) {
  const x = CENTER + side * GS_X;
  return (
    <g>
      <g fill="none" stroke="#eee" strokeWidth="2">
        {[-2, -1, 1, 2].map((i) => (
          <circle key={i} cx={x} cy={CENTER + i * GS_DOT_SPACING} r="4.5" />
        ))}
      </g>
      <path d={`M ${x - 7} ${CENTER} h 14`} stroke="#eee" strokeWidth="3" strokeLinecap="round" />
      <g
        data-testid={side > 0 ? 'hsi-gs-pointer' : 'hsi-gs-pointer-left'}
        opacity={visible ? 1 : 0}
        style={{ ...motionStyle(`translate(0px, ${y}px)`, duration), transition: duration > 0 ? `transform ${duration}ms ease-out, opacity 200ms ease-out` : 'opacity 200ms ease-out' }}
      >
        {/* Arrowhead pointing in towards the dial centre. */}
        <path d={`M ${x - side * 7} ${CENTER} l ${side * 15} -9 v 18 z`} fill="#3ddc84" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </g>
  );
}

/**
 * Horizontal situation indicator: a heading indicator and a VOR / ILS head in one.
 * The compass card turns with the heading under a fixed aircraft symbol. The course pointer and its
 * deviation bar turn with the selected course, so the bar shows where the course line lies relative to the aircraft.
 * A heading bug, TO/FROM triangle, glideslope pointers and red NAV / GS flags complete the picture.
 */
export function HsiIndicator({
  heading = 0,
  headingBug,
  course = 0,
  radial,
  deviation,
  fullScale = 10,
  toFrom,
  signal = true,
  glideslope,
  glideslopeFullScale = 0.7,
  glideslopeSignal,
  ...props
}: HsiIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const hdg = finite(heading);
  const crs = finite(course);
  const hasBug = typeof headingBug === 'number' && Number.isFinite(headingBug);
  const bug = hasBug ? headingBug : 0;
  const computed = typeof radial === 'number' && Number.isFinite(radial) ? vorDeviation(crs, radial) : undefined;
  const locScale = finite(fullScale, 10) > 0 ? finite(fullScale, 10) : 10;
  const gsScale = finite(glideslopeFullScale, 0.7) > 0 ? finite(glideslopeFullScale, 0.7) : 0.7;

  const dev = signal ? clamp(finite(deviation, computed?.deviation ?? 0), -locScale, locScale) : 0;
  const flag: ToFrom = !signal ? 'OFF' : (toFrom ?? computed?.toFrom ?? 'OFF');
  const hasGs = glideslopeSignal ?? (typeof glideslope === 'number' && Number.isFinite(glideslope));
  const gs = hasGs ? clamp(finite(glideslope), -gsScale, gsScale) : 0;

  // Course to the right moves the bar right of the aircraft; glidepath above moves the pointers up.
  const barX = round2((dev / locScale) * FULL_SCALE_PX);
  const gsY = round2(-(gs / gsScale) * GS_FULL_SCALE_PX);

  const displayHeading = useContinuousAngle(hdg);
  const displayCourse = useContinuousAngle(crs);
  const displayBug = useContinuousAngle(bug);

  const devText = Math.abs(dev) < 0.05 ? 'centred' : `${Math.abs(dev).toFixed(1)}° ${dev > 0 ? 'right' : 'left'}`;
  const gsText = !hasGs ? 'glideslope off' : Math.abs(gs) < 0.005 ? 'glideslope centred' : `glideslope ${Math.abs(gs).toFixed(2)}° ${gs > 0 ? 'up' : 'down'}`;
  const navText = signal ? `course bar ${devText}, ${flag === 'OFF' ? 'no TO/FROM indication' : flag}` : 'no NAV signal';
  const label = `HSI: heading ${pad3(hdg)}°, course ${pad3(crs)}°, ${navText}, ${gsText}${hasBug ? `, heading bug ${pad3(bug)}°` : ''}`;

  return (
    <InstrumentFrame
      {...props}
      label={label}
      knobs={[
        { id: 'crs', label: 'CRS', position: 'bottom-left', angle: crs },
        { id: 'hdg', label: 'HDG', position: 'bottom-right', angle: bug },
      ]}
    >
      {/* Compass card, turned so the heading sits under the lubber line. Bug and course pointer ride on it. */}
      <g data-testid="hsi-card" style={motionStyle(`rotate(${-displayHeading}deg)`, duration)}>
        <g stroke="#eee" strokeLinecap="butt">
          {range(0, 355, 5).map((a) => (
            <path key={a} d={tickPath(172, a % 10 === 0 ? 154 : 163, a)} strokeWidth={a % 10 === 0 ? 3.5 : 2} />
          ))}
        </g>
        {range(0, 330, 30).map((a) => {
          const [x, y] = polar(138, a);
          return (
            <text
              key={a}
              x={x}
              y={y}
              transform={`rotate(${a} ${x} ${y})`}
              fill="#eee"
              fontSize={a % 90 === 0 ? 24 : 21}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {CARDINALS[a] ?? String(a / 10)}
            </text>
          );
        })}

        {/* Heading bug on the rim of the card. */}
        <g data-testid="hsi-heading-bug" opacity={hasBug ? 1 : 0} style={motionStyle(`rotate(${displayBug}deg)`, duration)}>
          <path
            d={`M ${CENTER - 13} ${CENTER - 182} h 26 v 20 h -7 l -6 -8 l -6 8 h -7 z`}
            fill={BUG}
            stroke="#000"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>

        {/* Course pointer, dots, deviation bar and TO/FROM triangle all turn with the selected course. */}
        <g data-testid="hsi-course" style={motionStyle(`rotate(${displayCourse}deg)`, duration)}>
          <g fill="none" stroke="#eee" strokeWidth="2.5">
            {[-2, -1, 1, 2].map((i) => (
              <circle key={i} cx={CENTER + i * DOT_SPACING} cy={CENTER} r="6" />
            ))}
          </g>
          {/* Head of the course pointer at the top, tail at the bottom. */}
          <path
            d={`M ${CENTER} ${CENTER - 126} l 13 24 h -8 v 40 h -10 v -40 h -8 z`}
            fill={COURSE}
            stroke="#000"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <rect x={CENTER - 5} y={CENTER + 62} width="10" height="58" fill={COURSE} stroke="#000" strokeWidth="1.5" />
          <g data-testid="hsi-cdi" style={motionStyle(`translate(${barX}px, 0px)`, duration)}>
            <rect x={CENTER - 5} y={CENTER - BAR_HALF} width="10" height={BAR_HALF * 2} fill={COURSE} stroke="#000" strokeWidth="1.5" />
          </g>
          <path
            data-testid="hsi-to"
            d={`M ${CENTER + 26} ${CENTER - 58} l 11 18 h -22 z`}
            fill="#eee"
            stroke="#000"
            strokeWidth="1.5"
            opacity={flag === 'TO' ? 1 : 0}
            style={{ transition: 'opacity 200ms ease-out' }}
          />
          <path
            data-testid="hsi-from"
            d={`M ${CENTER + 26} ${CENTER + 58} l 11 -18 h -22 z`}
            fill="#eee"
            stroke="#000"
            strokeWidth="1.5"
            opacity={flag === 'FROM' ? 1 : 0}
            style={{ transition: 'opacity 200ms ease-out' }}
          />
        </g>
      </g>

      {/* Fixed lubber line, 45° marks and aircraft symbol. */}
      <g stroke={AMBER} strokeWidth="4" strokeLinecap="round">
        {[45, 135, 225, 315].map((a) => (
          <path key={a} d={tickPath(192, 180, a)} />
        ))}
      </g>
      <path d={`M ${CENTER} ${CENTER - 156} l -9 -24 h 18 z`} fill={AMBER} stroke="#000" strokeWidth="1" />
      <path
        d={`M ${CENTER} ${CENTER - 30} c 4 0 5 5 5 10 v 14 l 25 9 v 7 l -25 -3 v 16 l 10 6 v 6 l -15 -3 l -15 3 v -6 l 10 -6 v -16 l -25 3 v -7 l 25 -9 v -14 c 0 -5 1 -10 5 -10 z`}
        fill={AMBER}
        stroke="#000"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Glideslope scales on both sides, with the GS flag over the right one. */}
      <GlideslopeScale side={-1} y={gsY} visible={hasGs} duration={duration} />
      <GlideslopeScale side={1} y={gsY} visible={hasGs} duration={duration} />
      <WarningFlag x={CENTER + GS_X} y={CENTER} text="GS" visible={!hasGs} testId="hsi-gs-flag" vertical />
      <WarningFlag x={CENTER - 62} y={CENTER - 84} text="NAV" visible={!signal} testId="hsi-nav-flag" />
    </InstrumentFrame>
  );
}
