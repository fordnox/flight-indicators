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
          { name: 'GS', value: Math.max(0, s.speed - s.windSpeed * Math.cos(((s.windDir - s.heading) * Math.PI) / 180)), unit: 'KT' },
        ]}
      />
    ),
  },
];

/** Per-cylinder offsets so the bar graph is not flat. */
const CYL_SPREAD = [-25, -15, 0, -20, -5, -35];

const norm = (deg: number) => ((deg % 360) + 360) % 360;

function App() {
  const [s, setS] = useState<State>({ roll: 0, pitch: 0, heading: 0, speed: 0, altitude: 0, vs: 0, turn: 0, slip: 0, runway: 90, windDir: 134, windSpeed: 8, gust: 0, course: 90, radial: 272, qnh: 1013, oat: 15, fuelL: 88.7, fuelR: 100, man: 27.4, rpm: 2400, cht: 385, egt: 1385, oilP: 50, oilT: 202, fuelP: 15.9, fuelF: 15.5, flaps: 20, aoa: 6 });
  const [simulate, setSimulate] = useState(true);
  const [tempUnit, setTempUnit] = useState<TempUnit>('F');
  const [showControls, setShowControls] = useState(true);

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
      <h1>flight-indicators</h1>
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
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
