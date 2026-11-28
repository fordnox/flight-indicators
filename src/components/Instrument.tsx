import type { CSSProperties, ReactNode } from 'react';
import { CENTER, DEFAULT_ANIMATION_MS, motionStyle, range, useContinuousAngle, useSvgId } from '../utils';

/** Props shared by every instrument. */
export interface InstrumentProps {
  /** Rendered width/height. Number = pixels, or any CSS length (e.g. `"100%"`). Default `200`. */
  size?: number | string;
  /** Draw the square mounting plate with screws behind the dial. Default `true`. */
  showBox?: boolean;
  /** Draw the instrument's setting knobs (OBS, baro, heading set...) on instruments that have them. Default `true`. */
  showKnobs?: boolean;
  /** Needle/card animation duration in ms. `0` disables animation. Default `300`. */
  animationDuration?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; defaults to the instrument name plus its current reading. */
  title?: string;
}

/** A setting knob drawn on the mounting plate. */
export interface KnobSpec {
  /** Used for the `data-testid` (`knob-<id>`). */
  id: string;
  /** Short text on the knob face, e.g. `"OBS"`. */
  label?: string;
  /** Where the knob sits: a lower corner of the plate, or small and centred under the dial. */
  position: 'bottom-left' | 'bottom-right' | 'bottom';
  /** Rotation of the knurled rim in degrees, so the knob turns with the value it sets. */
  angle?: number;
}

interface FrameProps extends InstrumentProps {
  label: string;
  children: ReactNode;
  /** Knobs this instrument has; drawn on top unless `showKnobs` is `false`. */
  knobs?: KnobSpec[];
  /** ARIA role of the root `<svg>`. Instruments with their own buttons use `"group"` so the buttons stay reachable. Default `"img"`. */
  role?: 'img' | 'group';
}

const KNOB_PLACES: Record<KnobSpec['position'], [number, number, number]> = {
  'bottom-left': [46, 354, 30],
  'bottom-right': [354, 354, 30],
  bottom: [CENTER, 376, 17],
};

/** Knurled setting knob. The rim turns with `angle`; the label stays upright. */
export function Knob({ id, label, position, angle = 0, animationDuration = DEFAULT_ANIMATION_MS }: KnobSpec & { animationDuration?: number }) {
  const [cx, cy, r] = KNOB_PLACES[position];
  const display = useContinuousAngle(angle);
  const step = 360 / 28;
  return (
    <g data-testid={`knob-${id}`}>
      <circle cx={cx} cy={cy + 2} r={r + 2} fill="#000" opacity="0.55" />
      <g data-testid={`knob-${id}-rim`} style={motionStyle(`rotate(${display}deg)`, animationDuration, cx, cy)}>
        <circle cx={cx} cy={cy} r={r} fill="#2e2e2e" stroke="#000" strokeWidth="2" />
        <g stroke="#111" strokeWidth={r > 20 ? 3 : 2}>
          {range(0, 360 - step, step).map((a) => {
            const rad = (a * Math.PI) / 180;
            return (
              <path
                key={a}
                d={`M ${cx + (r - 5) * Math.sin(rad)} ${cy - (r - 5) * Math.cos(rad)} L ${cx + r * Math.sin(rad)} ${cy - r * Math.cos(rad)}`}
              />
            );
          })}
        </g>
        <path d={`M ${cx} ${cy - r + 1} v ${r * 0.22}`} stroke="#ddd" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={r * 0.72} fill="#1f1f1f" stroke="#cfcfcf" strokeWidth={r > 20 ? 2 : 1.5} />
      {label && (
        <text
          x={cx}
          y={cy}
          fill="#eee"
          fontSize={Math.min(13, (r * 1.15) / Math.max(1, label.length * 0.6))}
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      )}
    </g>
  );
}

const SCREWS: Array<[number, number]> = [
  [32, 32],
  [368, 32],
  [32, 368],
  [368, 368],
];

/** Common SVG shell: mounting plate, bezel and dial face. */
export function InstrumentFrame({
  size = 200,
  showBox = true,
  showKnobs = true,
  knobs,
  animationDuration,
  className,
  style,
  title,
  label,
  role = 'img',
  children,
}: FrameProps) {
  const titleId = useSvgId('fi-title');
  const bezelId = useSvgId('fi-bezel');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      role={role}
      aria-labelledby={titleId}
      className={className}
      style={{ display: 'inline-block', userSelect: 'none', ...style }}
      fontFamily="'Helvetica Neue', Arial, sans-serif"
    >
      <title id={titleId}>{title ?? label}</title>
      <defs>
        <linearGradient id={bezelId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5a5a" />
          <stop offset="1" stopColor="#1a1a1a" />
        </linearGradient>
      </defs>

      {showBox && (
        <g>
          <rect x="2" y="2" width="396" height="396" rx="36" fill="#232323" stroke="#0d0d0d" strokeWidth="4" />
          {SCREWS.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="12" fill="#3a3a3a" stroke="#111" strokeWidth="2" />
              <path d={`M ${x - 8} ${y + 3} L ${x + 8} ${y - 3}`} stroke="#111" strokeWidth="3" />
            </g>
          ))}
        </g>
      )}

      <circle cx={CENTER} cy={CENTER} r="196" fill={`url(#${bezelId})`} />
      <circle cx={CENTER} cy={CENTER} r="182" fill="#111" stroke="#000" strokeWidth="4" />
      {children}
      {showKnobs && knobs?.map((k) => <Knob key={k.id} {...k} animationDuration={animationDuration} />)}
    </svg>
  );
}

/** Centre hub drawn on top of needles. */
export function Hub({ r = 14 }: { r?: number }) {
  return <circle cx={CENTER} cy={CENTER} r={r} fill="#2a2a2a" stroke="#555" strokeWidth="2" />;
}
