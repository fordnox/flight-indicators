import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CENTER, clamp, finite, useSvgId } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

/** Clock / timer shown on the lower display: universal time, local time, flight time or elapsed time. */
export type ClockMode = 'UT' | 'LT' | 'FT' | 'ET';
/** Reading shown on the upper display: bus voltage, or outside air temperature in °F or °C. */
export type UpperDisplay = 'volts' | 'F' | 'C';
/** Alarms the clock raises. Each one flashes its display until any button is pressed. */
export type ClockAlarm = 'voltage' | 'flightTime' | 'countdown';

export interface DigitalClockProps extends InstrumentProps {
  /** Outside air temperature in °C. Leave out (or pass `NaN`) to show dashes. */
  oat?: number;
  /** Bus voltage. Leave out (or pass `NaN`) to show dashes. */
  volts?: number;
  /** Upper display reading. Pass it to control the component; leave it out and the O.A.T / VOLTS button cycles it. */
  upperDisplay?: UpperDisplay;
  /** Starting upper display reading when `upperDisplay` is not controlled. Default `"volts"`. */
  defaultUpperDisplay?: UpperDisplay;
  /** Called when the O.A.T / VOLTS button picks the next reading. */
  onUpperDisplayChange?: (next: UpperDisplay) => void;
  /** Lower display mode. Pass it to control the component; leave it out and the SELECT button cycles it. */
  mode?: ClockMode;
  /** Starting lower display mode when `mode` is not controlled. Default `"UT"`. */
  defaultMode?: ClockMode;
  /** Called when SELECT picks the next mode, or an alarm brings its mode up. */
  onModeChange?: (next: ClockMode) => void;
  /** Current time. Leave out to run from the system clock; pass simulator time to run the clock, FT and ET from it. */
  now?: number | Date;
  /** Local time offset from UT in minutes, e.g. `120` for UTC+2. Pass it to control the component. */
  localOffset?: number;
  /** Starting local time offset when `localOffset` is not controlled. Default: the browser's time zone. */
  defaultLocalOffset?: number;
  /** Called when local time is set with the buttons. */
  onLocalOffsetChange?: (minutes: number) => void;
  /** Called with the new universal time after UT is set with the buttons. */
  onTimeSet?: (utc: Date) => void;
  /** Whether flight time is counting, e.g. `airspeed > 50` or engine running. Default `true`. */
  flightTimeRunning?: boolean;
  /** Flight time already logged when the component mounts, in seconds. Default `0`. */
  defaultFlightTime?: number;
  /** Flight time in seconds at which the flight time alarm goes off. `0` turns it off. Can also be set with the buttons. Default `0`. */
  defaultFlightTimeAlarm?: number;
  /** Starting count-down time for ET in seconds. `0` makes ET count up. Can also be set with the buttons. Default `0`. */
  defaultCountdown?: number;
  /** Voltage below which the low voltage alarm goes off. Default `24.5` on a 28 V system, `12.4` on a 14 V system. */
  lowVoltage?: number;
  /** Voltage above which the high voltage alarm goes off. Default `32` on a 28 V system, `16` on a 14 V system. */
  highVoltage?: number;
  /** Called when an alarm goes off. */
  onAlarm?: (alarm: ClockAlarm) => void;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** How long a button must be held for its second function, in ms. */
export const HOLD_TIME = 2000;

const MODES: ClockMode[] = ['UT', 'LT', 'FT', 'ET'];
const UPPER: UpperDisplay[] = ['volts', 'F', 'C'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** A timer that can be paused: time banked so far plus when it was last started (`null` while stopped). */
interface Stopwatch {
  acc: number;
  since: number | null;
}
const readWatch = (w: Stopwatch, t: number) => w.acc + (w.since === null ? 0 : Math.max(0, t - w.since));
const startWatch = (w: Stopwatch, t: number): Stopwatch => (w.since === null ? { acc: w.acc, since: t } : w);
const stopWatch = (w: Stopwatch, t: number): Stopwatch => (w.since === null ? w : { acc: readWatch(w, t), since: null });

/** Timer digits as on the unit: `MM:SS` for the first hour, then `HH:MM` (wrapping after 99:59). */
function timerDigits(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 3600) return pad2(Math.floor(s / 60)) + pad2(s % 60);
  return pad2(Math.floor(s / 3600) % 100) + pad2(Math.floor(s / 60) % 60);
}

/** Formats a timer in seconds the way the clock shows it: `MM:SS` under an hour, `HH:MM` from then on. */
export function formatTimer(seconds: number): string {
  const d = timerDigits(finite(seconds) * 1000);
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Text of the upper display: three seven-segment cells (a `.` attaches to the cell before it) and the unit. */
function upperText(display: UpperDisplay, oat: number, volts: number): [string, string] {
  if (display === 'volts') {
    if (Number.isNaN(volts)) return ['---', 'V'];
    const v = clamp(volts, 0, 99.9);
    return [v.toFixed(1).padStart(4, ' '), 'V'];
  }
  if (Number.isNaN(oat)) return ['---', `°${display}`];
  const t = display === 'F' ? (oat * 9) / 5 + 32 : oat;
  return [String(Math.round(clamp(t, -99, 999))).padStart(3, ' '), `°${display}`];
}

// ---------- Seven-segment drawing ----------

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
const GLYPHS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

function segmentPaths(w: number, h: number): Record<Seg, string> {
  const t = w * 0.2;
  const half = t / 2;
  const gap = t * 0.2;
  const pts = (p: Array<[number, number]>) => p.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
  const hs = (y: number) => {
    const x1 = half + gap;
    const x2 = w - half - gap;
    return pts([[x1, y], [x1 + half, y - half], [x2 - half, y - half], [x2, y], [x2 - half, y + half], [x1 + half, y + half]]);
  };
  const vs = (x: number, y1: number, y2: number) =>
    pts([[x, y1], [x + half, y1 + half], [x + half, y2 - half], [x, y2], [x - half, y2 - half], [x - half, y1 + half]]);
  return {
    a: hs(half),
    g: hs(h / 2),
    d: hs(h - half),
    f: vs(half, half + gap, h / 2 - gap),
    b: vs(w - half, half + gap, h / 2 - gap),
    e: vs(half, h / 2 + gap, h - half - gap),
    c: vs(w - half, h / 2 + gap, h - half - gap),
  };
}

interface CellProps {
  x: number;
  y: number;
  w: number;
  h: number;
  char: string;
  dot?: boolean;
  on: string;
  off: string;
  testId?: string;
}

/** One seven-segment digit; unlit segments are drawn faintly, as on a real LCD. */
function Cell({ x, y, w, h, char, dot, on, off, testId }: CellProps) {
  const paths = segmentPaths(w, h);
  const lit = GLYPHS[char] ?? '';
  return (
    <g transform={`translate(${x + h * 0.05} ${y}) skewX(-5)`} data-testid={testId} data-char={char}>
      {(Object.keys(paths) as Seg[]).map((s) => (
        <polygon key={s} points={paths[s]} fill={lit.includes(s) ? on : off} />
      ))}
      <circle cx={w + w * 0.2} cy={h - w * 0.1} r={w * 0.1} fill={dot ? on : off} />
    </g>
  );
}

// ---------- Component ----------

type Button = 'oatVolts' | 'select' | 'control';
interface Editing {
  target: ClockMode;
  digits: number[];
  index: number;
}

/** Largest value each digit can take while setting `target`. */
function digitMax(target: ClockMode, digits: number[], i: number): number {
  if (target === 'ET') return [5, 9, 5, 9][i] ?? 9;
  if (target === 'FT') return [9, 9, 5, 9][i] ?? 9;
  if (i === 0) return 2;
  if (i === 1) return digits[0] === 2 ? 3 : 9;
  return [5, 9][i - 2] ?? 9;
}
/** LT only sets the hours: its minutes always follow UT. */
const lastDigit = (target: ClockMode) => (target === 'LT' ? 1 : 3);
const twoDigits = (d: number[], i: number) => (d[i] ?? 0) * 10 + (d[i + 1] ?? 0);

const LCD = '#9da793';
const INK = '#1f241d';
const GHOST = 'rgba(31,36,29,0.07)';
const FACE_TEXT = '#e6e6e6';

/** Where each button sits, its label and its accessible name. */
const BUTTONS: Record<Button, { cx: number; cy: number; name: string }> = {
  oatVolts: { cx: CENTER, cy: 56, name: 'O.A.T / VOLTS' },
  select: { cx: 140, cy: 330, name: 'SELECT' },
  control: { cx: 260, cy: 330, name: 'CONTROL' },
};

/**
 * A panel clock with an outside air temperature and voltmeter display, in the style of the
 * two-window digital clocks fitted to many light aircraft.
 *
 * - O.A.T / VOLTS cycles the upper display: volts → °F → °C. Hold it for a display test.
 * - SELECT cycles the lower display: UT → LT → FT → ET.
 * - CONTROL in ET starts, stops and resets the timer. Hold it in FT or ET to reset that timer.
 * - SELECT and CONTROL together (or holding SELECT) enters set mode in UT, LT, FT (alarm) and ET (count-down):
 *   CONTROL steps the flashing digit, SELECT moves to the next one and confirms after the last.
 */
export function DigitalClock({
  oat,
  volts,
  upperDisplay,
  defaultUpperDisplay = 'volts',
  onUpperDisplayChange,
  mode,
  defaultMode = 'UT',
  onModeChange,
  now,
  localOffset,
  defaultLocalOffset,
  onLocalOffsetChange,
  onTimeSet,
  flightTimeRunning = true,
  defaultFlightTime = 0,
  defaultFlightTimeAlarm = 0,
  defaultCountdown = 0,
  lowVoltage,
  highVoltage,
  onAlarm,
  ...props
}: DigitalClockProps) {
  const lcdId = useSvgId('fi-lcd');
  const clockNow = now === undefined ? Date.now() : finite(now instanceof Date ? now.getTime() : now, Date.now());
  const clockRef = useRef(clockNow);
  clockRef.current = clockNow;
  /** Reference time at the moment of a button press (renders can lag behind the system clock). */
  const readClock = () => (now === undefined ? Date.now() : clockRef.current);

  // Re-render a few times a second: the clock runs and set-mode digits and alarms flash.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const blinkOn = Math.floor(Date.now() / 400) % 2 === 0;

  // Upper display.
  const [innerUpper, setInnerUpper] = useState<UpperDisplay>(defaultUpperDisplay);
  const upper = upperDisplay ?? innerUpper;
  const changeUpper = (next: UpperDisplay) => {
    if (upperDisplay === undefined) setInnerUpper(next);
    onUpperDisplayChange?.(next);
  };

  // Lower display.
  const [innerMode, setInnerMode] = useState<ClockMode>(defaultMode);
  const current = mode ?? innerMode;
  const changeMode = (next: ClockMode) => {
    if (mode === undefined) setInnerMode(next);
    onModeChange?.(next);
  };

  // Clock: universal time is the reference time plus whatever correction was set with the buttons.
  const [correction, setCorrection] = useState(0);
  const [innerOffset, setInnerOffset] = useState(() => finite(defaultLocalOffset, -new Date().getTimezoneOffset()));
  const offset = finite(localOffset, innerOffset);
  const ut = clockNow + correction;
  const utDate = new Date(ut);
  const ltDate = new Date(ut + offset * MIN);

  // Flight time runs on its own whenever `flightTimeRunning` is true.
  const [ft, setFt] = useState<Stopwatch>(() => ({
    acc: Math.max(0, finite(defaultFlightTime)) * 1000,
    since: flightTimeRunning ? clockNow : null,
  }));
  useEffect(() => {
    setFt((w) => (flightTimeRunning ? startWatch(w, clockRef.current) : stopWatch(w, clockRef.current)));
  }, [flightTimeRunning]);
  const [ftAlarm, setFtAlarm] = useState(() => Math.max(0, finite(defaultFlightTimeAlarm)) * 1000);
  const ftMs = readWatch(ft, clockNow);

  // Elapsed timer, optionally counting down from `countdown` first.
  const [et, setEt] = useState<Stopwatch>({ acc: 0, since: null });
  const [countdown, setCountdown] = useState(() => Math.max(0, finite(defaultCountdown)) * 1000);
  const etMs = readWatch(et, clockNow);
  const countingDown = countdown > 0 && etMs < countdown;
  const etRunning = et.since !== null;

  // Alarms.
  const v = finite(volts, NaN);
  const system28 = Number.isNaN(v) || v > 18;
  const low = finite(lowVoltage, system28 ? 24.5 : 12.4);
  const high = finite(highVoltage, system28 ? 32 : 16);
  const voltsBad = !Number.isNaN(v) && (v < low || v > high);
  const [voltsAck, setVoltsAck] = useState(false);
  const [lowerAlarm, setLowerAlarm] = useState<ClockAlarm | null>(null);
  const fired = useRef({ voltage: false, flightTime: false, countdown: false });

  useEffect(() => {
    const f = fired.current;
    if (voltsBad && !f.voltage) {
      f.voltage = true;
      onAlarm?.('voltage');
    } else if (!voltsBad && f.voltage) {
      // Back in range: re-arm so the next excursion alarms again.
      f.voltage = false;
      setVoltsAck(false);
    }
    if (countdown > 0 && etMs >= countdown && !f.countdown) {
      f.countdown = true;
      setLowerAlarm('countdown');
      changeMode('ET');
      onAlarm?.('countdown');
    }
    if (ftAlarm > 0 && ftMs >= ftAlarm && !f.flightTime) {
      f.flightTime = true;
      setLowerAlarm('flightTime');
      changeMode('FT');
      onAlarm?.('flightTime');
    }
  });
  const voltsFlashing = voltsBad && !voltsAck;
  const alarmActive = voltsFlashing || lowerAlarm !== null;

  // Set mode.
  const [editing, setEditing] = useState<Editing | null>(null);
  const [lampTest, setLampTest] = useState(false);

  const startEditing = () => {
    const d = (a: number, b: number) => [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
    let digits: number[];
    if (current === 'UT') digits = d(utDate.getUTCHours(), utDate.getUTCMinutes());
    else if (current === 'LT') digits = d(ltDate.getUTCHours(), ltDate.getUTCMinutes());
    else if (current === 'ET') digits = d(Math.floor(countdown / MIN) % 60, Math.floor(countdown / 1000) % 60);
    else digits = d(Math.min(99, Math.floor(ftAlarm / HOUR)), Math.floor(ftAlarm / MIN) % 60);
    setEditing({ target: current, digits, index: 0 });
  };

  const commit = (e: Editing) => {
    const { target, digits } = e;
    setEditing(null);
    if (target === 'UT') {
      const wanted = twoDigits(digits, 0) * HOUR + twoDigits(digits, 2) * MIN;
      // Shortest change, so setting the time never jumps a day.
      const delta = mod(wanted - mod(ut, DAY) + DAY / 2, DAY) - DAY / 2;
      setCorrection(correction + delta);
      onTimeSet?.(new Date(ut + delta));
    } else if (target === 'LT') {
      let next = offset + (twoDigits(digits, 0) - ltDate.getUTCHours()) * 60;
      while (next > 14 * 60) next -= 24 * 60;
      while (next < -12 * 60) next += 24 * 60;
      if (localOffset === undefined) setInnerOffset(next);
      onLocalOffsetChange?.(next);
    } else if (target === 'ET') {
      setCountdown((twoDigits(digits, 0) * 60 + twoDigits(digits, 2)) * 1000);
      setEt({ acc: 0, since: null });
      fired.current.countdown = false;
    } else {
      setFtAlarm(twoDigits(digits, 0) * HOUR + twoDigits(digits, 2) * MIN);
      fired.current.flightTime = false;
    }
  };

  const resetEt = () => {
    setEt({ acc: 0, since: null });
    fired.current.countdown = false;
  };
  const resetFt = () => {
    setFt({ acc: 0, since: flightTimeRunning ? readClock() : null });
    fired.current.flightTime = false;
  };

  /** A short press. */
  const click = (b: Button) => {
    if (b === 'oatVolts') return changeUpper(UPPER[(UPPER.indexOf(upper) + 1) % UPPER.length]!);
    if (editing) {
      if (b === 'control') {
        const digits = [...editing.digits];
        const i = editing.index;
        const d = digits[i] ?? 0;
        digits[i] = d >= digitMax(editing.target, digits, i) ? 0 : d + 1;
        // Lowering the tens of hours can make the units invalid (e.g. 29 → 23).
        if (i === 0 && editing.target !== 'ET' && editing.target !== 'FT') digits[1] = Math.min(digits[1] ?? 0, digitMax(editing.target, digits, 1));
        return setEditing({ ...editing, digits });
      }
      if (editing.index >= lastDigit(editing.target)) return commit(editing);
      return setEditing({ ...editing, index: editing.index + 1 });
    }
    if (b === 'select') return changeMode(MODES[(MODES.indexOf(current) + 1) % MODES.length]!);
    if (current === 'ET') {
      // CONTROL steps the timer: start → stop → reset.
      if (etRunning) setEt(stopWatch(et, readClock()));
      else if (et.acc > 0) resetEt();
      else setEt(startWatch(et, readClock()));
    }
  };

  /** A press held for `HOLD_TIME`. Returns whether it did something (then the release is not a click). */
  const hold = (b: Button): boolean => {
    if (b === 'oatVolts') {
      setLampTest(true);
      return true;
    }
    if (b === 'select') {
      if (editing) commit(editing);
      else startEditing();
      return true;
    }
    if (editing) return false;
    if (current === 'FT') resetFt();
    else if (current === 'ET') resetEt();
    else return false;
    return true;
  };

  /** SELECT and CONTROL pressed together: enter set mode, or confirm it. */
  const both = () => (editing ? commit(editing) : startEditing());

  const acknowledge = () => {
    if (voltsBad) setVoltsAck(true);
    setLowerAlarm(null);
  };

  // Latest handlers for the timers and pointer events below.
  const actions = useRef({ click, hold, both, acknowledge, alarmActive });
  actions.current = { click, hold, both, acknowledge, alarmActive };

  const presses = useRef<Record<Button, { down: boolean; used: boolean; timer?: ReturnType<typeof setTimeout> }>>({
    oatVolts: { down: false, used: false },
    select: { down: false, used: false },
    control: { down: false, used: false },
  });
  const [pressed, setPressed] = useState<Button | null>(null);
  useEffect(() => () => Object.values(presses.current).forEach((p) => clearTimeout(p.timer)), []);

  const press = (b: Button) => {
    const p = presses.current[b];
    if (p.down) return;
    p.down = true;
    p.used = false;
    setPressed(b);
    const a = actions.current;
    if (a.alarmActive) {
      // The first press after an alarm only silences it.
      a.acknowledge();
      p.used = true;
      return;
    }
    const other = b === 'select' ? presses.current.control : b === 'control' ? presses.current.select : null;
    if (other?.down) {
      clearTimeout(other.timer);
      other.used = true;
      p.used = true;
      a.both();
      return;
    }
    p.timer = setTimeout(() => {
      if (p.down && !p.used) p.used = actions.current.hold(b);
    }, HOLD_TIME);
  };

  const release = (b: Button, cancel = false) => {
    const p = presses.current[b];
    if (!p.down) return;
    p.down = false;
    clearTimeout(p.timer);
    setPressed((x) => (x === b ? null : x));
    if (b === 'oatVolts') setLampTest(false);
    if (!p.used && !cancel) actions.current.click(b);
  };

  // ---------- What the displays show ----------

  const oatC = finite(oat, NaN);
  const shownUpper = voltsFlashing ? 'volts' : upper;
  const [upperDigits, unit] = lampTest ? ['88.8', 'V'] : upperText(shownUpper, oatC, v);
  const upperCells: Array<{ char: string; dot: boolean }> = [];
  for (const ch of upperDigits) {
    const prev = upperCells[upperCells.length - 1];
    if (ch === '.' && prev) prev.dot = true;
    else upperCells.push({ char: ch, dot: false });
  }
  while (upperCells.length < 3) upperCells.unshift({ char: ' ', dot: false });
  const upperVisible = !voltsFlashing || blinkOn;

  let lowerDigits: string;
  if (lampTest) lowerDigits = '8888';
  else if (editing) {
    const d = editing.digits.join('');
    // Setting LT changes only the hours; the minutes stay those of the running clock.
    lowerDigits = editing.target === 'LT' ? d.slice(0, 2) + pad2(ltDate.getUTCMinutes()) : d;
  } else if (current === 'UT') lowerDigits = pad2(utDate.getUTCHours()) + pad2(utDate.getUTCMinutes());
  else if (current === 'LT') lowerDigits = pad2(ltDate.getUTCHours()) + pad2(ltDate.getUTCMinutes());
  else if (current === 'FT') lowerDigits = timerDigits(ftMs);
  else lowerDigits = timerDigits(countingDown ? Math.ceil((countdown - etMs) / 1000) * 1000 : countdown > 0 ? etMs - countdown : etMs);
  const lowerVisible = lowerAlarm === null || blinkOn;
  const shownMode = editing ? editing.target : current;

  const upperLabel = upperText(shownUpper, oatC, v);
  const lowerLabel = `${lowerDigits.slice(0, 2)}:${lowerDigits.slice(2)}`;
  const state =
    shownMode === 'ET' ? (etRunning ? (countingDown ? ' counting down' : ' running') : et.acc > 0 ? ' stopped' : '') : shownMode === 'FT' && !flightTimeRunning ? ' stopped' : '';
  const label =
    `Clock: ${shownUpper === 'volts' ? `${upperLabel[0].trim()} volts` : `OAT ${upperLabel[0].trim()} ${upperLabel[1]}`}` +
    `${voltsBad ? (v < low ? ' LOW' : ' HIGH') : ''}, ${shownMode} ${lowerLabel}${state}${editing ? ' (setting)' : ''}`;

  // ---------- Drawing ----------

  const labelPos: Record<ClockMode, [number, number]> = { UT: [86, 202], LT: [128, 202], FT: [86, 246], ET: [128, 246] };
  const DW = 32;
  const DH = 58;
  const lowerX = [166, 206, 262, 302];

  return (
    <InstrumentFrame {...props} role="group" label={label}>
      <defs>
        <linearGradient id={lcdId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f8977" />
          <stop offset="0.18" stopColor={LCD} />
          <stop offset="1" stopColor="#a9b29f" />
        </linearGradient>
      </defs>

      {/* Face lettering. */}
      <g fill={FACE_TEXT} fontSize="16" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        <text x="148" y="80">O.A.T</text>
        <text x="256" y="80">VOLTS</text>
        <text x="140" y="294">SELECT</text>
        <text x="260" y="294">CONTROL</text>
      </g>

      {/* Upper display: OAT / volts. */}
      <rect x="104" y="94" width="192" height="66" rx="4" fill="#0b0b0b" />
      <rect x="108" y="98" width="184" height="58" rx="2" fill={`url(#${lcdId})`} />
      <g data-testid="clock-upper" data-unit={unit} opacity={upperVisible ? 1 : 0}>
        {upperCells.map((c, i) => (
          <Cell key={i} x={132 + i * 36} y={104} w={26} h={46} char={c.char} dot={c.dot} on={INK} off={GHOST} testId={`clock-upper-${i}`} />
        ))}
        <text x="244" y="129" fill={INK} fontSize="34" fontWeight="bold" dominantBaseline="central">
          {unit}
        </text>
      </g>

      {/* Lower display: mode annunciators and clock digits. */}
      <rect x="56" y="170" width="288" height="104" rx="4" fill="#0b0b0b" />
      <rect x="60" y="174" width="280" height="96" rx="2" fill={`url(#${lcdId})`} />
      <g fill={INK} fontSize="17" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
        {MODES.map((m) => (
          <text key={m} x={labelPos[m][0]} y={labelPos[m][1]}>
            {m}
          </text>
        ))}
      </g>
      {MODES.map((m) => {
        const [x, y] = labelPos[m];
        const top = y < 224;
        // Triangle between the rows, pointing at the active mode's label.
        const points = top ? `${x - 8},224 ${x + 8},224 ${x},215` : `${x - 8},220 ${x + 8},220 ${x},229`;
        const active = lampTest || m === shownMode;
        return <polygon key={m} data-testid={`clock-mode-${m}`} data-active={active} points={points} fill={active ? INK : GHOST} />;
      })}
      <g data-testid="clock-lower" opacity={lowerVisible ? 1 : 0}>
        {lowerX.map((x, i) => {
          const blank = editing !== null && i === editing.index && !blinkOn;
          const ch = blank ? ' ' : (lowerDigits[i] ?? ' ');
          return <Cell key={i} x={x} y={193} w={DW} h={DH} char={ch} on={INK} off={GHOST} testId={`clock-lower-${i}`} />;
        })}
        <circle cx="253" cy="210" r="4" fill={INK} />
        <circle cx="249" cy="236" r="4" fill={INK} />
      </g>

      {/* Buttons. */}
      {(Object.keys(BUTTONS) as Button[]).map((b) => {
        const { cx, cy, name } = BUTTONS[b];
        const down = pressed === b;
        return (
          <g
            key={b}
            role="button"
            tabIndex={0}
            aria-label={name}
            data-testid={`clock-button-${b}`}
            style={{ cursor: 'pointer', outline: 'none', touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault();
              press(b);
            }}
            onPointerUp={() => release(b)}
            onPointerLeave={() => release(b, true)}
            onPointerCancel={() => release(b, true)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (!e.repeat) press(b);
            }}
            onKeyUp={(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') release(b);
            }}
            onBlur={() => release(b, true)}
          >
            <circle cx={cx} cy={cy} r="24" fill="transparent" />
            <circle cx={cx} cy={cy + 2} r="17" fill="#000" opacity="0.6" />
            <circle cx={cx} cy={cy + (down ? 1.5 : 0)} r="15" fill={down ? '#bdbdbd' : '#ececec'} stroke="#8a8a8a" strokeWidth="1.5" />
          </g>
        );
      })}
    </InstrumentFrame>
  );
}
