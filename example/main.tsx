import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Airspeed,
  Altimeter,
  AttitudeIndicator,
  HeadingIndicator,
  TurnCoordinator,
  VerticalSpeed,
} from '../src';

type State = Record<'roll' | 'pitch' | 'heading' | 'speed' | 'altitude' | 'vs' | 'turn' | 'slip', number>;

const RANGES: Record<keyof State, [number, number, number]> = {
  roll: [-180, 180, 1],
  pitch: [-40, 40, 1],
  heading: [0, 359, 1],
  speed: [0, 200, 1],
  altitude: [-1000, 30000, 10],
  vs: [-2000, 2000, 50],
  turn: [-6, 6, 0.1],
  slip: [-1, 1, 0.05],
};

function App() {
  const [s, setS] = useState<State>({ roll: 0, pitch: 0, heading: 0, speed: 0, altitude: 0, vs: 0, turn: 0, slip: 0 });
  const [simulate, setSimulate] = useState(true);

  useEffect(() => {
    if (!simulate) return;
    const id = setInterval(() => {
      const t = performance.now() / 1000;
      setS({
        roll: 30 * Math.sin(t / 2),
        pitch: 10 * Math.sin(t / 3),
        heading: (t * 15) % 360,
        speed: 100 + 60 * Math.sin(t / 4),
        altitude: 5000 + 4500 * Math.sin(t / 10),
        vs: 1800 * Math.cos(t / 3),
        turn: 4 * Math.sin(t / 2),
        slip: 0.6 * Math.sin(t / 1.5),
      });
    }, 250);
    return () => clearInterval(id);
  }, [simulate]);

  const size = 240;
  return (
    <main>
      <h1>flight-indicators</h1>
      <label style={{ display: 'flex', gap: 8 }}>
        <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} /> Simulate flight
      </label>
      <div className="controls">
        {(Object.keys(RANGES) as Array<keyof State>).map((k) => {
          const [min, max, step] = RANGES[k];
          return (
            <label key={k}>
              {k}
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
              <output>{s[k].toFixed(step < 1 ? 2 : 0)}</output>
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
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
