import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Airspeed,
  Altimeter,
  AoaIndicator,
  AttitudeIndicator,
  DataPanel,
  EngineIndicator,
  FlapIndicator,
  FuelIndicator,
  HeadingIndicator,
  TurnCoordinator,
  VerticalSpeed,
  VorIndicator,
  WindIndicator,
} from '../src';

type Key = 'roll' | 'pitch' | 'heading' | 'speed' | 'altitude' | 'vs' | 'turn' | 'slip' | 'runway' | 'windDir' | 'windSpeed' | 'gust' | 'course' | 'radial' | 'qnh' | 'oat' | 'fuelL' | 'fuelR' | 'man' | 'rpm' | 'cht' | 'egt' | 'oilP' | 'oilT' | 'fuelP' | 'fuelF' | 'flaps' | 'aoa';
type State = Record<Key, number>;

const RANGES: Record<Key, [number, number, number]> = {
  roll: [-180, 180, 1],
  pitch: [-40, 40, 1],
  heading: [0, 359, 1],
  speed: [0, 200, 1],
  altitude: [-1000, 30000, 10],
  qnh: [950, 1050, 1],
  oat: [-40, 50, 1],
  fuelL: [0, 100, 0.5],
  fuelR: [0, 100, 0.5],
  man: [10, 35, 0.1],
  rpm: [0, 3000, 10],
  cht: [200, 500, 1],
  egt: [1000, 1700, 5],
  oilP: [0, 100, 1],
  oilT: [0, 250, 1],
  fuelP: [0, 30, 0.1],
  fuelF: [0, 30, 0.1],
  flaps: [0, 40, 1],
  aoa: [-2, 22, 0.1],
  vs: [-2000, 2000, 50],
  turn: [-6, 6, 0.1],
  slip: [-1, 1, 0.05],
  runway: [0, 350, 10],
  windDir: [0, 359, 1],
  windSpeed: [0, 40, 1],
  gust: [0, 50, 1],
  course: [0, 359, 1],
  radial: [0, 359, 1],
};

const SIZE = 240;

/** Temperature display mode for the whole page. */
type TempUnit = 'F' | 'C';

/** Native unit of each temperature key: engine temps are simulated in °F, OAT in °C. */
const TEMP_KEYS: Partial<Record<Key, TempUnit>> = { cht: 'F', egt: 'F', oilT: 'F', oat: 'C' };

/** Converts an absolute temperature from one unit to another. */
const toUnit = (value: number, from: TempUnit, to: TempUnit) => (from === to ? value : to === 'C' ? ((value - 32) * 5) / 9 : (value * 9) / 5 + 32);
const F = (value: number, u: TempUnit) => toUnit(value, 'F', u);
const C = (value: number, u: TempUnit) => toUnit(value, 'C', u);

/** Converts a temperature difference (no 32° offset). */
const spanTo = (deltaC: number, u: TempUnit) => (u === 'C' ? deltaC : (deltaC * 9) / 5);
const signed = (n: number, decimals = 0) => `${n > 0 ? '+' : ''}${n.toFixed(decimals)}`;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Values derived from the simulated state for the air data and navigation panels.
 * Standard rules of thumb: ~30 ft per hPa, ISA lapse 1.98 °C / 1000 ft, 118.8 ft of density altitude per °C.
 */
function derived(s: State) {
  const pressureAlt = s.altitude + (1013.25 - s.qnh) * 30;
  const isaTemp = 15 - (1.98 * pressureAlt) / 1000;
  const isaDev = s.oat - isaTemp;
  const densityAlt = pressureAlt + 118.8 * isaDev;
  const sigma = Math.max(0.05, Math.pow(1 - 6.8756e-6 * densityAlt, 4.2559));
  const tas = s.speed / Math.sqrt(sigma);

  // Wind triangle: air vector along the heading plus the wind blowing from windDir.
  const vx = tas * Math.sin(rad(s.heading)) - s.windSpeed * Math.sin(rad(s.windDir));
  const vy = tas * Math.cos(rad(s.heading)) - s.windSpeed * Math.cos(rad(s.windDir));
  const gs = Math.hypot(vx, vy);
  const track = norm((Math.atan2(vx, vy) * 180) / Math.PI);
  const drift = ((track - s.heading + 540) % 360) - 180;
  const headwind = s.windSpeed * Math.cos(rad(s.windDir - s.heading));
  const crosswind = s.windSpeed * Math.sin(rad(s.windDir - s.heading));

  // Fuel: the demo tanks are percent of 50 gal each, burned at the engine's fuel flow.
  const fuel = (s.fuelL + s.fuelR) / 2;
  const endurance = s.fuelF > 0 ? fuel / s.fuelF : Infinity;
  const range = endurance * gs;

  return { pressureAlt, isaDev, densityAlt, tas, gs, track, drift, headwind, crosswind, fuel, endurance, range };
}

