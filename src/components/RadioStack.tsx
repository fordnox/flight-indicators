import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { formatAdf, formatDme, formatNav, type RadioFrequency } from './RadioPanel';

export interface RadioStackProps {
  /** NAV (VOR/LOC) receiver, in MHz. Pass it to control the component; leave it out and it keeps its own state. */
  nav?: RadioFrequency;
  /** ADF receiver, in kHz. Pass it to control the component; leave it out and it keeps its own state. */
  adf?: RadioFrequency;
  /** Starting NAV frequencies when `nav` is not controlled. */
  defaultNav?: RadioFrequency;
  /** Starting ADF frequencies when `adf` is not controlled. */
  defaultAdf?: RadioFrequency;
  /** Called when the NAV standby frequency is entered or the frequencies are swapped. */
  onNavChange?: (next: RadioFrequency) => void;
  /** Called when the ADF standby frequency is entered or the frequencies are swapped. */
  onAdfChange?: (next: RadioFrequency) => void;
  /** Identifier of the station received on the active NAV frequency, e.g. `"KNA"`. Shown under the NAV label. */
  navIdent?: string;
  /** Identifier of the station received on the active ADF frequency. Shown under the ADF label. */
  adfIdent?: string;
  /** DME distance to the station in nautical miles. Leave out (or pass `NaN`) to show dashes. */
  dme?: number;
  /** Colour of the digits. Default amber. */
  color?: string;
  /** Rendered width. Number = pixels, or any CSS length (e.g. `"100%"`). Everything scales with it. Default `320`. */
  width?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Accessible name of the group. Default `"Radio panel"`. */
  title?: string;
}

/** NAV receivers tune 108.00–117.95 MHz. */
export const parseNav = (text: string): number | undefined => {
  const mhz = Math.round(Number.parseFloat(text.replace(',', '.')) * 100) / 100;
  return mhz >= 108 && mhz <= 117.95 ? mhz : undefined;
};
/** ADF receivers tune 190–1750 kHz. */
export const parseAdf = (text: string): number | undefined => {
  const khz = Math.round(Number.parseFloat(text.replace(',', '.')) * 10) / 10;
  return khz >= 190 && khz <= 1750 ? khz : undefined;
};

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const LABEL = '#ccc';
const MUTED = '#9aa4b1';

const display: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  height: '2.1em',
  margin: 0,
  padding: '0 0.1em',
  borderRadius: '0.25em',
  border: '0.08em solid #3a2a14',
  background: '#1a0d00',
  fontFamily: MONO,
  fontSize: '1.2em',
  fontWeight: 'bold',
  lineHeight: '2em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const label: CSSProperties = { display: 'flex', flexDirection: 'column', justifyContent: 'center', color: LABEL, fontWeight: 'bold', letterSpacing: '0.06em', lineHeight: 1.15 };
const ident: CSSProperties = { color: '#3cc8ff', fontSize: '0.72em', fontFamily: MONO, minHeight: '1.15em' };

function SwapIcon() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5 H14 M11 2.5 l3 3 l-3 3" />
      <path d="M14 10.5 H2 M5 7.5 l-3 3 l3 3" />
    </svg>
  );
}

interface ReceiverProps {
  name: string;
  unit: string;
  value: RadioFrequency;
  ident?: string;
  color: string;
  format: (frequency?: number) => string;
  parse: (text: string) => number | undefined;
  onChange: (next: RadioFrequency) => void;
}

/** One receiver row: label, active display, transfer button and an editable standby display. */
function Receiver({ name, unit, value, ident: station, color, format, parse, onChange }: ReceiverProps) {
  // `draft` is the text being typed; `null` while the standby box is not being edited.
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const key = name.toLowerCase();
  const shown = value.standby === undefined ? '' : format(value.standby);
  const swap = (standby = value.standby) => onChange({ active: standby, standby: value.active });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDraft(null);
      setInvalid(false);
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = (draft ?? shown).trim();
    const standby = text ? parse(text) : undefined;
    if (text && standby === undefined) return setInvalid(true);
    // Enter tunes what was typed: it becomes active and the old active frequency drops to standby.
    setDraft(null);
    setInvalid(false);
    swap(standby);
  };

  const onBlur = () => {
    setFocused(false);
    setInvalid(false);
    if (draft === null) return;
    const text = draft.trim();
    const standby = text ? parse(text) : undefined;
    setDraft(null);
    // Text that is not a frequency is dropped and the previous standby stays.
    if ((text && standby === undefined) || standby === value.standby) return;
    onChange({ active: value.active, standby });
  };

  return (
    <>
      <div style={label}>
        <span>{name}</span>
        <span data-testid={`radio-stack-${key}-ident`} style={ident}>
          {station ?? ''}
        </span>
      </div>
      <div data-testid={`radio-stack-${key}-active`} aria-label={`${name} active frequency`} style={{ ...display, color }}>
        {format(value.active)}
      </div>
      <button
        type="button"
        onClick={() => swap()}
        aria-label={`Swap ${name} active and standby`}
        title="Swap active and standby"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '2em', padding: 0, margin: 0, border: '0.08em solid #555', borderRadius: '0.3em', background: '#3a3a3a', color: '#ddd', font: 'inherit', fontSize: '1.2em', cursor: 'pointer' }}
      >
        <SwapIcon />
      </button>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        data-testid={`radio-stack-${key}-standby`}
        aria-label={`${name} standby frequency (${unit})`}
        aria-invalid={invalid || undefined}
        placeholder={format(undefined)}
        value={draft ?? shown}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={{ ...display, color, outline: 'none', borderColor: invalid ? '#ff4d4d' : focused ? color : '#3a2a14', cursor: 'text' }}
      />
    </>
  );
}

