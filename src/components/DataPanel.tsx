import { CENTER, finite } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** One readout on a `DataPanel`. */
export interface DataField {
  /** Short caption printed above the value, e.g. `"COM1"`. */
  name: string;
  /** Value to display. Strings are printed as given; numbers are formatted with `decimals`. */
  value: string | number;
  /** Unit printed after the value, e.g. `"MHz"`. */
  unit?: string;
  /** Decimal places for numeric values. Default `0`. */
  decimals?: number;
  /** Colour of the value text. Default white. */
  color?: string;
}

export interface DataPanelProps extends InstrumentProps {
  /** Readouts to show, laid out in a grid. At most `MAX_FIELDS` (6) are drawn; extra fields are ignored. */
  fields?: DataField[];
  /** Optional caption printed in the bezel above the panel. */
  heading?: string;
}

export const MAX_FIELDS = 6;

/** Side of the square panel inscribed in the dial, and its inner padding. */
const SIDE = 252;
const PAD = 8;
const GAP = 8;
const ORIGIN = CENTER - SIDE / 2;

/** Value font size per row count. */
const VALUE_SIZE: Record<number, number> = { 1: 52, 2: 36, 3: 27 };

export function formatValue(field: DataField): string {
  if (typeof field.value === 'string') return field.value;
  const n = finite(field.value, NaN);
  return Number.isNaN(n) ? '---' : n.toFixed(Math.max(0, Math.floor(finite(field.decimals, 0))));
}

export function DataPanel({ fields = [], heading, ...props }: DataPanelProps) {
  const shown = fields.slice(0, MAX_FIELDS);
  const cols = shown.length <= 2 ? 1 : 2;
  const rows = Math.max(1, Math.ceil(shown.length / cols));
  const cellW = (SIDE - PAD * 2 - GAP * (cols - 1)) / cols;
  const cellH = (SIDE - PAD * 2 - GAP * (rows - 1)) / rows;
  const valueSize = VALUE_SIZE[rows] ?? 27;

  const label =
    `${heading ?? 'Data panel'}: ` +
    (shown.length ? shown.map((f) => `${f.name} ${formatValue(f)}${f.unit ? ` ${f.unit}` : ''}`).join(', ') : 'no data');

  return (
    <InstrumentFrame {...props} label={label}>
      {heading && (
        <text x={CENTER} y={ORIGIN - 14} fill="#ccc" fontSize="13" fontWeight="bold" letterSpacing="2" textAnchor="middle" dominantBaseline="central">
          {heading.toUpperCase()}
        </text>
      )}

      {/* Square panel inscribed in the dial. */}
      <rect x={ORIGIN} y={ORIGIN} width={SIDE} height={SIDE} rx="10" fill="#1c1f24" stroke="#3a3f47" strokeWidth="2" />

      {shown.map((f, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = ORIGIN + PAD + col * (cellW + GAP);
        const y = ORIGIN + PAD + row * (cellH + GAP);
        const value = formatValue(f);
        // Shrink long values so they stay inside the cell.
        const fit = Math.min(valueSize, (cellW - 16) / (0.62 * Math.max(1, value.length)));
        return (
          <g key={i} data-testid={`data-field-${i}`}>
            <rect x={x} y={y} width={cellW} height={cellH} rx="6" fill="#000" stroke="#333" strokeWidth="1.5" />
            <text x={x + 8} y={y + 12} fill="#9aa4b1" fontSize="12" fontWeight="bold" letterSpacing="1" dominantBaseline="central">
              {f.name.toUpperCase()}
            </text>
            <text
              data-testid={`data-value-${i}`}
              x={x + cellW / 2}
              y={y + cellH / 2 + 7}
              fill={f.color ?? '#fff'}
              fontSize={fit}
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {value}
            </text>
            {f.unit && (
              <text x={x + cellW - 8} y={y + cellH - 12} fill="#9aa4b1" fontSize="12" textAnchor="end" dominantBaseline="central">
                {f.unit}
              </text>
            )}
          </g>
        );
      })}
    </InstrumentFrame>
  );
}