/** Hours as H:MM. */
const hhmm = (hours: number) => {
  if (!Number.isFinite(hours)) return '--:--';
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

const AMBER = '#ffb000';
const RED = '#ff2a2a';

/** One card per instrument: its title, the state keys it is driven by, and how to draw it. */
const PANELS: Array<{ title: string; keys: Key[]; render: (s: State, u: TempUnit) => ReactNode }> = [
  { title: 'Airspeed', keys: ['speed'], render: (s) => <Airspeed size={SIZE} speed={s.speed} /> },
  { title: 'Attitude', keys: ['roll', 'pitch'], render: (s) => <AttitudeIndicator size={SIZE} roll={s.roll} pitch={s.pitch} /> },
  { title: 'Altimeter', keys: ['altitude', 'qnh'], render: (s) => <Altimeter size={SIZE} altitude={s.altitude} pressure={s.qnh} /> },
  { title: 'Turn coordinator', keys: ['turn', 'slip'], render: (s) => <TurnCoordinator size={SIZE} turnRate={s.turn} slip={s.slip} /> },
  { title: 'Heading', keys: ['heading'], render: (s) => <HeadingIndicator size={SIZE} heading={s.heading} /> },
  { title: 'Vertical speed', keys: ['vs'], render: (s) => <VerticalSpeed size={SIZE} verticalSpeed={s.vs} /> },
  {
    title: 'Engine',
    keys: ['man', 'rpm', 'cht', 'egt', 'oilP', 'oilT', 'fuelP', 'fuelF'],
    render: (s, u) => (
      <EngineIndicator
        size={SIZE}
        power={Math.round(((s.man - 10) / 25) * (s.rpm / 2700) * 100)}
        manifold={{ value: s.man }}
        rpm={{ value: s.rpm }}
        cht={CYL_SPREAD.map((d) => F(s.cht + d, u))}
        egt={CYL_SPREAD.map((d) => F(s.egt + d * 4, u))}
        tit={F(s.egt + 55, u)}
        temperatureUnit={`°${u}`}
        chtLimit={F(400, u)}
        chtScale={F(500, u)}
        egtScale={F(1700, u)}
        gauges={[
          { label: 'Oil P', value: s.oilP, min: 0, max: 100, green: [30, 60], low: 10, high: 95, unit: 'PSI' },
          { label: 'Oil T', value: F(s.oilT, u), min: F(0, u), max: F(250, u), green: [F(75, u), F(240, u)], high: F(240, u), unit: `°${u}` },
          { label: 'Fuel P', value: s.fuelP, min: 0, max: 30, low: 1, high: 28, unit: 'PSI', decimals: 1 },
          { label: 'Fuel F', value: s.fuelF, min: 0, max: 30, green: [8, 20], unit: 'GPH', decimals: 1 },
        ]}
        amps={10}
        volts={28.1}
        fuelLeft={s.fuelL / 2}
        fuelRight={s.fuelR / 2}
        fuelCapacity={50}
      />
    ),
  },
  { title: 'VOR', keys: ['course', 'radial'], render: (s) => <VorIndicator size={SIZE} course={s.course} radial={s.radial} /> },
  {
    title: 'Fuel',
    keys: ['fuelL', 'fuelR'],
    render: (s) => <FuelIndicator size={SIZE} capacity={100} tanks={[{ name: 'Left', quantity: s.fuelL }, { name: 'Right', quantity: s.fuelR }]} />,
  },
  {
    title: 'Flaps',
    keys: ['flaps', 'speed'],
    render: (s) => (
      <FlapIndicator
        size={SIZE}
        flaps={s.flaps}
        airspeed={s.speed}
        speedLimits={[
          { flaps: 0, speed: 160 },
          { flaps: 10, speed: 110 },
          { flaps: 20, speed: 96 },
          { flaps: 30, speed: 85 },
        ]}
      />
    ),
  },
  { title: 'Angle of attack', keys: ['aoa'], render: (s) => <AoaIndicator size={SIZE} aoa={s.aoa} optimum={10} max={18} showValue /> },
  {
    title: 'Wind / runway',
    keys: ['runway', 'windDir', 'windSpeed', 'gust'],
    render: (s) => <WindIndicator size={SIZE} runway={s.runway} windDirection={s.windDir} windSpeed={s.windSpeed} windGust={s.gust} />,
  },
  {
    title: 'Data panel',
    keys: ['oat', 'qnh'],
    render: (s, u) => (
      <DataPanel
        size={SIZE}
        heading="Radios"
        fields={[
          { name: 'COM', value: '118.700', unit: 'MHz' },
          { name: 'VLOC', value: 110.5, unit: 'MHz', decimals: 2 },
          { name: 'QNH', value: s.qnh, unit: 'hPa' },
          { name: 'SQUAWK', value: '7000' },
          { name: 'OAT', value: C(s.oat, u), unit: `°${u}`, color: s.oat <= 0 ? '#3cc8ff' : undefined },
          { name: 'GS', value: derived(s).gs, unit: 'KT' },
        ]}
      />
    ),
  },
  {
    title: 'Air data',
    keys: ['speed', 'altitude', 'qnh', 'oat', 'windDir', 'windSpeed'],
    render: (s, u) => {
      const d = derived(s);
      return (
        <DataPanel
          size={SIZE}
          heading="Air data"
          fields={[
            { name: 'TAS', value: d.tas, unit: 'KT' },
            { name: 'PRESS ALT', value: d.pressureAlt, unit: 'FT' },
            { name: 'DENS ALT', value: d.densityAlt, unit: 'FT', color: d.densityAlt - d.pressureAlt > 1500 ? AMBER : undefined },
            { name: 'ISA DEV', value: signed(spanTo(d.isaDev, u)), unit: `°${u}` },
            { name: d.headwind >= 0 ? 'HEADWIND' : 'TAILWIND', value: Math.abs(d.headwind), unit: 'KT' },
            { name: 'XWIND', value: `${Math.abs(d.crosswind).toFixed(0)}${d.crosswind >= 0 ? 'R' : 'L'}`, unit: 'KT' },
          ]}
        />
      );
    },
  },
  {
    title: 'Navigation',
    keys: ['heading', 'windDir', 'windSpeed', 'fuelL', 'fuelR', 'fuelF'],
    render: (s) => {
      const d = derived(s);
      return (
        <DataPanel
          size={SIZE}
          heading="Nav / fuel"
          fields={[
            { name: 'GS', value: d.gs, unit: 'KT' },
            { name: 'TRACK', value: String(Math.round(d.track) % 360).padStart(3, '0'), unit: '°' },
            { name: 'DRIFT', value: `${Math.abs(d.drift).toFixed(0)}${d.drift >= 0 ? 'R' : 'L'}`, unit: '°' },
            { name: 'FUEL', value: d.fuel, unit: 'GAL', decimals: 1, color: d.fuel < 10 ? RED : undefined },
            { name: 'ENDURANCE', value: hhmm(d.endurance), unit: 'H:MM', color: d.endurance < 0.75 ? RED : d.endurance < 1.5 ? AMBER : undefined },
            { name: 'RANGE', value: Number.isFinite(d.range) ? d.range : '---', unit: 'NM' },
          ]}
        />
      );
    },
  },
];

/** Per-cylinder offsets so the bar graph is not flat. */
const CYL_SPREAD = [-25, -15, 0, -20, -5, -35];

const REPO_URL = 'https://github.com/fordnox/flight-indicators';
const NPM_URL = 'https://www.npmjs.com/package/flight-indicators';
const AUTHOR_URL = 'https://github.com/fordnox';

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <rect width="16" height="16" rx="2" fill="#cb3837" />
      <path d="M3 3h10v10h-2.5V5.5H8V13H3z" fill="#fff" />
    </svg>
  );
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

