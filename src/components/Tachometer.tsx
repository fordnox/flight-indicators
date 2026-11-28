import { CENTER, DEFAULT_ANIMATION_MS, arcPath, clamp, finite, motionStyle, polar, range, tickPath, useSvgId } from '../utils';
import { Hub, InstrumentFrame, type InstrumentProps } from './Instrument';
import { Odometer } from './Odometer';

export interface TachometerProps extends InstrumentProps {
  /** Engine speed in RPM. Clamped to `0…max`. */
  rpm?: number;
  /** Top of the scale in RPM. Default `3500`. */
  max?: number;
  /** Normal operating band `[from, to]` in RPM, drawn green. Default `[2000, 2400]` (Cessna 182T). `null` hides it. */
  green?: [number, number] | null;
  /** Red line in RPM. Default `2400`. `null` hides it. */
  redline?: number | null;
  /** Engine hours shown on the hour meter in the dial. Leave it out to hide the meter. */
  hours?: number;
}

/** Needle sweep: 0 RPM at 7:30, the top of the scale at 4:30. */
const START = -135;
const SWEEP = 270;

/**
 * Analog tachometer, marked in hundreds of RPM, with a green operating arc, a red line and an optional
 * engine hour meter in the lower half of the dial.
 */
export function Tachometer({ rpm = 0, max = 3500, green = [2000, 2400], redline = 2400, hours, ...props }: TachometerProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const clipId = useSvgId('fi-tach');
  const top = Math.max(500, finite(max, 3500));
  const value = clamp(finite(rpm), 0, top);
  const angle = (v: number) => START + (clamp(v, 0, top) / top) * SWEEP;
  const showHours = typeof hours === 'number' && Number.isFinite(hours);
  const engineHours = showHours ? Math.max(0, hours) : 0;

  return (
    <InstrumentFrame {...props} label={`Tachometer: ${Math.round(value)} RPM${showHours ? `, ${engineHours.toFixed(1)} hours` : ''}`}>
      {green && <path d={arcPath(166, angle(green[0]), angle(green[1]))} stroke="#2fb54a" strokeWidth="12" fill="none" />}
      <g stroke="#fff" strokeLinecap="round">
        {range(0, top, 100).map((v) => {
          const major = v % 500 === 0;
          return <path key={v} d={tickPath(178, major ? 148 : 162, angle(v))} strokeWidth={major ? 3.5 : 2} />;
        })}
      </g>
      {typeof redline === 'number' && Number.isFinite(redline) && <path d={tickPath(180, 146, angle(redline))} stroke="#e02020" strokeWidth="6" />}
      {range(0, top, 500).map((v) => {
        const [x, y] = polar(122, angle(v));
        return (
          <text key={v} x={x} y={y} fill="#fff" fontSize="26" fontWeight="bold" textAnchor="middle" dominantBaseline="central">
            {v / 100}
          </text>
        );
      })}

      <text x={CENTER} y={CENTER - 50} fill="#ddd" fontSize="20" fontWeight="bold" textAnchor="middle">RPM</text>
      <text x={CENTER} y={CENTER - 28} fill="#bbb" fontSize="13" textAnchor="middle">× 100</text>

      {showHours && (
        <>
          <Odometer value={engineHours} digits={6} x={CENTER} y={CENTER + 70} digitWidth={20} height={28} clipId={clipId} testId="tach-hours" />
          <text x={CENTER} y={CENTER + 103} fill="#bbb" fontSize="11" textAnchor="middle" letterSpacing="2">HOURS</text>
        </>
      )}

      <g data-testid="tach-needle" style={motionStyle(`rotate(${Math.round(angle(value) * 100) / 100}deg)`, duration)}>
        <path d={`M ${CENTER - 5} ${CENTER + 30} L ${CENTER - 4} ${CENTER - 140} L ${CENTER} ${CENTER - 165} L ${CENTER + 4} ${CENTER - 140} L ${CENTER + 5} ${CENTER + 30} Z`} fill="#fff" />
      </g>
      <Hub />
    </InstrumentFrame>
  );
}
