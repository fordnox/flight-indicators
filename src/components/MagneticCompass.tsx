import { CENTER, DEFAULT_ANIMATION_MS, finite, motionStyle, range, useContinuousAngle, useSvgId } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export interface MagneticCompassProps extends InstrumentProps {
  /** Magnetic heading in degrees. */
  heading?: number;
  /** Compass correction card rows, printed under the window: `{ for, steer }` in degrees. Leave it out to hide the card. */
  deviationCard?: Array<{ for: number; steer: number }>;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
/** Pixels per degree on the card strip: the window shows about 70° of the card. */
const PPD = 4;
const WINDOW_W = 284;
const WINDOW_H = 120;
const WINDOW_Y = CENTER - 70;
/** Degrees of card drawn either side of the heading; wider than the window so the strip never runs out while it moves. */
const SPAN = 90;

const norm = (deg: number): number => ((deg % 360) + 360) % 360;
/** Deviation card heading: N / E / S / W or the number of degrees. */
const cardLabel = (deg: number): string => CARDINALS[Math.round(norm(deg)) % 360] ?? String(Math.round(norm(deg)));
const pad3 = (deg: number): string => String(Math.round(norm(deg)) % 360 || 360).padStart(3, '0');

/**
 * Wet ("whiskey") magnetic compass: the card floats behind a window with a vertical lubber line.
 * The pilot reads the back of the card, so the numbers grow to the left: on a heading of north,
 * east (3, 6, E) is to the left of the lubber line and west to the right.
 */
export function MagneticCompass({ heading = 0, deviationCard, ...props }: MagneticCompassProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const hdg = finite(heading);
  const display = useContinuousAngle(hdg);
  const base = Math.round(display / 5) * 5;
  const cardX = (d: number) => CENTER - d * PPD;
  const left = CENTER - WINDOW_W / 2;
  const clipId = useSvgId('fi-compass-window');
  const shadeId = useSvgId('fi-compass-shade');
  const rows = (deviationCard ?? []).slice(0, 6);

  return (
    <InstrumentFrame {...props} label={`Magnetic compass: ${pad3(hdg)}°`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={left} y={WINDOW_Y} width={WINDOW_W} height={WINDOW_H} rx="16" />
        </clipPath>
        <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.85" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0" />
          <stop offset="0.78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <rect x={left - 6} y={WINDOW_Y - 6} width={WINDOW_W + 12} height={WINDOW_H + 12} rx="20" fill="#000" stroke="#444" strokeWidth="3" />
      <g clipPath={`url(#${clipId})`}>
        <rect x={left} y={WINDOW_Y} width={WINDOW_W} height={WINDOW_H} fill="#16181a" />
        <g data-testid="compass-card" style={motionStyle(`translate(${Math.round(display * PPD * 100) / 100}px, 0px)`, duration)}>
          {range(base - SPAN, base + SPAN, 5).map((d) => {
            const x = cardX(d);
            const n = norm(d);
            const label = n % 30 === 0 ? (CARDINALS[n] ?? String(n / 10)) : null;
            return (
              <g key={d}>
                <path d={`M ${x} ${WINDOW_Y + 4} v ${n % 10 === 0 ? 26 : 16}`} stroke="#eee" strokeWidth={n % 10 === 0 ? 3 : 2} />
                {label && (
                  <text x={x} y={WINDOW_Y + 66} fill={CARDINALS[n] ? '#fff' : '#e8e8e8'} fontSize={CARDINALS[n] ? 40 : 34} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <rect x={left} y={WINDOW_Y} width={WINDOW_W} height={WINDOW_H} fill={`url(#${shadeId})`} pointerEvents="none" />
      </g>
      {/* Lubber line: a thin vertical wire in front of the card. */}
      <path d={`M ${CENTER} ${WINDOW_Y - 4} V ${WINDOW_Y + WINDOW_H + 4}`} stroke="#ff5a2a" strokeWidth="3" />
      <text x={CENTER} y={WINDOW_Y - 24} fill="#ccc" fontSize="16" textAnchor="middle" letterSpacing="3">COMPASS</text>

      {rows.length > 0 && (
        <g data-testid="compass-deviation-card" fontSize="13" fill="#222" textAnchor="middle" dominantBaseline="central">
          <rect x={CENTER - 136} y={CENTER + 70} width="272" height="64" rx="4" fill="#ececec" />
          <text x={CENTER - 110} y={CENTER + 86} fontWeight="bold">FOR</text>
          <text x={CENTER - 110} y={CENTER + 116} fontWeight="bold">STEER</text>
          {rows.map((r, i) => {
            const x = CENTER - 56 + i * (166 / Math.max(1, rows.length - 1));
            return (
              <g key={i}>
                <text x={x} y={CENTER + 86}>{cardLabel(finite(r.for))}</text>
                <text x={x} y={CENTER + 116}>{Math.round(norm(finite(r.steer)))}</text>
              </g>
            );
          })}
        </g>
      )}
    </InstrumentFrame>
  );
}
