import { CENTER, DEFAULT_ANIMATION_MS, finite, motionStyle, polar, range, tickPath } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';

export type PressureUnit = 'hPa' | 'inHg';

export interface AltimeterProps extends InstrumentProps {
  /** Indicated altitude in feet (negative values allowed). */
  altitude?: number;
  /** Altimeter setting shown in the Kollsman window. Defaults to standard pressure in `pressureUnit`. */
  pressure?: number;
  /** Unit of `pressure`. Default `"hPa"`. */
  pressureUnit?: PressureUnit;
}

const STANDARD: Record<PressureUnit, number> = { hPa: 1013, inHg: 29.92 };

export function Altimeter({ altitude = 0, pressure, pressureUnit = 'hPa', ...props }: AltimeterProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const alt = finite(altitude);
  const qnh = finite(pressure, STANDARD[pressureUnit]);
  const qnhText = pressureUnit === 'inHg' ? qnh.toFixed(2) : Math.round(qnh).toString();

  return (
    <InstrumentFrame {...props} label={`Altimeter: ${Math.round(alt)} feet, ${qnhText} ${pressureUnit}`}>
      <g stroke="#fff" strokeLinecap="round">
        {range(0, 49, 1).map((i) => (
          <path key={i} d={tickPath(178, i % 5 === 0 ? 150 : 164, i * 7.2)} strokeWidth={i % 5 === 0 ? 4 : 2} />
        ))}
      </g>
      {range(0, 9, 1).map((n) => {
        const [x, y] = polar(126, n * 36);
        return (
          <text key={n} x={x} y={y} fill="#fff" fontSize="32" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {n}
          </text>
        );
      })}

      <text x={CENTER} y={CENTER - 58} fill="#ccc" fontSize="16" textAnchor="middle">ALT</text>
      <text x={CENTER} y={CENTER - 40} fill="#ccc" fontSize="12" textAnchor="middle">100 FEET</text>

      {/* Kollsman window */}
      <rect x={CENTER + 30} y={CENTER - 16} width="74" height="32" rx="4" fill="#000" stroke="#666" strokeWidth="2" />
      <text data-testid="altimeter-pressure" x={CENTER + 67} y={CENTER + 1} fill="#fff" fontSize="20" fontFamily="monospace" textAnchor="middle" dominantBaseline="central">
        {qnhText}
      </text>
      <text x={CENTER + 67} y={CENTER + 30} fill="#ccc" fontSize="12" textAnchor="middle">{pressureUnit}</text>

      {/* 10,000 ft pointer */}
      <g data-testid="altimeter-10000" style={motionStyle(`rotate(${(alt / 100000) * 360}deg)`, duration)}>
        <path d={`M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - 150}`} stroke="#fff" strokeWidth="3" />
        <path d={`M ${CENTER} ${CENTER - 178} l -10 22 h 20 z`} fill="#fff" />
      </g>
      {/* 1,000 ft hand */}
      <g data-testid="altimeter-1000" style={motionStyle(`rotate(${(alt / 10000) * 360}deg)`, duration)}>
        <path d={`M ${CENTER - 9} ${CENTER + 14} L ${CENTER - 12} ${CENTER - 70} L ${CENTER} ${CENTER - 100} L ${CENTER + 12} ${CENTER - 70} L ${CENTER + 9} ${CENTER + 14} Z`} fill="#fff" stroke="#000" strokeWidth="1.5" />
      </g>
      {/* 100 ft hand */}
      <g data-testid="altimeter-100" style={motionStyle(`rotate(${(alt / 1000) * 360}deg)`, duration)}>
        <path d={`M ${CENTER - 5} ${CENTER + 30} L ${CENTER - 4} ${CENTER - 140} L ${CENTER} ${CENTER - 168} L ${CENTER + 4} ${CENTER - 140} L ${CENTER + 5} ${CENTER + 30} Z`} fill="#fff" stroke="#000" strokeWidth="1.5" />
      </g>
      <Hub />
    </InstrumentFrame>
  );
}
