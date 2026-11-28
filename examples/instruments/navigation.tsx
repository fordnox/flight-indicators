import { StrictMode, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { IlsIndicator, VorIndicator, vorDeviation, type IlsIndicatorProps, type InstrumentProps, type ToFrom } from '../../src';

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const rad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pad3 = (deg: number) => String(Math.round(norm(deg)) || 360).padStart(3, '0');
/** Signed difference a - b wrapped into (-180, 180]. */
const signedDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

/** Runs `step` every `ms` while `running` is true, always calling the latest closure. */
function useTicker(running: boolean, ms: number, step: () => void) {
  const latest = useRef(step);
  latest.current = step;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => latest.current(), ms);
    return () => clearInterval(id);
  }, [running, ms]);
}

function Slider({ label, value, min, max, step, format, onChange, disabled }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="control">
      <span className="control-head">
        {label}
        <output>{format(value)}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

function Readout({ name, value }: { name: string; value: string }) {
  return (
    <div className="readout">
      {name}
      <b>{value}</b>
    </div>
  );
}

function Head({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <div className="head">
      {children}
      <code>{caption}</code>
    </div>
  );
}

const HEAD = 150;

/* ------------------------------------------------------------------ VOR */

const MAP_NM = 25;
/** Simulated speed: 120 kt, sped up 20 times so things happen quickly. */
const VOR_NM_PER_TICK = (120 / 3600) * 0.1 * 20;

interface VorState {
  x: number; // nm east of the station
  y: number; // nm north of the station
  heading: number;
  obs: number;
}

function VorSection() {
  const [st, setSt] = useState<VorState>({ x: -14, y: -9, heading: 60, obs: 90 });
  const [flying, setFlying] = useState(true);
  const [autopilot, setAutopilot] = useState(true);
  const [failed, setFailed] = useState(false);
  const [trail, setTrail] = useState<Array<[number, number]>>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  const dist = Math.hypot(st.x, st.y);
  const radial = norm(toDeg(Math.atan2(st.x, st.y)));
  // No signal when the VOR fails, far away, or in the cone of confusion right over the station.
  const signal = !failed && dist > 0.6 && dist < 40;
  const { deviation, toFrom } = vorDeviation(st.obs, radial);

  useTicker(flying, 100, () => {
    setSt((s) => {
      let heading = s.heading;
      if (autopilot) {
        // Intercept: fly the selected course, angled towards the needle (4° per degree off, 45° max), 3° per tick turn rate.
        const r = norm(toDeg(Math.atan2(s.x, s.y)));
        const dev = vorDeviation(s.obs, r).deviation;
        const want = norm(s.obs + clamp(dev * 4, -45, 45));
        heading = norm(heading + clamp(signedDiff(want, heading), -3, 3));
      }
      let x = s.x + VOR_NM_PER_TICK * Math.sin(rad(heading));
      let y = s.y + VOR_NM_PER_TICK * Math.cos(rad(heading));
      // Leaving the map: come back in on the far side.
      if (Math.abs(x) > MAP_NM) x = -Math.sign(x) * (MAP_NM - 0.5);
      if (Math.abs(y) > MAP_NM) y = -Math.sign(y) * (MAP_NM - 0.5);
      return { ...s, x, y, heading };
    });
    setTrail((t) => [...t.slice(-80), [st.x, st.y]]);
  });

  const moveTo = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    setSt((s) => ({ ...s, x: p.x, y: -p.y }));
    setTrail([]);
  };

  const courseEnd = (bearing: number, r: number) => [r * Math.sin(rad(bearing)), -r * Math.cos(rad(bearing))] as const;
  const [fx, fy] = courseEnd(st.obs, 40);
  const [tx, ty] = courseEnd(st.obs + 180, 40);
  const flag: ToFrom = signal ? toFrom : 'OFF';
  const devText = !signal ? '---' : Math.abs(deviation) > 90 ? '---' : `${Math.abs(deviation).toFixed(1)}° ${deviation >= 0 ? 'R' : 'L'}`;

  return (
    <section className="section">
      <h2>Track a VOR radial</h2>
      <p>
        The aircraft flies around a VOR station. Turn the OBS to pick a course: the needle shows which side of that course line you are on and the
        flag shows whether the course takes you TO or FROM the station. Click the map to move the aircraft. Over the station (the cone of
        confusion) and with the VOR failed, the NAV flag drops. All four heads below get the same two props: <code>course</code> and{' '}
        <code>radial</code>.
      </p>
      <div className="sim">
        <div className="card">
          <svg ref={svgRef} className="map" viewBox={`${-MAP_NM} ${-MAP_NM} ${MAP_NM * 2} ${MAP_NM * 2}`} onPointerDown={moveTo} role="img" aria-label="Map of the VOR station and the aircraft">
            {/* Range rings and compass rose around the station. */}
            {[10, 20].map((r) => (
              <circle key={r} r={r} fill="none" stroke="#26303b" strokeWidth="0.15" />
            ))}
            {Array.from({ length: 36 }, (_, i) => i * 10).map((a) => {
              const [x1, y1] = courseEnd(a, a % 30 === 0 ? 6.5 : 7.2);
              const [x2, y2] = courseEnd(a, 8);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b4a5a" strokeWidth="0.2" />;
            })}
            {[0, 90, 180, 270].map((a) => {
              const [x, y] = courseEnd(a, 9.5);
              return (
                <text key={a} x={x} y={y} fill="#5d7084" fontSize="1.8" textAnchor="middle" dominantBaseline="central">
                  {'NESW'[a / 90]}
                </text>
              );
            })}
            {/* Selected course line: solid on the FROM side, dashed on the TO side. */}
            <line x1={0} y1={0} x2={fx} y2={fy} stroke="#ffb000" strokeWidth="0.25" />
            <line x1={0} y1={0} x2={tx} y2={ty} stroke="#ffb000" strokeWidth="0.25" strokeDasharray="1 0.8" />
            <text x={fx * 0.4} y={fy * 0.4 - 1} fill="#ffb000" fontSize="1.6" textAnchor="middle">
              {pad3(st.obs)}° radial
            </text>
            {/* Station symbol. */}
            <polygon points="1.2,0 0.6,1.04 -0.6,1.04 -1.2,0 -0.6,-1.04 0.6,-1.04" fill="none" stroke="#6cb6ff" strokeWidth="0.3" />
            <circle r="0.3" fill="#6cb6ff" />
            {/* Trail and aircraft. */}
            <polyline points={trail.map(([x, y]) => `${x},${-y}`).join(' ')} fill="none" stroke="#9fb3c8" strokeOpacity="0.4" strokeWidth="0.2" />
            <g transform={`translate(${st.x} ${-st.y}) rotate(${st.heading})`}>
              <path d="M 0 -1.6 L 1.1 1.2 L 0 0.6 L -1.1 1.2 Z" fill="#e6e6e6" stroke="#000" strokeWidth="0.15" />
            </g>
          </svg>
          <div className="buttons">
            <Toggle pressed={flying} onClick={() => setFlying(!flying)}>
              {flying ? 'Pause' : 'Fly'}
            </Toggle>
            <Toggle pressed={autopilot} onClick={() => setAutopilot(!autopilot)}>
              Autopilot: track course
            </Toggle>
            <Toggle pressed={failed} onClick={() => setFailed(!failed)}>
              Fail VOR
            </Toggle>
            <button type="button" onClick={() => setSt((s) => ({ ...s, obs: Math.round(norm(radial + 180)) }))}>
              Centre needle (TO)
            </button>
          </div>
          <div className="controls">
            <Slider label="OBS course" value={st.obs} min={0} max={359} step={1} format={(v) => `${pad3(v)}°`} onChange={(obs) => setSt((s) => ({ ...s, obs }))} />
            <Slider
              label="Heading"
              value={Math.round(st.heading)}
              min={0}
              max={359}
              step={1}
              disabled={autopilot}
              format={(v) => `${pad3(v)}°`}
              onChange={(heading) => setSt((s) => ({ ...s, heading }))}
            />
          </div>
          <p className="hint">Turn the autopilot off to steer by hand. Fly over the station and watch the flag flip from TO to FROM.</p>
        </div>
        <div className="card">
          <div className="heads">
            <Head caption='<VorIndicator />'>
              <VorIndicator size={HEAD} course={st.obs} radial={radial} signal={signal} />
            </Head>
            <Head caption='needle="swing"'>
              <VorIndicator size={HEAD} course={st.obs} radial={radial} signal={signal} needle="swing" />
            </Head>
            <Head caption='<IlsIndicator />'>
              <IlsIndicator size={HEAD} course={st.obs} radial={radial} signal={signal} />
            </Head>
            <Head caption='needles="swing"'>
              <IlsIndicator size={HEAD} course={st.obs} radial={radial} signal={signal} needles="swing" />
            </Head>
          </div>
          <div className="readouts">
            <Readout name="Radial (from)" value={`${pad3(radial)}°`} />
            <Readout name="Bearing to" value={`${pad3(radial + 180)}°`} />
            <Readout name="DME" value={`${dist.toFixed(1)} NM`} />
            <Readout name="OBS" value={`${pad3(st.obs)}°`} />
            <Readout name="Deviation" value={devText} />
            <Readout name="Flag" value={signal ? flag : 'NAV'} />
          </div>
          <p className="hint">The ILS heads show their GS flag here because a VOR has no glideslope.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ ILS */

const GLIDEPATH = 3;
const FT_PER_NM = 6076;
/** Localizer antenna sits beyond the far end of the runway, the glideslope antenna ~1000 ft past the threshold. */
const LOC_ANTENNA_NM = 1;
const GS_ANTENNA_NM = 0.17;
const START_NM = 14;

interface IlsState {
  dist: number; // nm from the threshold
  lateral: number; // nm, positive = right of the centreline (south, for runway 09)
  offset: number; // ft above (+) or below (-) the glidepath
}

/** Raw ILS deviations for an aircraft. Localizer: positive when the centreline is to the right. Glideslope: positive when the glidepath is above. */
function ilsDeviation({ dist, lateral, offset }: IlsState) {
  const loc = -toDeg(Math.atan2(lateral, dist + LOC_ANTENNA_NM));
  const height = Math.max(0, (dist + GS_ANTENNA_NM) * FT_PER_NM * Math.tan(rad(GLIDEPATH)) + offset);
  const angle = toDeg(Math.atan2(height, (dist + GS_ANTENNA_NM) * FT_PER_NM));
  return { loc, gs: GLIDEPATH - angle, height };
}

function IlsSection() {
  const [st, setSt] = useState<IlsState>({ dist: START_NM, lateral: 0.8, offset: 300 });
  const [playing, setPlaying] = useState(true);
  const [failLoc, setFailLoc] = useState(false);
  const [failGs, setFailGs] = useState(false);
  const t0 = useRef(performance.now());

  useTicker(playing, 100, () => {
    const t = (performance.now() - t0.current) / 1000;
    setSt((s) => {
      const dist = s.dist - 0.02;
      if (dist < 0) {
        t0.current = performance.now();
        return { dist: START_NM, lateral: 0.8, offset: 300 };
      }
      // A slightly wobbly pilot who settles down as the runway gets closer.
      const settle = Math.min(1, dist / 8);
      const wantLateral = 0.9 * Math.cos(t / 9) * settle;
      const wantOffset = 260 * Math.cos(t / 6.5) * settle;
      return { dist, lateral: s.lateral + (wantLateral - s.lateral) * 0.03, offset: s.offset + (wantOffset - s.offset) * 0.03 };
    });
  });

  const { loc, gs, height } = ilsDeviation(st);
  const locSignal = !failLoc && st.dist <= 18 && Math.abs(loc) < 35;
  const gsSignal = !failGs && st.dist <= 10 && Math.abs(loc) < 8;
  const common: IlsIndicatorProps = {
    size: HEAD,
    course: 90,
    deviation: loc,
    fullScale: 2.5,
    signal: locSignal,
    glideslope: gsSignal ? gs : undefined,
    toFrom: 'OFF',
  };

  // Plan and profile views share the x scale: 20 px per nm, threshold at x = 300.
  const X = (nm: number) => 300 - nm * 20;
  const PY = (nm: number) => 55 + nm * 28;
  const ALT = (ft: number) => 112 - ft * 0.018;
  const locHalf = (nm: number) => (nm + LOC_ANTENNA_NM) * Math.tan(rad(2.5));
  const gsAt = (nm: number, deg: number) => (nm + GS_ANTENNA_NM) * FT_PER_NM * Math.tan(rad(deg));
  const edit = (patch: Partial<IlsState>) => {
    setPlaying(false);
    setSt((s) => ({ ...s, ...patch }));
  };
  const dots = (deg: number, perDot: number) => `${Math.abs(deg / perDot).toFixed(1)} dots`;

  return (
    <section className="section">
      <h2>Fly an ILS approach</h2>
      <p>
        An approach to runway 09 from 14 NM out. The localizer is about four times as sensitive as a VOR (full scale ±2.5° instead of ±10°), set with{' '}
        <code>fullScale={'{2.5}'}</code>. The glideslope needle comes alive inside 10 NM; until then, or when it fails, the GS flag shows. A
        localizer has no TO/FROM, so that window stays blank.
      </p>
      <div className="sim">
        <div className="card">
          <svg className="map" viewBox="0 0 340 110" role="img" aria-label="Plan view of the approach">
            <text x="6" y="14" fill="#5d7084" fontSize="10">PLAN</text>
            <polygon
              points={`${X(-LOC_ANTENNA_NM)},${PY(0)} ${X(18)},${PY(-locHalf(18))} ${X(18)},${PY(locHalf(18))}`}
              fill="#6cb6ff"
              fillOpacity="0.12"
            />
            <line x1={X(18)} y1={PY(0)} x2={X(-LOC_ANTENNA_NM)} y2={PY(0)} stroke="#6cb6ff" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="4 3" />
            <rect x={X(0)} y={PY(0) - 3} width="16" height="6" fill="#55606c" />
            {[5, 10].map((nm) => (
              <text key={nm} x={X(nm)} y={104} fill="#5d7084" fontSize="9" textAnchor="middle">{nm} NM</text>
            ))}
            <g transform={`translate(${X(st.dist)} ${PY(st.lateral)})`}>
              <path d="M 6 0 L -5 -4 L -2 0 L -5 4 Z" fill="#e6e6e6" stroke="#000" strokeWidth="0.6" />
            </g>
          </svg>
          <svg className="map" viewBox="0 0 340 120" role="img" aria-label="Side view of the approach" style={{ marginTop: 8 }}>
            <text x="6" y="14" fill="#5d7084" fontSize="10">PROFILE</text>
            <polygon
              points={`${X(-GS_ANTENNA_NM)},${ALT(0)} ${X(10)},${ALT(gsAt(10, GLIDEPATH + 0.7))} ${X(10)},${ALT(gsAt(10, GLIDEPATH - 0.7))}`}
              fill="#ffb000"
              fillOpacity="0.12"
            />
            <line x1={X(-GS_ANTENNA_NM)} y1={ALT(0)} x2={X(START_NM)} y2={ALT(gsAt(START_NM, GLIDEPATH))} stroke="#ffb000" strokeOpacity="0.5" strokeWidth="0.8" strokeDasharray="4 3" />
            <line x1="0" y1={ALT(0)} x2="340" y2={ALT(0)} stroke="#3b4a5a" strokeWidth="1" />
            <rect x={X(0)} y={ALT(0) - 1} width="16" height="3" fill="#55606c" />
            <circle cx={X(st.dist)} cy={ALT(height)} r="3.5" fill="#e6e6e6" stroke="#000" strokeWidth="0.6" />
          </svg>
          <div className="buttons">
            <Toggle pressed={playing} onClick={() => setPlaying(!playing)}>
              {playing ? 'Pause' : 'Fly'}
            </Toggle>
            <button
              type="button"
              onClick={() => {
                t0.current = performance.now();
                setSt({ dist: START_NM, lateral: 0.8, offset: 300 });
                setPlaying(true);
              }}
            >
              Restart
            </button>
            <Toggle pressed={failLoc} onClick={() => setFailLoc(!failLoc)}>
              Fail LOC
            </Toggle>
            <Toggle pressed={failGs} onClick={() => setFailGs(!failGs)}>
              Fail GS
            </Toggle>
          </div>
          <div className="controls">
            <Slider label="Distance to threshold" value={st.dist} min={0} max={18} step={0.1} format={(v) => `${v.toFixed(1)} NM`} onChange={(dist) => edit({ dist })} />
            <Slider
              label="Off centreline"
              value={st.lateral}
              min={-1.5}
              max={1.5}
              step={0.01}
              format={(v) => (Math.abs(v) < 0.005 ? 'on' : `${Math.abs(v).toFixed(2)} NM ${v > 0 ? 'right' : 'left'}`)}
              onChange={(lateral) => edit({ lateral })}
            />
            <Slider
              label="Above / below glidepath"
              value={st.offset}
              min={-600}
              max={600}
              step={10}
              format={(v) => (Math.abs(v) < 5 ? 'on' : `${Math.round(Math.abs(v))} ft ${v > 0 ? 'high' : 'low'}`)}
              onChange={(offset) => edit({ offset })}
            />
          </div>
        </div>
        <div className="card">
          <div className="heads">
            <Head caption='<IlsIndicator fullScale={2.5} />'>
              <IlsIndicator {...common} />
            </Head>
            <Head caption='needles="swing"'>
              <IlsIndicator {...common} needles="swing" />
            </Head>
          </div>
          <div className="readouts">
            <Readout name="Distance" value={`${st.dist.toFixed(1)} NM`} />
            <Readout name="Height" value={`${Math.round(height)} ft`} />
            <Readout name="Localizer" value={locSignal ? `${Math.abs(loc).toFixed(2)}° ${loc >= 0 ? 'R' : 'L'}` : 'flag'} />
            <Readout name="LOC needle" value={locSignal ? dots(clamp(loc, -2.5, 2.5), 0.5) : '---'} />
            <Readout name="Glideslope" value={gsSignal ? `${Math.abs(gs).toFixed(2)}° ${gs >= 0 ? 'up' : 'down'}` : 'flag'} />
            <Readout name="GS needle" value={gsSignal ? dots(clamp(gs, -0.7, 0.7), 0.14) : '---'} />
          </div>
          <p className="hint">
            Needle up means the glidepath is above you: fly up. Needle right means the centreline is to the right: turn right. Pass{' '}
            <code>glideslope</code> as <code>undefined</code> when it is not received.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Scenarios */

type HeadKind = 'vor-slide' | 'vor-swing' | 'ils-slide' | 'ils-swing';
const KINDS: Array<{ kind: HeadKind; label: string }> = [
  { kind: 'vor-slide', label: 'VorIndicator' },
  { kind: 'vor-swing', label: 'VorIndicator, swing' },
  { kind: 'ils-slide', label: 'IlsIndicator' },
  { kind: 'ils-swing', label: 'IlsIndicator, swing' },
];

interface Scenario {
  title: string;
  text: string;
  props: Omit<IlsIndicatorProps, keyof InstrumentProps | 'needles'>;
  /** Uses ILS-only props, so it is always drawn on an IlsIndicator. */
  ils?: boolean;
}

const SCENARIOS: Scenario[] = [
  { title: 'Inbound, on course', text: 'Needle centred with a TO flag: flying 090° takes you straight to the station.', props: { course: 90, radial: 270 } },
  { title: 'Outbound, on course', text: 'Same course after passing the station: the flag flips to FROM.', props: { course: 90, radial: 90 } },
  { title: 'Course to the right', text: 'Needle right of centre: the course is 8° (4 dots) to the right. Turn right to intercept.', props: { course: 90, radial: 278 } },
  { title: 'Full-scale deflection', text: 'More than 10° off: the needle pins at the last dot.', props: { course: 90, radial: 300 } },
  { title: 'Abeam the station', text: 'Crossing the radial at 90°: neither TO nor FROM, so the flag blanks.', props: { course: 0, deviation: -10, toFrom: 'OFF' } },
  { title: 'No VOR signal', text: 'signal={false} drops the NAV flag and centres the needle.', props: { course: 90, radial: 270, signal: false } },
  { title: 'VOR sensitivity', text: '2° off course on a VOR moves the needle 1 dot.', props: { course: 90, deviation: 2, toFrom: 'TO' } },
  { title: 'Localizer sensitivity', text: 'The same 2° on a localizer (fullScale 2.5) is 4 dots.', props: { course: 90, deviation: 2, fullScale: 2.5, glideslope: 0 }, ils: true },
  { title: 'On the ILS', text: 'Both needles centred: on the localizer and on the glidepath.', props: { course: 265, deviation: 0, fullScale: 2.5, glideslope: 0 }, ils: true },
  { title: 'High on the glidepath', text: 'Glideslope needle below centre: the glidepath is below you. Fly down.', props: { course: 265, deviation: 0, fullScale: 2.5, glideslope: -0.35 }, ils: true },
  { title: 'Low and left', text: 'Needles up and right: fly up and turn right.', props: { course: 265, deviation: 1, fullScale: 2.5, glideslope: 0.5 }, ils: true },
  { title: 'Localizer only', text: 'No glideslope (a LOC approach): GS flag in view, the hinged needle parks out of the way.', props: { course: 265, deviation: -0.6, fullScale: 2.5 }, ils: true },
  { title: 'Glideslope failure', text: 'glideslopeSignal={false} flags the glideslope even while a value is passed.', props: { course: 265, deviation: 0.4, fullScale: 2.5, glideslope: 0.2, glideslopeSignal: false }, ils: true },
  { title: 'Total failure', text: 'No NAV and no GS: both flags, needles centred or parked.', props: { course: 265, signal: false }, ils: true },
];

const propText = (k: string, v: unknown) => (typeof v === 'string' ? `${k}="${v}"` : `${k}={${String(v)}}`);

function snippet(name: string, extra: Record<string, unknown>, props: Record<string, unknown>) {
  const parts = [...Object.entries(extra), ...Object.entries(props)].map(([k, v]) => propText(k, v));
  return `<${name} ${parts.join(' ')} />`;
}

function ScenarioSection() {
  const [kind, setKind] = useState<HeadKind>('ils-slide');
  const swing = kind.endsWith('swing');

  return (
    <section className="section">
      <h2>Needle and flag states</h2>
      <p>
        Fixed snapshots of the situations you meet on VOR and ILS approaches, with the props that produce each one. Pick the head style to compare.
        Scenarios that use glideslope or localizer props always use <code>IlsIndicator</code>.
      </p>
      <div className="buttons">
        {KINDS.map((k) => (
          <Toggle key={k.kind} pressed={kind === k.kind} onClick={() => setKind(k.kind)}>
            {k.label}
          </Toggle>
        ))}
      </div>
      <div className="scenarios">
        {SCENARIOS.map(({ title, text, props, ils }) => {
          const useIls = ils || kind.startsWith('ils');
          const style = swing ? (useIls ? { needles: 'swing' } : { needle: 'swing' }) : {};
          return (
            <div key={title} className="card scenario">
              <h3>{title}</h3>
              {useIls ? (
                <IlsIndicator size={180} {...props} needles={swing ? 'swing' : 'slide'} />
              ) : (
                <VorIndicator size={180} {...props} needle={swing ? 'swing' : 'slide'} />
              )}
              <p>{text}</p>
              <pre>{snippet(useIls ? 'IlsIndicator' : 'VorIndicator', style, props)}</pre>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  return (
    <main>
      <header className="page-header">
        <h1>VOR &amp; ILS</h1>
        <a className="back" href="./index.html">
          ← All instruments
        </a>
      </header>
      <p className="tagline">
        Interactive examples for <code>VorIndicator</code> and <code>IlsIndicator</code> from flight-indicators.
      </p>
      <VorSection />
      <IlsSection />
      <ScenarioSection />
      <footer className="page-footer">
        <a href="https://github.com/fordnox/flight-indicators" target="_blank" rel="noreferrer">
          flight-indicators on GitHub
        </a>{' '}
        · MIT License
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