function App() {
  const [s, setS] = useState<State>({ roll: 0, pitch: 0, heading: 0, speed: 0, altitude: 0, vs: 0, turn: 0, slip: 0, runway: 90, windDir: 134, windSpeed: 8, gust: 0, course: 90, radial: 272, qnh: 1013, oat: 15, fuelL: 88.7, fuelR: 100, man: 27.4, rpm: 2400, cht: 385, egt: 1385, oilP: 50, oilT: 202, fuelP: 15.9, fuelF: 15.5, flaps: 20, aoa: 6 });
  const [simulate, setSimulate] = useState(true);
  const [tempUnit, setTempUnit] = useState<TempUnit>('F');
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (!simulate) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      setS((prev) => ({
        ...prev,
        roll: 30 * Math.sin(t / 2),
        pitch: 10 * Math.sin(t / 3),
        heading: (t * 15) % 360,
        speed: 100 + 60 * Math.sin(t / 4),
        altitude: 5000 + 4500 * Math.sin(t / 10),
        vs: 1800 * Math.cos(t / 3),
        turn: 4 * Math.sin(t / 2),
        slip: 0.6 * Math.sin(t / 1.5),
        windDir: norm(150 + 70 * Math.sin(t / 8)),
        windSpeed: 12 + 6 * Math.sin(t / 5),
        gust: 22 + 4 * Math.sin(t / 3),
        radial: norm(270 + 8 * Math.sin(t / 6)),
        oat: 15 - 2 * (prev.altitude / 1000),
        rpm: 2300 + 150 * Math.sin(t / 4),
        man: 24 + 3 * Math.sin(t / 4),
        cht: 370 + 15 * Math.sin(t / 9),
        egt: 1350 + 40 * Math.sin(t / 7),
        aoa: 9 + 10 * Math.sin(t / 5),
      }));
    }, 250);
    return () => clearInterval(id);
  }, [simulate]);

  return (
    <main>
      <header className="page-header">
        <h1>flight-indicators</h1>
        <nav className="links" aria-label="Project links">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <GithubIcon /> GitHub
          </a>
          <a href={NPM_URL} target="_blank" rel="noreferrer">
            <NpmIcon /> npm
          </a>
        </nav>
      </header>
      <p className="tagline">
        Modern, dependency-free SVG flight instruments for React. <code>npm install flight-indicators</code>
      </p>
      <div className="toolbar">
        <label className="toggle">
          <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} /> Simulate flight
        </label>
        <label className="toggle">
          <input type="checkbox" checked={showControls} onChange={(e) => setShowControls(e.target.checked)} /> Show controls
        </label>
        <fieldset className="toggle radio-group">
          <legend>Temperature</legend>
          {(['F', 'C'] as const).map((unit) => (
            <label key={unit} className="toggle">
              <input type="radio" name="temp-unit" value={unit} checked={tempUnit === unit} onChange={() => setTempUnit(unit)} /> °{unit}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="grid">
        {PANELS.map(({ title, keys, render }) => (
          <section key={title} className="panel">
            <h2>{title}</h2>
            {render(s, tempUnit)}
            <div className="controls" hidden={!showControls}>
              {keys.map((k) => {
                const [min, max, step] = RANGES[k];
                const native = TEMP_KEYS[k];
                return (
                  <label key={k} className="control">
                    <span className="control-head">
                      {k}
                      <output>{native ? `${toUnit(s[k], native, tempUnit).toFixed(0)}°${tempUnit}` : s[k].toFixed(step < 1 ? 2 : 0)}</output>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={s[k]}
                      onChange={(e) => {
                        setSimulate(false);
                        setS({ ...s, [k]: Number(e.target.value) });
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <footer className="page-footer">
        Made by{' '}
        <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
          Andrius Putna
        </a>{' '}
        (@fordnox) · MIT License ·{' '}
        <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
          Report an issue
        </a>{' '}
        · Hosted on{' '}
        <a href="https://harvis.dev" target="_blank" rel="noreferrer">
          harvis.dev
        </a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
