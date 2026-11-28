import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, useSvgId } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export interface TrimIndicatorProps extends InstrumentProps {
  /** Elevator trim from `-1` (full nose down) to `1` (full nose up). `0` is neutral. */
  trim?: number;
  /** Take-off range `[from, to]` on the same −1…1 scale, drawn as a white band. Default `[0.05, 0.35]`. `null` hides it. */
  takeoff?: [number, number] | null;
}

const SLOT_X = 248;
const TOP = 74;
const BOTTOM = 326;
const MID = (TOP + BOTTOM) / 2;
const HALF = (BOTTOM - TOP) / 2;
const WHEEL_X = 150;
const WHEEL_W = 56;
/** How far the wheel's ribs move for full trim travel. */
const WHEEL_TRAVEL = 140;
const RIB = 14;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Elevator trim wheel and position indicator, as on the pedestal: NOSE DOWN at the top, NOSE UP at the bottom,
 * a pointer on the scale and a white TAKE OFF band. The wheel's ribs roll with the trim.
 */
export function TrimIndicator({ trim = 0, takeoff = [0.05, 0.35], ...props }: TrimIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const clipId = useSvgId('fi-trim-wheel');
  const value = clamp(finite(trim), -1, 1);
  const yAt = (t: number) => round2(MID + clamp(t, -1, 1) * HALF);
  const inTakeoff = takeoff ? value >= Math.min(...takeoff) && value <= Math.max(...takeoff) : false;
  const percent = Math.round(Math.abs(value) * 100);
  const describe = percent === 0 ? 'neutral' : `${percent}% nose ${value > 0 ? 'up' : 'down'}`;
  const ribCount = Math.ceil((BOTTOM - TOP + 2 * WHEEL_TRAVEL) / RIB) + 1;

  return (
    <InstrumentFrame {...props} label={`Elevator trim: ${describe}${inTakeoff ? ', take-off range' : ''}`}>
      {/* Trim wheel, seen edge-on through its slot. */}
      <defs>
        <clipPath id={clipId}>
          <rect x={WHEEL_X - WHEEL_W / 2} y={TOP} width={WHEEL_W} height={BOTTOM - TOP} rx="10" />
        </clipPath>
      </defs>
      <rect x={WHEEL_X - WHEEL_W / 2 - 6} y={TOP - 6} width={WHEEL_W + 12} height={BOTTOM - TOP + 12} rx="14" fill="#000" stroke="#333" strokeWidth="2" />
      <g clipPath={`url(#${clipId})`}>
        <rect x={WHEEL_X - WHEEL_W / 2} y={TOP} width={WHEEL_W} height={BOTTOM - TOP} fill="#2c2c2c" />
        <g data-testid="trim-wheel" style={motionStyle(`translate(0px, ${round2(value * WHEEL_TRAVEL)}px)`, duration)}>
          {Array.from({ length: ribCount }, (_, i) => (
            <rect key={i} x={WHEEL_X - WHEEL_W / 2} y={TOP - WHEEL_TRAVEL + i * RIB} width={WHEEL_W} height={RIB / 2} fill="#121212" />
          ))}
        </g>
        {/* Shading so the wheel looks round. */}
        <rect x={WHEEL_X - WHEEL_W / 2} y={TOP} width={WHEEL_W} height="40" fill="#000" opacity="0.5" />
        <rect x={WHEEL_X - WHEEL_W / 2} y={BOTTOM - 40} width={WHEEL_W} height="40" fill="#000" opacity="0.5" />
      </g>

      {/* Indicator slot with scale. */}
      <rect x={SLOT_X - 7} y={TOP} width="14" height={BOTTOM - TOP} rx="7" fill="#000" stroke="#444" strokeWidth="2" />
      <g stroke="#ddd" strokeWidth="2">
        {Array.from({ length: 11 }, (_, i) => {
          const y = TOP + (i * (BOTTOM - TOP)) / 10;
          return <path key={i} d={`M ${SLOT_X + 12} ${y} h ${i === 5 ? 20 : 12}`} />;
        })}
      </g>
      {takeoff && (
        <g data-testid="trim-takeoff">
          <rect x={SLOT_X - 20} y={yAt(Math.min(...takeoff))} width="8" height={Math.max(2, yAt(Math.max(...takeoff)) - yAt(Math.min(...takeoff)))} fill="#fff" />
          <text
            x={SLOT_X - 30}
            y={(yAt(takeoff[0]) + yAt(takeoff[1])) / 2}
            fill="#fff"
            fontSize="12"
            fontWeight="bold"
            textAnchor="end"
            dominantBaseline="central"
          >
            TAKE OFF
          </text>
        </g>
      )}
      <g data-testid="trim-pointer" style={motionStyle(`translate(0px, ${round2(value * HALF)}px)`, duration)}>
        <path d={`M ${SLOT_X + 8} ${MID} l 26 -11 v 22 z`} fill="#fff" stroke="#000" strokeWidth="1.5" />
        <rect x={SLOT_X - 5} y={MID - 4} width="10" height="8" rx="2" fill="#fff" />
      </g>

      <g fill="#ddd" fontSize="15" fontWeight="bold" textAnchor="middle">
        <text x={CENTER + 92} y={TOP - 14}>NOSE</text>
        <text x={CENTER + 92} y={TOP + 2}>DOWN</text>
        <text x={CENTER + 92} y={BOTTOM + 8}>NOSE</text>
        <text x={CENTER + 92} y={BOTTOM + 24}>UP</text>
      </g>
      <text x={WHEEL_X} y={BOTTOM + 32} fill="#ccc" fontSize="14" textAnchor="middle" letterSpacing="2">TRIM</text>
    </InstrumentFrame>
  );
}
