import { CENTER, DEFAULT_ANIMATION_MS, clamp, finite, motionStyle, range, tickPath, useContinuousAngle, useSvgId } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export interface AttitudeIndicatorProps extends InstrumentProps {
  /** Bank angle in degrees. Positive = right wing down. */
  roll?: number;
  /** Pitch angle in degrees. Positive = nose up. Clamped to ±`pitchLimit`. */
  pitch?: number;
  /** Maximum displayed pitch in degrees. Default `40`. */
  pitchLimit?: number;
}

const PX_PER_DEG = 4;
const FACE_R = 180;
const ROLL_MARKS: Array<[number, number]> = [
  [10, 12],
  [20, 12],
  [30, 22],
  [45, 12],
  [60, 22],
];

export function AttitudeIndicator({ roll = 0, pitch = 0, pitchLimit = 40, ...props }: AttitudeIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const limit = Math.abs(finite(pitchLimit, 40));
  const safeRoll = finite(roll);
  const safePitch = clamp(finite(pitch), -limit, limit);
  const displayRoll = useContinuousAngle(safeRoll);
  const clipId = useSvgId('fi-ai-clip');

  const ladder = range(-90, 90, 5).filter((d) => d !== 0);

  return (
    <InstrumentFrame
      {...props}
      label={`Attitude indicator: pitch ${Math.round(safePitch)}°, roll ${Math.round(safeRoll)}°`}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={CENTER} cy={CENTER} r={FACE_R} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* Horizon ball: rotates with roll, translates with pitch (in the rotated frame). */}
        <g
          data-testid="attitude-horizon"
          style={motionStyle(`rotate(${-displayRoll}deg) translate(0px, ${safePitch * PX_PER_DEG}px)`, duration)}
        >
          <rect x={-400} y={-600} width={1200} height={800} fill="#3b8fd6" />
          <rect x={-400} y={CENTER} width={1200} height={800} fill="#8a5a2b" />
          <line x1={-400} y1={CENTER} x2={800} y2={CENTER} stroke="#fff" strokeWidth="3" />
          {ladder.map((d) => {
            const y = CENTER - d * PX_PER_DEG;
            const major = d % 10 === 0;
            const half = major ? 50 : 22;
            return (
              <g key={d}>
                <line x1={CENTER - half} y1={y} x2={CENTER + half} y2={y} stroke="#fff" strokeWidth={major ? 3 : 2} />
                {major && (
                  <>
                    <text x={CENTER - half - 8} y={y + 6} fill="#fff" fontSize="17" fontWeight="bold" textAnchor="end">
                      {Math.abs(d)}
                    </text>
                    <text x={CENTER + half + 8} y={y + 6} fill="#fff" fontSize="17" fontWeight="bold">
                      {Math.abs(d)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Bank scale fixed to the case. */}
        <g stroke="#fff" strokeWidth="4" strokeLinecap="round">
          {ROLL_MARKS.flatMap(([deg, len]) => [
            <path key={`l${deg}`} d={tickPath(FACE_R - 2, FACE_R - 2 - len, -deg)} />,
            <path key={`r${deg}`} d={tickPath(FACE_R - 2, FACE_R - 2 - len, deg)} />,
          ])}
        </g>
        <path d={`M ${CENTER} ${CENTER - 158} l -10 -18 h 20 z`} fill="#fff" />

        {/* Sky pointer: rolls with the horizon. */}
        <g data-testid="attitude-roll-pointer" style={motionStyle(`rotate(${-displayRoll}deg)`, duration)}>
          <path d={`M ${CENTER} ${CENTER - 156} l -10 18 h 20 z`} fill="#ffb000" />
        </g>
      </g>

      {/* Fixed miniature aircraft. */}
      <g fill="none" stroke="#ffb000" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${CENTER - 110} ${CENTER} H ${CENTER - 40} l 14 16`} />
        <path d={`M ${CENTER + 110} ${CENTER} H ${CENTER + 40} l -14 16`} />
      </g>
      <circle cx={CENTER} cy={CENTER} r="6" fill="#ffb000" />
    </InstrumentFrame>
  );
}
