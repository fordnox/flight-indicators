// Installs-as-a-consumer check: run from a directory where the packed
// tarball has been installed alongside react and react-dom.
const assert = require('node:assert');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const FI = require('flight-indicators');

const expected = ['Airspeed', 'Altimeter', 'AttitudeIndicator', 'HeadingIndicator', 'TurnCoordinator', 'VerticalSpeed'];
assert.deepStrictEqual(Object.keys(FI).sort(), expected);

for (const name of expected) {
  const html = renderToStaticMarkup(createElement(FI[name]));
  assert.match(html, /^<svg[^>]*role="img"/, `${name} did not render an svg`);
}

import('flight-indicators').then((esm) => {
  assert.deepStrictEqual(Object.keys(esm).filter((k) => k !== 'default').sort(), expected);
  console.log(`OK: ${expected.length} components render via require() and import()`);
});
