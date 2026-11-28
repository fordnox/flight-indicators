import { PanelFrame, type InstrumentProps } from './Instrument';

/** One annunciator legend. */
export interface Annunciator {
  /** Key used in `lights`. */
  id: string;
  /** Legend text, e.g. `"OIL PRESS"`. */
  label: string;
  /** `"warning"` lights red, `"caution"` amber, `"advisory"` green. Default `"caution"`. */
  level?: 'warning' | 'caution' | 'advisory';
  /** Draws `L` and `R` either side of the legend, lit separately (e.g. `L FUEL R`). */
  split?: boolean;
}

/** State of one light: `true` lights it; for split legends `"left"`, `"right"` or `"both"` choose the side. */
export type AnnunciatorState = boolean | 'left' | 'right' | 'both';

export interface AnnunciatorPanelProps extends InstrumentProps {
  /** Legends, laid out left to right in up to two rows. Defaults to the Cessna 182T set, see `DEFAULT_ANNUNCIATORS`. */
  annunciators?: Annunciator[];
  /** Which lights are on, by annunciator `id`. Missing ids are off. */
  lights?: Record<string, AnnunciatorState | undefined>;
  /** Lamp test: lights every legend. Default `false`. */
  test?: boolean;
}

/** The Cessna 182T annunciator: L FUEL R, PITCH TRIM, OIL PRESS, L VAC R and VOLTS. */
export const DEFAULT_ANNUNCIATORS: Annunciator[] = [
  { id: 'fuel', label: 'FUEL', level: 'caution', split: true },
  { id: 'oil', label: 'OIL PRESS', level: 'warning' },
  { id: 'trim', label: 'PITCH TRIM', level: 'warning' },
  { id: 'vac', label: 'VAC', level: 'caution', split: true },
  { id: 'volts', label: 'VOLTS', level: 'warning' },
];

const COLORS = { warning: '#ff2a2a', caution: '#ffb000', advisory: '#3ddc3d' } as const;
const OFF = '#3a3a3a';
const W = 400;
const PAD_X = 44;

/** Resolves a light to which parts of a legend are lit. */
function litParts(state: AnnunciatorState | undefined, split: boolean, test: boolean) {
  if (test) return { left: true, right: true, main: true };
  if (!split) return { left: false, right: false, main: !!state };
  const left = state === true || state === 'left' || state === 'both';
  const right = state === true || state === 'right' || state === 'both';
  return { left, right, main: left || right };
}

/**
 * Annunciator strip: legends that are dark until lit in red (warning), amber (caution) or green (advisory).
 * Split legends such as `L FUEL R` light the side that has the fault.
 */
export function AnnunciatorPanel({ annunciators = DEFAULT_ANNUNCIATORS, lights = {}, test = false, ...props }: AnnunciatorPanelProps) {
  const items = annunciators.slice(0, 12);
  const rows = items.length > 3 ? 2 : 1;
  const cols = Math.max(1, Math.ceil(items.length / rows));
  const rowH = 34;
  const H = 28 + rows * rowH;
  const cellW = (W - 2 * PAD_X) / cols;

  const on: string[] = [];
  items.forEach((a) => {
    const p = litParts(lights[a.id], !!a.split, test);
    if (!p.main) return;
    if (a.split && !(p.left && p.right)) on.push(`${p.left ? 'L' : 'R'} ${a.label}`);
    else on.push(a.split ? `L ${a.label} R` : a.label);
  });

  return (
    <PanelFrame {...props} width={W} height={H} label={`Annunciator: ${on.length ? on.join(', ') : 'all clear'}`}>
      <rect x={PAD_X - 6} y="10" width={W - 2 * PAD_X + 12} height={H - 20} rx="4" fill="#0b0b0b" stroke="#000" strokeWidth="2" />
      {items.map((a, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const cx = PAD_X + col * cellW + cellW / 2;
        const cy = 14 + row * rowH + rowH / 2;
        const color = COLORS[a.level ?? 'caution'];
        const p = litParts(lights[a.id], !!a.split, test);
        const fill = (lit: boolean) => (lit ? color : OFF);
        const glow = (lit: boolean) => (lit ? { filter: `drop-shadow(0 0 3px ${color})` } : undefined);
        const fontSize = Math.min(15, (cellW - 10) / Math.max(4, (a.label.length + (a.split ? 4 : 0)) * 0.62));
        return (
          <g key={a.id} data-testid={`annunciator-${a.id}`} data-lit={p.main ? 'true' : 'false'} fontWeight="bold" fontSize={fontSize} dominantBaseline="central">
            <rect x={cx - cellW / 2 + 3} y={cy - rowH / 2 + 3} width={cellW - 6} height={rowH - 6} rx="2" fill="#141414" />
            {a.split ? (
              <text x={cx} y={cy} textAnchor="middle">
                <tspan data-testid={`annunciator-${a.id}-left`} fill={fill(p.left)} style={glow(p.left)}>L</tspan>
                <tspan fill={fill(p.main)} style={glow(p.main)}>{` ${a.label} `}</tspan>
                <tspan data-testid={`annunciator-${a.id}-right`} fill={fill(p.right)} style={glow(p.right)}>R</tspan>
              </text>
            ) : (
              <text x={cx} y={cy} textAnchor="middle" fill={fill(p.main)} style={glow(p.main)}>
                {a.label}
              </text>
            )}
          </g>
        );
      })}
    </PanelFrame>
  );
}
