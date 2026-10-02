import { CENTER, DEFAULT_ANIMATION_MS, finite, motionStyle, polar, range, tickPath, useContinuousAngle } from '../utils';
import { InstrumentFrame, type InstrumentProps } from './Instrument';

export interface HeadingIndicatorProps extends InstrumentProps {
  /** Magnetic/true heading in degrees (any value; normalised to 0–359). */
  heading?: number;
}

const CARDINALS: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

export function HeadingIndicator({ heading = 0, ...props }: HeadingIndicatorProps) {
  const duration = props.animationDuration ?? DEFAULT_ANIMATION_MS;
  const safeHeading = finite(heading);
  const normalised = ((Math.round(safeHeading) % 360) + 360) % 360;
  const displayHeading = useContinuousAngle(safeHeading);

  return (
    <InstrumentFrame {...props} label={`Heading indicator: ${String(normalised).padStart(3, '0')}°`}>
      {/* Rotating compass card. */}
      <g data-testid="heading-card" style={motionStyle(`rotate(${-displayHeading}deg)`, duration)}>
        <g stroke="#fff" strokeLinecap="round">
          {range(0, 355, 5).map((a) => (
            <path key={a} d={tickPath(176, a % 10 === 0 ? 152 : 164, a)} strokeWidth={a % 10 === 0 ? 3 : 2} />
          ))}
        </g>
        {range(0, 330, 30).map((a) => {
          const [x, y] = polar(132, a);
          const label = CARDINALS[a] ?? String(a / 10);
          return (
            <text
              key={a}
              x={x}
              y={y}
              transform={`rotate(${a} ${x} ${y})`}
              fill={a % 90 === 0 ? '#ffb000' : '#fff'}
              fontSize={a % 90 === 0 ? 30 : 26}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          );
        })}
      </g>

      {/* Fixed 45° reference marks and lubber line. */}
      <g stroke="#ffb000" strokeWidth="4" strokeLinecap="round">
        {[45, 135, 225, 315].map((a) => (
          <path key={a} d={tickPath(192, 178, a)} />
        ))}
      </g>
      <path d={`M ${CENTER} ${CENTER - 150} l -9 -26 h 18 z`} fill="#ffb000" />

      {/* Fixed aircraft silhouette. */}
      <path
        d="M200 135 c6 0 8 8 8 16 v30 l52 18 v12 l-52 -8 v34 l18 12 v10 l-26 -6 l-26 6 v-10 l18 -12 v-34 l-52 8 v-12 l52 -18 v-30 c0 -8 2 -16 8 -16 z"
        fill="#ffb000"
        stroke="#000"
        strokeWidth="2"
      />
    </InstrumentFrame>
  );
}
