# flight-indicators

Modern SVG flight instruments for React, with no runtime dependencies.

- Six instruments: **Attitude**, **Heading**, **Airspeed**, **Altimeter**, **Vertical speed** and **Turn coordinator**
- Pure SVG with no image files, so instruments stay sharp at any size and work with any bundler
- Written in TypeScript and ships its type declarations
- Ships ESM and CommonJS builds, works with server-side rendering, and is marked `"use client"` for the Next.js App Router
- Smooth CSS animation; the heading and roll take the shortest way round (359° → 1° moves 2°, not 358°)
- Bad input (`NaN`, `undefined`, out of range) is clamped instead of breaking the drawing
- Accessible: each instrument is an `role="img"` with a live text label (e.g. "Altimeter: 12340 feet, 29.92 inHg")

## Install

```bash
npm i flight-indicators
```

Requires React 18 or newer.

## Usage

```tsx
import {
  AttitudeIndicator,
  HeadingIndicator,
  Airspeed,
  Altimeter,
  VerticalSpeed,
  TurnCoordinator,
} from 'flight-indicators';

export function Panel({ data }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Airspeed speed={data.ias} />
      <AttitudeIndicator roll={data.roll} pitch={data.pitch} />
      <Altimeter altitude={data.altitude} pressure={1013} />
      <TurnCoordinator turnRate={data.turnRate} slip={data.slip} />
      <HeadingIndicator heading={data.heading} />
      <VerticalSpeed verticalSpeed={data.vs} />
    </div>
  );
}
```

## Common props

Every instrument accepts these props:

| Prop                | Type               | Default | Description                                               |
| ------------------- | ------------------ | ------- | --------------------------------------------------------- |
| `size`              | `number \| string` | `200`   | Width and height. A number means pixels; a string can be any CSS length, e.g. `"100%"`. |
| `showBox`           | `boolean`          | `true`  | Draw the square mounting plate with screws.               |
| `animationDuration` | `number`           | `300`   | Animation time in ms. `0` turns animation off.            |
| `className`         | `string`           |         | Class for the root `<svg>`.                               |
| `style`             | `CSSProperties`    |         | Inline style for the root `<svg>`.                        |
| `title`             | `string`           |         | Overrides the automatic accessible label.                 |

## Instruments

### `<AttitudeIndicator />`

| Prop         | Type     | Default | Description                                      |
| ------------ | -------- | ------- | ------------------------------------------------ |
| `roll`       | `number` | `0`     | Bank angle in degrees. Positive means right wing down. |
| `pitch`      | `number` | `0`     | Pitch angle in degrees. Positive means nose up.  |
| `pitchLimit` | `number` | `40`    | Largest pitch the display shows, in degrees.     |

### `<HeadingIndicator />`

| Prop      | Type     | Default | Description                                |
| --------- | -------- | ------- | ------------------------------------------ |
| `heading` | `number` | `0`     | Heading in degrees. Any value is accepted and wrapped to 0–359. |

### `<Airspeed />`

| Prop    | Type           | Default         | Description                                   |
| ------- | -------------- | --------------- | --------------------------------------------- |
| `speed` | `number`       | `0`             | Indicated airspeed. Clamped to `0…max`.       |
| `max`   | `number`       | `200`           | Top of the scale.                             |
| `arcs`  | `AirspeedArcs` | similar to a Cessna 172 | `{ white?: [min, max], green?: [min, max], yellow?: [min, max], red?: vne }`. Pass `{}` to hide all arcs. |
| `unit`  | `string`       | `"KNOTS"`       | Unit text printed on the dial.                |

### `<Altimeter />`

| Prop           | Type              | Default         | Description                                  |
| -------------- | ----------------- | --------------- | -------------------------------------------- |
| `altitude`     | `number`          | `0`             | Altitude in feet. Negative values work.      |
| `pressure`     | `number`          | `1013` / `29.92` | Altimeter setting shown in the pressure (Kollsman) window. |
| `pressureUnit` | `"hPa" \| "inHg"` | `"hPa"`         | Unit of `pressure`.                          |

### `<VerticalSpeed />`

| Prop            | Type     | Default | Description                                    |
| --------------- | -------- | ------- | ---------------------------------------------- |
| `verticalSpeed` | `number` | `0`     | Vertical speed in ft/min. Positive means climbing. |
| `max`           | `number` | `2000`  | Full-scale value in ft/min.                    |

### `<TurnCoordinator />`

| Prop       | Type     | Default | Description                                                         |
| ---------- | -------- | ------- | ------------------------------------------------------------------- |
| `turnRate` | `number` | `0`     | Rate of turn in °/s. Positive means a right turn. At 3 °/s (a standard-rate turn) the wings line up with the L/R marks. |
| `slip`     | `number` | `0`     | Position of the slip ball, from `-1` (full left) to `1` (full right). |

## Development

```bash
npm install
npm run dev        # interactive playground (Vite) at http://localhost:5173
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # outputs dist/ (ESM + CJS + .d.ts)
```

## Publishing

```bash
npm login
npm publish        # prepublishOnly runs typecheck, tests and build first
```

For later releases, run `npm version patch|minor|major` and then `npm publish`.

## License

MIT
