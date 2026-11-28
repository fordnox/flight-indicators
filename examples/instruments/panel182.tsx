import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AdfIndicator,
  Airspeed,
  Altimeter,
  AnnunciatorPanel,
  AttitudeIndicator,
  DataPanel,
  DigitalClock,
  EgtFuelFlowGauge,
  FlapIndicator,
  FuelQuantityGauge,
  HobbsMeter,
  HsiIndicator,
  MagneticCompass,
  ManifoldFuelFlowGauge,
  OilGauge,
  RadioStack,
  Tachometer,
  TrimIndicator,
  TurnCoordinator,
  VacuumAmmeterGauge,
  VerticalSpeed,
  VorIndicator,
  relativeBearing,
} from '../../src';

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Faults the reader can switch on to see the annunciator and gauges react. */
type Fault = 'fuelL' | 'fuelR' | 'oil' | 'vacuum' | 'alternator';
const FAULTS: Array<[Fault, string]> = [
  ['fuelL', 'Left tank low'],
  ['fuelR', 'Right tank low'],
  ['oil', 'Low oil pressure'],
  ['vacuum', 'Vacuum failure'],
  ['alternator', 'Alternator failure'],
];

interface Sim {
  t: number;
  heading: number;
  fuelL: number;
  fuelR: number;
  hobbs: number;
  tach: number;
}

/** Station positions for the demo: a VOR the HSI tracks, a second VOR and an NDB. */
const VOR1 = { course: 90, radial: 272 };

/**
 * Everything the panel shows, derived from the simulation clock. The aircraft flies gentle S-turns
 * while climbing and descending through 4,500 ft, so every needle keeps moving.
 */
function readings(s: Sim, faults: Set<Fault>) {
  const { t } = s;
  const roll = 18 * Math.sin(t / 22);
  const altitude = 4500 + 1000 * Math.sin(t / 40);
  const vs = (1000 / 40) * 60 * Math.cos(t / 40);
  const pitch = 2.5 + vs / 400;
  const speed = 118 - pitch * 4 + 2 * Math.sin(t / 7);
  // Rate of turn in °/s for a coordinated turn: 1091 × tan(bank) / TAS in knots.
  const turnRate = (Math.tan(rad(roll)) * 1091) / Math.max(60, speed);
  const slip = 0.15 * Math.sin(t / 5);
  const rpm = 2350 + 50 * Math.sin(t / 40);
  const manifold = 22.5 + 1.2 * Math.sin(t / 40);
  const fuelFlow = 12.5 + 1.5 * Math.sin(t / 40);
  const oilP = faults.has('oil') ? 12 : 62 + 3 * Math.sin(t / 9);
  const oilT = 190 + 6 * Math.sin(t / 30);
  const vacuum = faults.has('vacuum') ? 2.2 : 5 + 0.15 * Math.sin(t / 11);
  const amps = faults.has('alternator') ? -9 : 4 + 2 * Math.sin(t / 6);
  const volts = faults.has('alternator') ? 24.1 : 28.2 + 0.1 * Math.sin(t / 6);
  const fuelL = faults.has('fuelL') ? 3 : s.fuelL;
  const fuelR = faults.has('fuelR') ? 3 : s.fuelR;
  const radial = norm(VOR1.radial + 6 * Math.sin(t / 30));
  const glideslope = 0.3 * Math.sin(t / 17);
  const ndb = norm(40 + 20 * Math.sin(t / 50));
  const oat = 15 - (1.98 * altitude) / 1000;
  return { roll, pitch, altitude, vs, speed, turnRate, slip, rpm, manifold, fuelFlow, oilP, oilT, vacuum, amps, volts, fuelL, fuelR, radial, glideslope, ndb, oat };
}

const TICK_MS = 100;

