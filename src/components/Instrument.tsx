import type { CSSProperties, ReactNode } from 'react';
import { CENTER, useSvgId } from '../utils';

/** Props shared by every instrument. */
export interface InstrumentProps {
  /** Rendered width/height. Number = pixels, or any CSS length (e.g. `"100%"`). Default `200`. */
  size?: number | string;
  /** Draw the square mounting plate with screws behind the dial. Default `true`. */
  showBox?: boolean;
  /** Needle/card animation duration in ms. `0` disables animation. Default `300`. */
  animationDuration?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label; defaults to the instrument name plus its current reading. */
  title?: string;
}

interface FrameProps extends InstrumentProps {
  label: string;
  children: ReactNode;
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
  className,
  style,
  title,
  label,
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
      role="img"
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
    </svg>
  );
}

/** Centre hub drawn on top of needles. */
export function Hub({ r = 14 }: { r?: number }) {
  return <circle cx={CENTER} cy={CENTER} r={r} fill="#2a2a2a" stroke="#555" strokeWidth="2" />;
}
