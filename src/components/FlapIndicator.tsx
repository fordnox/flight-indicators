import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** Maximum speed allowed once the flaps are at or beyond `flaps` degrees. */
export interface FlapSpeedLimit {
  flaps: number;
  /** Speed in knots. */
  speed: number;
}

export interface FlapIndicatorProps extends InstrumentProps {
  /** Flap position in degrees, 0 = retracted. Clamped to `0…max`. */
  flaps?: number;
  /** Full flap deflection in degrees. Default `40`. */
  max?: number;
  /** Scale labels in degrees. Default every 10° from 0 to `max`. */
  detents?: number[];
  /** Number of LED segments in the bar. Default `20`. */
  segments?: number;
  /**
   * Flap extension speed limits (Vfe) in knots. The entry with the largest `flaps` at or below the
   * current position is shown as the MAX speed. Omit to hide the speed readout.
   */
  speedLimits?: FlapSpeedLimit[];
  /** Current airspeed in knots. When above the limit for the current flap setting the readout turns red. */
  airspeed?: number;

  /** Caption at the bottom of the dial. Default `"WING FLAP"`. */
  label?: string;
}

const GREEN = '#3ddc3d';
const YELLOW = '#ffd400';
const ORANGE = '#ff8a00';
const RED = '#ff2a2a';


/** Bar geometry: 0° at the top, `max` at the bottom. */
const BAR_X = 226;
const BAR_W = 30;
const BAR_TOP = 78;
const BAR_BOTTOM = 302;
const BAR_H = BAR_BOTTOM - BAR_TOP;

/** Segment colour by how far down the bar it sits: green at the top through red at the bottom. */
function segmentColor(fraction: number): string {
  if (fraction < 0.25) return GREEN;
  if (fraction < 0.5) return YELLOW;
  if (fraction < 0.75) return ORANGE;
  return RED;
}

export function FlapIndicator({
  flaps = 0,
  max = 40,
  detents,
  segments = 20,
  speedLimits,
  airspeed,
  label = 'WING FLAP',
  ...props
}: FlapIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const full = Math.max(1e-9, finite(max, 40));
  const position = clamp(finite(flaps), 0, full);
  const fraction = position / full;
  const count = Math.max(1, Math.floor(finite(segments, 20)));
  const lit = Math.round(fraction * count);
  const scale = (detents ?? Array.from({ length: Math.floor(full / 10) + 1 }, (_, i) => i * 10)).filter((d) => d >= 0 && d <= full);
  const yAt = (deg: number) => Math.round((BAR_TOP + (deg / full) * BAR_H) * 100) / 100;

  const limit = (speedLimits ?? [])
    .filter((l) => Number.isFinite(l.flaps) && Number.isFinite(l.speed) && l.flaps <= position)
    .sort((a, b) => b.flaps - a.flaps)[0];
  const ias = finite(airspeed, NaN);
  const overspeed = limit !== undefined && !Number.isNaN(ias) && ias > limit.speed;

  const segH = BAR_H / count;
  const title =
    `${label}: ${Math.round(position)}° of ${Math.round(full)}°` +
    (limit ? `, max ${Math.round(limit.speed)} knots${overspeed ? ' (overspeed)' : ''}` : '');

  return (
    <InstrumentFrame {...props} label={title}>
      {/* LED bar: every segment is drawn, lit ones are bright. */}
      <rect x={BAR_X - BAR_W / 2 - 4} y={BAR_TOP - 4} width={BAR_W + 8} height={BAR_H + 8} rx="4" fill="#000" stroke="#333" strokeWidth="1.5" />
      {Array.from({ length: count }, (_, i) => {
        const y = BAR_TOP + i * segH;
        const on = i < lit;
        return (
          <rect
            key={i}
            data-testid={`flap-segment-${i}`}
            data-lit={on ? 'true' : 'false'}
            x={BAR_X - BAR_W / 2}
            y={y + 1}
            width={BAR_W}
            height={Math.max(1, segH - 2)}
            rx="1.5"
            fill={segmentColor((i + 0.5) / count)}
            opacity={on ? 1 : 0.18}
            style={{ transition: 'opacity 150ms ease-out' }}
          />
        );
      })}

      {/* Scale on the right. */}
      <g fill="#fff" fontSize="18" fontWeight="bold" dominantBaseline="central">
        {scale.map((d) => (
          <g key={d}>
            <path d={`M ${BAR_X + BAR_W / 2 + 8} ${yAt(d)} h 8`} stroke="#fff" strokeWidth="2" />
            <text x={BAR_X + BAR_W / 2 + 22} y={yAt(d)}>
              {d}
            </text>
          </g>
        ))}
      </g>

      {/* Pointer on the left at the exact position. */}
      <g data-testid="flap-pointer" style={motionStyle(`translate(0px, ${yAt(position) - BAR_TOP}px)`, duration)}>
        <path d={`M ${BAR_X - BAR_W / 2 - 8} ${BAR_TOP} l -14 -8 v 16 z`} fill="#fff" stroke="#000" strokeWidth="1" />
      </g>

      {/* Max speed for the current setting. */}
      {limit && (
        <g textAnchor="middle" dominantBaseline="central" fill={overspeed ? RED : '#fff'}>
          <text data-testid="flap-speed" x={118} y={176} fontSize="36" fontWeight="bold">
            {Math.round(limit.speed)}
            <tspan fontSize="13" dx="3">
              KTS
            </tspan>
          </text>
          <text x={118} y={212} fontSize="13" fontWeight="bold" fill="#bbb" letterSpacing="2">
            MAX
          </text>
        </g>
      )}

      <text x={CENTER} y={345} fill="#ccc" fontSize="16" textAnchor="middle">{label.toUpperCase()}</text>
    </InstrumentFrame>
  );
}
