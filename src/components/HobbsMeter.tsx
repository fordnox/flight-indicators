import { finite, useSvgId } from '../utils';
import { PanelFrame, type InstrumentProps } from './Instrument';
import { Odometer } from './Odometer';

export interface HobbsMeterProps extends InstrumentProps {
  /** Hours run. The last drum shows tenths. Negative values are read as `0`. */
  hours?: number;
  /** Number of drums, tenths included. Default `6` (99999.9 hours). */
  digits?: number;
  /** Turns the running indicator. Default `false`. */
  running?: boolean;
  /** Caption above the counter. Default `"HOURS"`. */
  label?: string;
}

const W = 400;
const H = 170;

/**
 * Hobbs (hour) meter: a rolling-drum hour counter with tenths on a white drum, and a small
 * indicator wheel that turns while the meter is running.
 */
export function HobbsMeter({ hours = 0, digits = 6, running = false, label = 'HOURS', ...props }: HobbsMeterProps) {
  const clipId = useSvgId('fi-hobbs');
  const value = Math.max(0, finite(hours));
  const n = Math.min(8, Math.max(2, Math.floor(finite(digits, 6))));
  const digitW = Math.min(40, 260 / n);
  const counterRight = W / 2 + 10 + (n * digitW) / 2;
  return (
    <PanelFrame {...props} width={W} height={H} label={`${label}: ${value.toFixed(1)}${running ? ', running' : ''}`}>
      <rect x="44" y="18" width={W - 88} height={H - 36} rx="10" fill="#111" stroke="#000" strokeWidth="3" />
      <text x={W / 2 + 10} y="44" fill="#ddd" fontSize="15" fontWeight="bold" textAnchor="middle" letterSpacing="3">
        {label}
      </text>
      <Odometer value={value} digits={n} x={W / 2 + 10} y={92} digitWidth={digitW} height={52} clipId={clipId} testId="hobbs" />
      <text x={counterRight - digitW / 2} y="136" fill="#999" fontSize="11" textAnchor="middle">
        1/10
      </text>
      {/* Running indicator: a little wheel with a white segment that turns while the meter counts. */}
      <g data-testid="hobbs-running" data-running={running ? 'true' : 'false'}>
        <circle cx="66" cy="92" r="13" fill="#000" stroke="#555" strokeWidth="2" />
        <g>
          <path d="M 66 92 L 66 80 A 12 12 0 0 1 76.4 86 Z" fill={running ? '#eee' : '#666'} />
          <path d="M 66 92 L 66 104 A 12 12 0 0 1 55.6 98 Z" fill={running ? '#eee' : '#666'} />
          {running && <animateTransform attributeName="transform" type="rotate" from="0 66 92" to="360 66 92" dur="2s" repeatCount="indefinite" />}
        </g>
      </g>
    </PanelFrame>
  );
}