const SCREWS: CSSProperties[] = [
  { top: '0.3em', left: '0.3em' },
  { top: '0.3em', right: '0.3em' },
  { bottom: '0.3em', left: '0.3em' },
  { bottom: '0.3em', right: '0.3em' },
];

/**
 * An interactive navigation radio: NAV and ADF receivers with an active frequency, an editable standby
 * frequency and a transfer button each, plus a DME distance readout.
 * Unlike the instruments it is an HTML control, not an SVG dial.
 */
export function RadioStack({
  nav,
  adf,
  defaultNav,
  defaultAdf,
  onNavChange,
  onAdfChange,
  navIdent,
  adfIdent,
  dme,
  color = '#ff9a2e',
  width = 320,
  className,
  style,
  title = 'Radio panel',
}: RadioStackProps) {
  const [innerNav, setInnerNav] = useState<RadioFrequency>(defaultNav ?? {});
  const [innerAdf, setInnerAdf] = useState<RadioFrequency>(defaultAdf ?? {});
  const changeNav = (next: RadioFrequency) => {
    if (nav === undefined) setInnerNav(next);
    onNavChange?.(next);
  };
  const changeAdf = (next: RadioFrequency) => {
    if (adf === undefined) setInnerAdf(next);
    onAdfChange?.(next);
  };
  const heading: CSSProperties = { color: MUTED, fontSize: '0.72em', fontWeight: 'bold', letterSpacing: '0.12em', textAlign: 'center' };

  return (
    // The outer box is a size container so every inner measurement can follow the width.
    <div className={className} style={{ display: 'inline-block', width, maxWidth: '100%', verticalAlign: 'top', containerType: 'inline-size', ...style }}>
      <div
        role="group"
        aria-label={title}
        style={{
          position: 'relative',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: '2.6em minmax(0, 1fr) 2.4em minmax(0, 1fr)',
          gap: '0.5em 0.4em',
          alignItems: 'center',
          padding: '1.1em 1.2em 1.2em',
          borderRadius: '0.9em',
          border: '0.15em solid #0d0d0d',
          background: '#232323',
          color: LABEL,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
          fontSize: '5cqw',
          textAlign: 'left',
          userSelect: 'none',
        }}
      >
        {/* Same slotted screws as the instrument mounting plates. */}
        {SCREWS.map((position, i) => (
          <svg key={i} viewBox="-14 -14 28 28" aria-hidden="true" style={{ position: 'absolute', width: '0.75em', height: '0.75em', ...position }}>
            <circle r="12" fill="#3a3a3a" stroke="#111" strokeWidth="2" />
            <path d="M -8 3 L 8 -3" stroke="#111" strokeWidth="3" />
          </svg>
        ))}

        <span />
        <span style={heading}>ACTIVE</span>
        <span />
        <span style={heading}>STBY</span>

        <Receiver name="NAV" unit="MHz" value={nav ?? innerNav} ident={navIdent} color={color} format={formatNav} parse={parseNav} onChange={changeNav} />
        <Receiver name="ADF" unit="kHz" value={adf ?? innerAdf} ident={adfIdent} color={color} format={formatAdf} parse={parseAdf} onChange={changeAdf} />

        <div style={label}>DME</div>
        <div aria-label="DME distance" style={{ ...display, gridColumn: 'span 3', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.4em', padding: '0 0.5em', color }}>
          <span data-testid="radio-stack-dme">{formatDme(dme)}</span>
          <span style={{ color: MUTED, fontFamily: "'Helvetica Neue', Arial, sans-serif", fontSize: '0.5em' }}>NM</span>
        </div>
      </div>
    </div>
  );
}
