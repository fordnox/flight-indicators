import { CENTER } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** Active and standby frequency of one receiver. Leave a value out to show dashes. */
export interface RadioFrequency {
  active?: number;
  standby?: number;
}

export interface RadioPanelProps extends InstrumentProps {
  /** NAV (VOR/LOC) receiver frequencies in MHz, shown with two decimals. */
  nav?: RadioFrequency;
  /** ADF receiver frequencies in kHz. */
  adf?: RadioFrequency;
  /** DME distance to the station in nautical miles. Leave out (or pass `NaN`) to show dashes. */
  dme?: number;
  /** Colour of the digits. Default amber. */
  color?: string;
}

/** Side of the square panel inscribed in the dial. */
const SIDE = 252;
const ORIGIN = CENTER - SIDE / 2;
const ROW_H = 60;
const ROW_GAP = 8;
const FIRST_ROW = ORIGIN + 32;
const LABEL_X = ORIGIN + 10;
const ACTIVE_X = ORIGIN + 48;
const DISPLAY_W = 88;
const STANDBY_X = ORIGIN + SIDE - 8 - DISPLAY_W;
const SWAP_X = (ACTIVE_X + DISPLAY_W + STANDBY_X) / 2;

const usable = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** NAV frequency in MHz as `116.80`, or dashes. */
export const formatNav = (mhz?: number): string => (usable(mhz) ? mhz.toFixed(2) : '---.--');
/** ADF frequency in kHz as `362` (or `362.5`), or dashes. */
export const formatAdf = (khz?: number): string =>
  usable(khz) ? (Number.isInteger(khz) ? String(khz) : khz.toFixed(1)) : '---';
/** DME distance in NM: one decimal below 100 NM, whole miles above, or dashes. */
export const formatDme = (nm?: number): string => (usable(nm) ? (nm < 99.95 ? nm.toFixed(1) : nm.toFixed(0)) : '--.-');

function Display({ x, y, width, value, color, testId, unit }: { x: number; y: number; width: number; value: string; color: string; testId: string; unit?: string }) {
  const h = ROW_H - 16;
  return (
    <g>
      <rect x={x} y={y + 8} width={width} height={h} rx="5" fill="#1a0d00" stroke="#3a2a14" strokeWidth="1.5" />
      <text
        data-testid={testId}
        x={unit ? x + width - 40 : x + width / 2}
        y={y + ROW_H / 2 + 1}
        fill={color}
        fontSize={unit ? 28 : 22}
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor={unit ? 'end' : 'middle'}
        dominantBaseline="central"
      >
        {value}
      </text>
      {unit && (
        <text x={x + width - 10} y={y + ROW_H / 2 + 5} fill="#9aa4b1" fontSize="13" fontWeight="bold" textAnchor="end" dominantBaseline="central">
          {unit}
        </text>
      )}
    </g>
  );
}

/** Active ⇄ standby transfer symbol. */
function Swap({ y }: { y: number }) {
  const cy = y + ROW_H / 2;
  return (
    <g stroke="#9aa4b1" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${SWAP_X - 7} ${cy - 4} H ${SWAP_X + 7} m -4 -3 l 4 3 l -4 3`} />
      <path d={`M ${SWAP_X + 7} ${cy + 4} H ${SWAP_X - 7} m 4 -3 l -4 3 l 4 3`} />
    </g>
  );
}

function RowLabel({ y, children }: { y: number; children: string }) {
  return (
    <text x={LABEL_X} y={y + ROW_H / 2 + 1} fill="#ccc" fontSize="14" fontWeight="bold" letterSpacing="1" dominantBaseline="central">
      {children}
    </text>
  );
}

export function RadioPanel({ nav, adf, dme, color = '#ff9a2e', ...props }: RadioPanelProps) {
  const rows = [
    { key: 'nav', name: 'NAV', unit: 'MHz', active: formatNav(nav?.active), standby: formatNav(nav?.standby), tuned: usable(nav?.active) },
    { key: 'adf', name: 'ADF', unit: 'kHz', active: formatAdf(adf?.active), standby: formatAdf(adf?.standby), tuned: usable(adf?.active) },
  ];
  const dmeText = formatDme(dme);
  const dmeY = FIRST_ROW + 2 * (ROW_H + ROW_GAP);

  const label =
    'Radio panel: ' +
    rows.map((r) => `${r.name} ${r.tuned ? `${r.active} ${r.unit}` : 'not tuned'}`).join(', ') +
    `, DME ${usable(dme) ? `${dmeText} NM` : 'no distance'}`;

  return (
    <InstrumentFrame {...props} label={label}>
      <rect x={ORIGIN} y={ORIGIN} width={SIDE} height={SIDE} rx="10" fill="#1c1f24" stroke="#3a3f47" strokeWidth="2" />

      <g fill="#9aa4b1" fontSize="11" fontWeight="bold" letterSpacing="1.5" textAnchor="middle" dominantBaseline="central">
        <text x={ACTIVE_X + DISPLAY_W / 2} y={ORIGIN + 22}>ACTIVE</text>
        <text x={STANDBY_X + DISPLAY_W / 2} y={ORIGIN + 22}>STBY</text>
      </g>

      {rows.map((r, i) => {
        const y = FIRST_ROW + i * (ROW_H + ROW_GAP);
        return (
          <g key={r.key}>
            <RowLabel y={y}>{r.name}</RowLabel>
            <Display x={ACTIVE_X} y={y} width={DISPLAY_W} value={r.active} color={color} testId={`radio-${r.key}-active`} />
            <Swap y={y} />
            <Display x={STANDBY_X} y={y} width={DISPLAY_W} value={r.standby} color={color} testId={`radio-${r.key}-standby`} />
          </g>
        );
      })}

      <RowLabel y={dmeY}>DME</RowLabel>
      <Display x={ACTIVE_X} y={dmeY} width={STANDBY_X + DISPLAY_W - ACTIVE_X} value={dmeText} color={color} testId="radio-dme" unit="NM" />
    </InstrumentFrame>
  );
}
