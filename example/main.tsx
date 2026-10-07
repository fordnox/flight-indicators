import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Airspeed,
  Altimeter,
  AttitudeIndicator,
  HeadingIndicator,
  TurnCoordinator,
  VerticalSpeed,
  VorIndicator,
  WindIndicator,
} from '../src';

type State = Record<'roll' | 'pitch' | 'heading' | 'speed' | 'altitude' | 'vs' | 'turn' | 'slip' | 'runway' | 'windDir' | 'windSpeed' | 'gust' | 'course' | 'radial', number>;

const RANGES: Record<keyof State, [number, number, number]> = {
  roll: [-180, 180, 1],
  pitch: [-40, 40, 1],
  heading: [0, 359, 1],
  speed: [0, 200, 1],
  altitude: [-1000, 30000, 10],
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

const norm = (deg: number) => ((deg % 360) + 360) % 360;

function App() {
  const [s, setS] = useState<State>({ roll: 0, pitch: 0, heading: 0, speed: 0, altitude: 0, vs: 0, turn: 0, slip: 0, runway: 90, windDir: 134, windSpeed: 8, gust: 0, course: 90, radial: 272 });
  const [simulate, setSimulate] = useState(true);

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
        windDir: (((150 + 70 * Math.sin(t / 8)) % 360) + 360) % 360,
        windSpeed: 12 + 6 * Math.sin(t / 5),
        gust: 22 + 4 * Math.sin(t / 3),
        radial: norm(270 + 8 * Math.sin(t / 6)),
      }));
    }, 250);
    return () => clearInterval(id);
  }, [simulate]);

  const size = 240;
  return (
    <main>
      <h1>flight-indicators</h1>
      <label className="simulate">
        <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} /> Simulate flight
      </label>
      <div className="controls">
        {(Object.keys(RANGES) as Array<keyof State>).map((k) => {
          const [min, max, step] = RANGES[k];
          return (
            <label key={k} className="control">
              <span className="control-head">
                {k}
                <output>{s[k].toFixed(step < 1 ? 2 : 0)}</output>
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
      <div className="grid">
        <Airspeed size={size} speed={s.speed} />
        <AttitudeIndicator size={size} roll={s.roll} pitch={s.pitch} />
        <Altimeter size={size} altitude={s.altitude} />
        <TurnCoordinator size={size} turnRate={s.turn} slip={s.slip} />
        <HeadingIndicator size={size} heading={s.heading} />
        <VerticalSpeed size={size} verticalSpeed={s.vs} />
        <WindIndicator size={size} runway={s.runway} windDirection={s.windDir} windSpeed={s.windSpeed} windGust={s.gust} />
        <VorIndicator size={size} course={s.course} radial={s.radial} />
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