function useSim(running: boolean) {
  const [sim, setSim] = useState<Sim>({ t: 0, heading: 90, fuelL: 38, fuelR: 41, hobbs: 1234.5, tach: 987.6 });
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    const id = setInterval(() => {
      const now = performance.now();
      const dt = last.current === null ? TICK_MS / 1000 : (now - last.current) / 1000;
      last.current = now;
      setSim((s) => {
        const t = s.t + dt;
        const r = readings({ ...s, t }, new Set());
        // Heading follows the rate of turn. Fuel and hours run 60× fast.
        const fast = dt * 60;
        return {
          t,
          heading: norm(s.heading + r.turnRate * dt),
          fuelL: Math.max(0, s.fuelL - (r.fuelFlow / 2 / 3600) * fast),
          fuelR: Math.max(0, s.fuelR - (r.fuelFlow / 2 / 3600) * fast),
          hobbs: s.hobbs + fast / 3600,
          tach: s.tach + ((fast / 3600) * r.rpm) / 2400,
        };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);
  return sim;
}

/** One instrument hole in the panel, placed on the panel grid. */
function Slot({ area, children, label }: { area: string; children: ReactNode; label?: string }) {
  return (
    <div className="c182-slot" style={{ gridArea: area }}>
      {children}
      {label && <span className="c182-placard">{label}</span>}
    </div>
  );
}

function App() {
  const [running, setRunning] = useState(true);
  const [faults, setFaults] = useState<Set<Fault>>(new Set());
  const [lampTest, setLampTest] = useState(false);
  const [trim, setTrim] = useState(0.15);
  const [flaps, setFlaps] = useState(0);
  const sim = useSim(running);
  const r = readings(sim, faults);

  const toggleFault = (f: Fault) =>
    setFaults((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const lowL = r.fuelL < 5;
  const lowR = r.fuelR < 5;

  return (
    <main className="c182-page">
      <a className="back" href="./index.html">
        ← All instruments
      </a>
      <h1>Cessna 182T panel</h1>
      <p className="tagline">
        A classic steam-gauge 182T panel built from flight-indicators components, flying gentle S-turns on simulated data. Switch on a fault to see the
        annunciator and the gauges react.
      </p>

      <div className="buttons">
        <button type="button" aria-pressed={running} onClick={() => setRunning(!running)}>
          {running ? 'Pause' : 'Resume'}
        </button>
        {FAULTS.map(([f, name]) => (
          <button key={f} type="button" aria-pressed={faults.has(f)} onClick={() => toggleFault(f)}>
            {name}
          </button>
        ))}
        <button type="button" aria-pressed={lampTest} onClick={() => setLampTest(!lampTest)}>
          Annunciator test
        </button>
      </div>

      {/* On narrow screens the whole panel scrolls sideways as one piece. */}
      <div className="c182">
        <div className="c182-inner">
          <div className="c182-compass">
            <MagneticCompass size="100%" showBox={false} heading={sim.heading} />
          </div>
          <div className="c182-glareshield">
            <div className="c182-annunciator">
              <AnnunciatorPanel
                size="100%"
                test={lampTest}
                lights={{
                  fuel: lowL && lowR ? 'both' : lowL ? 'left' : lowR ? 'right' : false,
                  oil: r.oilP < 20,
                  vac: r.vacuum < 3,
                  volts: r.volts < 24.5,
                }}
              />
            </div>
          </div>

          <div className="c182-panel">
            <Slot area="clock">
              <DigitalClock size="100%" showBox={false} oat={r.oat} volts={r.volts} flightTimeRunning={running} />
            </Slot>
            <Slot area="fuel">
              <FuelQuantityGauge size="100%" showBox={false} leftQuantity={r.fuelL} rightQuantity={r.fuelR} />
            </Slot>
            <Slot area="egt">
              <EgtFuelFlowGauge size="100%" showBox={false} egt={1400 + 20 * Math.sin(sim.t / 13)} fuelFlow={r.fuelFlow} />
            </Slot>
            <Slot area="oil">
              <OilGauge size="100%" showBox={false} temperature={r.oilT} pressure={r.oilP} />
            </Slot>
            <Slot area="vac">
              <VacuumAmmeterGauge size="100%" showBox={false} vacuum={r.vacuum} amps={r.amps} />
            </Slot>

            <Slot area="asi">
              <Airspeed size="100%" showBox={false} speed={r.speed} max={200} arcs={{ white: [40, 95], green: [50, 140], yellow: [140, 175], red: 175 }} />
            </Slot>
            <Slot area="ai">
              <AttitudeIndicator size="100%" showBox={false} roll={r.roll} pitch={r.pitch} />
            </Slot>
            <Slot area="alt">
              <Altimeter size="100%" showBox={false} altitude={r.altitude} pressure={29.92} pressureUnit="inHg" />
            </Slot>
            <Slot area="tc">
              <TurnCoordinator size="100%" showBox={false} turnRate={r.turnRate} slip={r.slip} />
            </Slot>
            <Slot area="hsi">
              <HsiIndicator
                size="100%"
                showBox={false}
                heading={sim.heading}
                headingBug={90}
                course={VOR1.course}
                radial={r.radial}
                glideslope={r.glideslope}
              />
            </Slot>
            <Slot area="vsi">
              <VerticalSpeed size="100%" showBox={false} verticalSpeed={r.vs} />
            </Slot>
            <Slot area="map">
              <ManifoldFuelFlowGauge size="100%" showBox={false} manifold={r.manifold} fuelFlow={r.fuelFlow} />
            </Slot>
            <Slot area="tach">
              <Tachometer size="100%" showBox={false} rpm={r.rpm} hours={sim.tach} />
            </Slot>
            <Slot area="nav2">
              <VorIndicator size="100%" showBox={false} course={120} radial={norm(305 + 4 * Math.sin(sim.t / 25))} />
            </Slot>
            <Slot area="adf">
              <AdfIndicator size="100%" showBox={false} heading={sim.heading} bearing={relativeBearing(sim.heading, r.ndb)} />
            </Slot>
            <div className="c182-yoke" style={{ gridArea: 'yoke' }} aria-hidden="true" />

            <div className="c182-stack" style={{ gridArea: 'stack' }}>
              <DataPanel
                size="100%"
                showBox={false}
                heading="GPS"
                fields={[
                  { name: 'GS', value: r.speed + 6, unit: 'KT' },
                  { name: 'TRK', value: String(Math.round(sim.heading) % 360).padStart(3, '0'), unit: '°' },
                  { name: 'WPT', value: 'KLO' },
                  { name: 'DIS', value: 18.4 + 6 * Math.sin(sim.t / 60), unit: 'NM', decimals: 1 },
                ]}
              />
              <RadioStack width="100%" defaultNav={{ active: 116.8, standby: 110.5 }} defaultAdf={{ active: 250, standby: 362.5 }} navIdent="KLO" dme={18.4 + 6 * Math.sin(sim.t / 60)} />
            </div>

            <Slot area="hobbs">
              <HobbsMeter size="100%" showBox={false} hours={sim.hobbs} running={running && r.oilP > 20} />
            </Slot>
          </div>

          <div className="c182-pedestal">
            <Slot area="trim" label="ELEVATOR TRIM">
              <TrimIndicator size="100%" showBox={false} trim={trim} />
            </Slot>
            <Slot area="flaps" label="FLAPS">
              <FlapIndicator size="100%" showBox={false} flaps={flaps} max={40} airspeed={r.speed} speedLimits={[{ flaps: 10, speed: 140 }, { flaps: 20, speed: 120 }, { flaps: 30, speed: 100 }]} />
            </Slot>
          </div>
        </div>
      </div>

      <div className="c182-controls">
        <label className="control">
          <span className="control-head">
            Elevator trim
            <output>{trim > 0 ? `${Math.round(trim * 100)}% nose up` : trim < 0 ? `${Math.round(-trim * 100)}% nose down` : 'neutral'}</output>
          </span>
          <input type="range" min={-1} max={1} step={0.01} value={trim} onChange={(e) => setTrim(Number(e.target.value))} />
        </label>
        <label className="control">
          <span className="control-head">
            Flaps
            <output>{flaps}°</output>
          </span>
          <input type="range" min={0} max={40} step={10} value={flaps} onChange={(e) => setFlaps(Number(e.target.value))} />
        </label>
      </div>
      <p className="hint">
        Fuel burn, engine and Hobbs hours run 60 times faster than real time. The radio stack is interactive: tune its standby frequencies and swap them. On a narrow screen, scroll the panel sideways.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
