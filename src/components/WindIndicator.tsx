import type { ReactNode } from 'react';
import { CENTER, DEFAULT_ANIMATION_MS, finite, motionStyle, polar, range, tickPath, useContinuousAngle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export type RunwaySide = 'L' | 'C' | 'R';

export interface WindIndicatorProps extends InstrumentProps {
  /** Magnetic heading of the runway in degrees (either end; e.g. `90` for runway 09/27). */
  runway?: number;
  /** Parallel-runway letter for the `runway` end. The opposite end gets the mirrored letter. */
  runwaySide?: RunwaySide;
  /** Direction the wind is blowing *from*, in degrees. */
  windDirection?: number;
  /** Wind speed in knots. Below 1 kt is shown as calm. */
  windSpeed?: number;
  /** Gust speed in knots. Shown when higher than `windSpeed`. */
  windGust?: number;
  /** Crosswind (kt) above which the component readout turns amber. Default `15`. */
  crosswindLimit?: number;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
const MIRROR: Record<RunwaySide, RunwaySide> = { L: 'R', C: 'C', R: 'L' };

const WIND = '#3cc8ff';
const AMBER = '#ffb000';
const GREEN = '#3ddc84';

const norm = (deg: number): number => ((deg % 360) + 360) % 360;

/** Runway designator for a heading: 87° → "09", 4° → "36". */
function designator(heading: number): string {
  const n = Math.round(norm(heading) / 10) % 36;
  return String(n === 0 ? 36 : n).padStart(2, '0');
}

/** Runway half-length and half-width in viewBox units. The strip is drawn north–south and then rotated. */
const HALF_LEN = 96;
const HALF_W = 17;
const TOP = CENTER - HALF_LEN;
const BOTTOM = CENTER + HALF_LEN;
const LEFT = CENTER - HALF_W;
const RIGHT = CENTER + HALF_W;

/** Markings for the threshold at the bottom of the strip, i.e. the end an aircraft landing northbound touches down on. */
function Threshold({ number, side, active }: { number: string; side?: RunwaySide; active: boolean }) {
  return (
    <g>
      {[-13, -8, -3, 3, 8, 13].map((dx) => (
        <rect key={dx} x={CENTER + dx - 1.5} y={BOTTOM - 16} width="3" height="12" fill="#e8e8e8" />
      ))}
      <text
        x={CENTER}
        y={BOTTOM - 30}
        fill={active ? '#fff' : '#8a8a8a'}
        fontSize="18"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {number}
      </text>
      {side && (
        <text
          x={CENTER}
          y={BOTTOM - 48}
          fill={active ? '#fff' : '#8a8a8a'}
          fontSize="16"
          fontWeight="bold"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {side}
        </text>
      )}
      {/* Approach chevrons pointing in the landing direction. */}
      <g
        fill="none"
        stroke={GREEN}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0}
        style={{ transition: 'opacity 300ms ease-out' }}
      >
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${CENTER - 10} ${BOTTOM + 14 + i * 11} L ${CENTER} ${BOTTOM + 6 + i * 11} L ${CENTER + 10} ${BOTTOM + 14 + i * 11}`}
            opacity={1 - i * 0.3}
          />
        ))}
      </g>
    </g>
  );
}

/** Upright digital window whose centre is moved by `dx`/`dy`. */
function Readout({
  dx,
  dy,
  duration,
  testId,
  children,
}: {
  dx: number;
  dy: number;
  duration: number;
  testId: string;
  children: ReactNode;
}) {
  return (
    <g style={motionStyle(`translate(${dx}px, ${dy}px)`, duration)}>
      <rect x={CENTER - 56} y={CENTER - 13} width="112" height="26" rx="4" fill="#000" stroke="#555" strokeWidth="2" />
      <text
        data-testid={testId}
        x={CENTER}
        y={CENTER + 1}
        fontSize="15"
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {children}
      </text>
    </g>
  );
}

export function WindIndicator({
  runway = 0,
  runwaySide,
  windDirection = 0,
  windSpeed = 0,
  windGust,
  crosswindLimit = 15,
  ...props
}: WindIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const rwy = finite(runway);
  const dir = finite(windDirection);
  const speed = Math.max(0, finite(windSpeed));
  const gust = Math.max(0, finite(windGust));
  const calm = speed < 1;
  const hasGust = !calm && Math.round(gust) > Math.round(speed);

  // Land on whichever end faces into the wind (the given end wins in calm or pure crosswind).
  const headOnGiven = speed * Math.cos(((dir - rwy) * Math.PI) / 180);
  const reversed = !calm && headOnGiven < -1e-9;
  const landing = reversed ? rwy + 180 : rwy;
  const rel = ((dir - landing) * Math.PI) / 180;
  const headwind = Math.round(speed * Math.cos(rel));
  const crosswind = Math.round(speed * Math.sin(rel));
  const peakCrosswind = Math.abs((hasGust ? gust : speed) * Math.sin(rel));
  const overLimit = peakCrosswind > crosswindLimit;

  const baseNumber = designator(rwy);
  const oppositeNumber = designator(rwy + 180);
  const activeNumber = reversed ? oppositeNumber : baseNumber;
  const activeSide = runwaySide && (reversed ? MIRROR[runwaySide] : runwaySide);

  const displayRunway = useContinuousAngle(rwy);
  const displayWind = useContinuousAngle(dir);

  // Readouts sit either side of the strip, perpendicular to it, so they never cover it.
  const perpendicular = (norm(rwy) % 180) - 90;
  const [wx, wy] = polar(78, perpendicular);
  const [cx, cy] = polar(78, perpendicular + 180);

  const dirText = String(Math.round(norm(dir)) || 360).padStart(3, '0');
  const windText = calm ? 'CALM' : `${dirText}° ${Math.round(speed)}${hasGust ? `G${Math.round(gust)}` : ''}KT`;
  const crossText = crosswind === 0 ? '0' : `${Math.abs(crosswind)}${crosswind > 0 ? 'R' : 'L'}`;

  const label =
    `Wind: ${calm ? 'calm' : `${dirText}° at ${Math.round(speed)}${hasGust ? ` gusting ${Math.round(gust)}` : ''} knots`}, ` +
    `runway ${activeNumber}${activeSide ?? ''} in use, ${headwind < 0 ? 'tailwind' : 'headwind'} ${Math.abs(headwind)}, ` +
    `crosswind ${Math.abs(crosswind)}${crosswind === 0 ? '' : crosswind > 0 ? ' from the right' : ' from the left'}`;

  return (
    <InstrumentFrame {...props} label={label}>
      {/* Fixed north-up compass rose. */}
      <g stroke="#fff" strokeLinecap="round">
        {range(0, 350, 10).map((a) => (
          <path key={a} d={tickPath(176, a % 30 === 0 ? 162 : 168, a)} strokeWidth={a % 30 === 0 ? 3 : 2} opacity={a % 30 === 0 ? 1 : 0.7} />
        ))}
      </g>
      {range(0, 330, 30).map((a) => {
        const [x, y] = polar(146, a);
        return (
          <text
            key={a}
            x={x}
            y={y}
            transform={`rotate(${a} ${x} ${y})`}
            fill={a % 90 === 0 ? AMBER : '#fff'}
            fontSize={a % 90 === 0 ? 22 : 18}
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {CARDINALS[a] ?? String(a / 10)}
          </text>
        );
      })}

      {/* Faint wind line across the field, under the runway. */}
      <g style={{ ...motionStyle(`rotate(${displayWind}deg)`, duration), opacity: calm ? 0 : 1 }}>
        <path
            d={`M ${CENTER} ${CENTER - 132} V ${CENTER + 120}`}
            stroke={WIND}
            strokeWidth="2"
            strokeDasharray="2 8"
            strokeLinecap="round"
            opacity="0.45"
        />
      </g>

      {/* Runway, drawn north–south and rotated to its heading. */}
      <g data-testid="wind-runway" style={motionStyle(`rotate(${displayRunway}deg)`, duration)}>
        <rect x={LEFT - 2} y={TOP - 2} width={HALF_W * 2 + 4} height={HALF_LEN * 2 + 4} rx="3" fill="#000" opacity="0.5" />
        <rect x={LEFT} y={TOP} width={HALF_W * 2} height={HALF_LEN * 2} rx="2" fill="#34373c" stroke="#5c6066" strokeWidth="1" />
        <g stroke="#e8e8e8" strokeWidth="1.2">
          <path d={`M ${LEFT + 2.5} ${TOP + 2} V ${BOTTOM - 2} M ${RIGHT - 2.5} ${TOP + 2} V ${BOTTOM - 2}`} />
        </g>
        <g fill="#e8e8e8">
          {range(TOP + 62, BOTTOM - 70, 16).map((y) => (
            <rect key={y} x={CENTER - 1} y={y} width="2" height="9" />
          ))}
        </g>
        <Threshold number={baseNumber} side={runwaySide} active={!reversed} />
        <g transform={`rotate(180 ${CENTER} ${CENTER})`}>
          <Threshold number={oppositeNumber} side={runwaySide && MIRROR[runwaySide]} active={reversed} />
        </g>
      </g>

      <Readout dx={wx - CENTER} dy={wy - CENTER} duration={duration} testId="wind-readout">
        <tspan fill={WIND}>{windText}</tspan>
      </Readout>
      <Readout dx={cx - CENTER} dy={cy - CENTER} duration={duration} testId="wind-components">
        <tspan fill={headwind < 0 ? AMBER : '#fff'}>{`${headwind < 0 ? 'TW' : 'HW'} ${Math.abs(headwind)}`}</tspan>
        <tspan dx="14" fill={overLimit ? AMBER : '#fff'}>{`XW ${crossText}`}</tspan>
      </Readout>
      {/* Wind arrow on the rim, pointing downwind towards the field. */}
      <g data-testid="wind-arrow" style={{ ...motionStyle(`rotate(${displayWind}deg)`, duration), opacity: calm ? 0 : 1 }}>
        <path
          d={`M ${CENTER} ${CENTER - 134} L ${CENTER - 20} ${CENTER - 168} L ${CENTER - 6} ${CENTER - 162} L ${CENTER - 6} ${CENTER - 192} L ${CENTER + 6} ${CENTER - 192} L ${CENTER + 6} ${CENTER - 162} L ${CENTER + 20} ${CENTER - 168} Z`}
          fill={WIND}
          stroke="#00121a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
    </InstrumentFrame>
  );
}
