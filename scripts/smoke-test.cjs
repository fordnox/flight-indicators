// Installs-as-a-consumer check: run from a directory where the packed
// tarball has been installed alongside react and react-dom.
const assert = require('node:assert');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const FI = require('flight-indicators');

const expected = ['AdfIndicator', 'Airspeed', 'Altimeter', 'AnnunciatorPanel', 'AoaIndicator', 'AttitudeIndicator', 'DataPanel', 'DigitalClock', 'DualGauge', 'EgtFuelFlowGauge', 'EngineIndicator', 'FlapIndicator', 'FuelIndicator', 'FuelQuantityGauge', 'HeadingIndicator', 'HobbsMeter', 'HsiIndicator', 'IlsIndicator', 'MagneticCompass', 'ManifoldFuelFlowGauge', 'OilGauge', 'RadioPanel', 'RadioStack', 'Tachometer', 'TrimIndicator', 'TurnCoordinator', 'VacuumAmmeterGauge', 'VerticalSpeed', 'VorIndicator', 'WindIndicator'];
// Interactive controls (an HTML group, or an svg group with buttons); everything else is an SVG instrument.
const controls = ['RadioStack', 'DigitalClock'];
// Components are the PascalCase exports; helpers and constants are filtered out.
const components = (keys) => keys.filter((k) => /^[A-Z][a-z]/.test(k)).sort();
assert.deepStrictEqual(components(Object.keys(FI)), expected);

for (const name of expected) {
  const html = renderToStaticMarkup(createElement(FI[name]));
  if (controls.includes(name)) assert.match(html, /role="group"/, `${name} did not render a control group`);
  else assert.match(html, /^<svg[^>]*role="img"/, `${name} did not render an svg`);
}

import('flight-indicators').then((esm) => {
  assert.deepStrictEqual(components(Object.keys(esm)), expected);
  console.log(`OK: ${expected.length} components render via require() and import()`);
});
