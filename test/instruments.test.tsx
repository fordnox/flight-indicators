import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  AdfIndicator,
  Airspeed,
  Altimeter,
  AoaIndicator,
  AttitudeIndicator,
  DataPanel,
  EngineIndicator,
  FlapIndicator,
  FuelIndicator,
  HeadingIndicator,
  IlsIndicator,
  RadioPanel,
  RadioStack,
  TurnCoordinator,
  VerticalSpeed,
  VorIndicator,
  WindIndicator,
  formatAdf,
  formatDme,
  formatNav,
  parseAdf,
  parseNav,
  relativeBearing,
  vorDeviation,
} from '../src';

const transformOf = (testId: string) => (screen.getByTestId(testId) as unknown as SVGElement).style.transform;

describe('rendering', () => {
  it.each([
    ['attitude', <AttitudeIndicator />],
    ['heading', <HeadingIndicator />],
    ['airspeed', <Airspeed />],
    ['altimeter', <Altimeter />],
    ['vsi', <VerticalSpeed />],
    ['turn', <TurnCoordinator />],
    ['wind', <WindIndicator />],
    ['vor', <VorIndicator />],
    ['ils', <IlsIndicator />],
    ['ils-swing', <IlsIndicator needles="swing" />],
    ['adf', <AdfIndicator />],
    ['radio', <RadioPanel />],
    ['data', <DataPanel />],
    ['fuel', <FuelIndicator />],
    ['engine', <EngineIndicator />],
    ['flap', <FlapIndicator />],
    ['aoa', <AoaIndicator />],
  ])('%s renders an accessible svg', (_, el) => {
    const { container } = render(el);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('width')).toBe('200');
  });

  it('server-renders without errors', () => {
    expect(() => renderToString(<AttitudeIndicator roll={10} pitch={5} />)).not.toThrow();
  });

  it('uses unique ids so several instruments can share a page', () => {
    const { container } = render(
      <>
        <AttitudeIndicator />
        <AttitudeIndicator />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it('respects size, showBox and className', () => {
    const { container } = render(<Airspeed size="100%" showBox={false} className="x" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.getAttribute('class')).toBe('x');
    expect(container.querySelectorAll('rect[rx="36"]')).toHaveLength(0);
  });

  it('disables the transition when animationDuration is 0', () => {
    render(<Airspeed speed={100} animationDuration={0} />);
    expect((screen.getByTestId('airspeed-needle') as unknown as SVGElement).style.transition).toBe('');
  });
});

describe('AttitudeIndicator', () => {
  it('rotates the horizon opposite to roll and moves it down for nose-up pitch', () => {
    render(<AttitudeIndicator roll={20} pitch={10} />);
    expect(transformOf('attitude-horizon')).toBe('rotate(-20deg) translate(0px, 40px)');
    expect(transformOf('attitude-roll-pointer')).toBe('rotate(-20deg)');
  });

  it('clamps pitch and survives NaN', () => {
    const { rerender } = render(<AttitudeIndicator pitch={90} />);
    expect(transformOf('attitude-horizon')).toContain('translate(0px, 160px)');
    rerender(<AttitudeIndicator pitch={NaN} roll={NaN} />);
    expect(transformOf('attitude-horizon')).toBe('rotate(0deg) translate(0px, 0px)');
  });
});

describe('HeadingIndicator', () => {
  it('rotates the card by -heading', () => {
    render(<HeadingIndicator heading={90} />);
    expect(transformOf('heading-card')).toBe('rotate(-90deg)');
  });

  it('takes the shortest path across north instead of spinning around', () => {
    const { rerender } = render(<HeadingIndicator heading={350} />);
    rerender(<HeadingIndicator heading={10} />);
    expect(transformOf('heading-card')).toBe('rotate(-370deg)');
    rerender(<HeadingIndicator heading={340} />);
    expect(transformOf('heading-card')).toBe('rotate(-340deg)');
  });

  it('normalises the accessible label', () => {
    const { container } = render(<HeadingIndicator heading={-5} />);
    expect(container.querySelector('title')!.textContent).toBe('Heading indicator: 355°');
  });
});

describe('Airspeed', () => {
  it('maps speed linearly and clamps to the scale', () => {
    const { rerender } = render(<Airspeed speed={100} max={200} />);
    expect(transformOf('airspeed-needle')).toBe('rotate(160deg)');
    rerender(<Airspeed speed={-20} />);
    expect(transformOf('airspeed-needle')).toBe('rotate(0deg)');
    rerender(<Airspeed speed={999} />);
    expect(transformOf('airspeed-needle')).toBe('rotate(320deg)');
  });
});

describe('Altimeter', () => {
  it('drives all three hands', () => {
    render(<Altimeter altitude={12500} />);
    expect(transformOf('altimeter-100')).toBe('rotate(4500deg)');
    expect(transformOf('altimeter-1000')).toBe('rotate(450deg)');
    expect(transformOf('altimeter-10000')).toBe('rotate(45deg)');
  });

  it('handles negative altitude', () => {
    render(<Altimeter altitude={-250} />);
    expect(transformOf('altimeter-100')).toBe('rotate(-90deg)');
  });

  it('formats pressure per unit', () => {
    const { rerender } = render(<Altimeter />);
    expect(screen.getByTestId('altimeter-pressure').textContent).toBe('1013');
    rerender(<Altimeter pressureUnit="inHg" />);
    expect(screen.getByTestId('altimeter-pressure').textContent).toBe('29.92');
    rerender(<Altimeter pressure={30.1} pressureUnit="inHg" />);
    expect(screen.getByTestId('altimeter-pressure').textContent).toBe('30.10');
  });
});

describe('VerticalSpeed', () => {
  it('puts zero at 9 o\'clock and climbs clockwise', () => {
    const { rerender } = render(<VerticalSpeed verticalSpeed={0} />);
    expect(transformOf('vsi-needle')).toBe('rotate(-90deg)');
    rerender(<VerticalSpeed verticalSpeed={1000} />);
    expect(transformOf('vsi-needle')).toBe('rotate(-5deg)');
    rerender(<VerticalSpeed verticalSpeed={-5000} />);
    expect(transformOf('vsi-needle')).toBe('rotate(-260deg)');
  });
});

describe('TurnCoordinator', () => {
  it('banks the symbol to the standard-rate mark at 3°/s and moves the ball', () => {
    render(<TurnCoordinator turnRate={3} slip={1} />);
    expect(transformOf('turn-aircraft')).toBe('rotate(20deg)');
    expect(transformOf('turn-ball')).toBe('rotate(-13deg)');
  });

  it('clamps extreme input', () => {
    render(<TurnCoordinator turnRate={-30} slip={-5} />);
    expect(transformOf('turn-aircraft')).toBe('rotate(-35deg)');
    expect(transformOf('turn-ball')).toBe('rotate(13deg)');
  });
});

describe('WindIndicator', () => {
  const text = (id: string) => screen.getByTestId(id).textContent;

  it('rotates the runway and wind arrow and picks the end facing into the wind', () => {
    render(<WindIndicator runway={90} windDirection={134} windSpeed={3} />);
    expect(transformOf('wind-runway')).toBe('rotate(90deg)');
    expect(transformOf('wind-arrow')).toBe('rotate(134deg)');
    expect(text('wind-readout')).toBe('134° 3KT');
    expect(text('wind-components')).toBe('HW 2XW 2R');
    expect(document.querySelector('title')!.textContent).toContain('runway 09 in use');
  });

  it('switches to the reciprocal runway and mirrors the parallel-runway letter', () => {
    const { container } = render(<WindIndicator runway={90} runwaySide="L" windDirection={250} windSpeed={20} windGust={28} />);
    expect(container.querySelector('title')!.textContent).toContain('runway 27R in use');
    expect(text('wind-readout')).toBe('250° 20G28KT');
    expect(text('wind-components')).toBe('HW 19XW 7L');
  });

  it('flags crosswind over the limit and handles calm / NaN', () => {
    const { rerender } = render(<WindIndicator runway={360} windDirection={90} windSpeed={20} />);
    expect(screen.getByTestId('wind-components').lastElementChild!.getAttribute('fill')).toBe('#ffb000');
    rerender(<WindIndicator runway={NaN} windDirection={NaN} windSpeed={0.4} />);
    expect(text('wind-readout')).toBe('CALM');
    expect((screen.getByTestId('wind-arrow') as unknown as SVGElement).style.opacity).toBe('0');
  });
});

describe('VorIndicator', () => {
  const opacityOf = (id: string) => screen.getByTestId(id).getAttribute('opacity');

  it('computes deviation and TO/FROM from course and radial', () => {
    expect(vorDeviation(360, 5)).toEqual({ deviation: -5, toFrom: 'FROM' });
    expect(vorDeviation(360, 175)).toEqual({ deviation: -5, toFrom: 'TO' });
    expect(vorDeviation(90, 270)).toEqual({ deviation: 0, toFrom: 'TO' });
    expect(vorDeviation(90, 100)).toEqual({ deviation: -10, toFrom: 'FROM' });
    expect(vorDeviation(90, 350)).toEqual({ deviation: 80, toFrom: 'TO' });
    expect(vorDeviation(90, 10)).toEqual({ deviation: 80, toFrom: 'FROM' });
  });

  it('turns the card by -course and moves the needle 22px per dot', () => {
    render(<VorIndicator course={90} radial={266} />);
    expect(transformOf('vor-card')).toBe('rotate(-90deg)');
    expect(transformOf('vor-needle')).toBe('translate(-44px, 0px)');
    expect(opacityOf('vor-to')).toBe('1');
    expect(opacityOf('vor-from')).toBe('0');
    expect(screen.getByTestId('vor-course').textContent).toBe('CRS 090');
    expect(document.querySelector('title')!.textContent).toBe('VOR indicator: course 090°, needle 4.0° left, TO');
  });

  it('lets explicit deviation and toFrom override the computed values and clamps to full scale', () => {
    render(<VorIndicator course={0} radial={0} deviation={25} toFrom="FROM" />);
    expect(transformOf('vor-needle')).toBe('translate(110px, 0px)');
    expect(opacityOf('vor-from')).toBe('1');
    expect(opacityOf('vor-to')).toBe('0');
  });

  it('shows the NAV flag and centres the needle without a signal, and survives NaN', () => {
    const { rerender } = render(<VorIndicator course={45} radial={45} signal={false} />);
    expect(opacityOf('vor-nav-flag')).toBe('1');
    expect(opacityOf('vor-from')).toBe('0');
    expect(transformOf('vor-needle')).toBe('translate(0px, 0px)');
    expect(document.querySelector('title')!.textContent).toBe('VOR indicator: course 045°, no signal');
    rerender(<VorIndicator course={NaN} radial={NaN} deviation={NaN} />);
    expect(opacityOf('vor-nav-flag')).toBe('0');
    expect(transformOf('vor-card')).toBe('rotate(0deg)');
    expect(screen.getByTestId('vor-course').textContent).toBe('CRS 360');
  });

  it('swings the needle from a hinge under the top index when needle="swing"', () => {
    const { rerender } = render(<VorIndicator course={90} radial={266} needle="swing" />);
    // 4° left = 2 dots left; the lower end swings left, i.e. clockwise about the hinge.
    expect(transformOf('vor-needle')).toBe('rotate(15deg)');
    expect((screen.getByTestId('vor-needle') as unknown as SVGElement).style.transformOrigin).toBe('200px 100px');
    expect(opacityOf('vor-to')).toBe('1');
    expect(document.querySelector('title')!.textContent).toBe('VOR indicator: course 090°, needle 4.0° left, TO');
    rerender(<VorIndicator deviation={25} toFrom="FROM" needle="swing" />);
    expect(transformOf('vor-needle')).toBe('rotate(-37.5deg)');
    expect(opacityOf('vor-from')).toBe('1');
    rerender(<VorIndicator deviation={5} needle="swing" signal={false} />);
    expect(transformOf('vor-needle')).toBe('rotate(0deg)');
    expect(opacityOf('vor-nav-flag')).toBe('1');
  });
});

describe('AdfIndicator', () => {
  const title = () => document.querySelector('title')!.textContent;

  it('works out the relative bearing from heading and bearing to the station', () => {
    expect(relativeBearing(90, 135)).toBe(45);
    expect(relativeBearing(350, 10)).toBe(20);
    expect(relativeBearing(10, 350)).toBe(340);
    expect(relativeBearing(NaN, NaN)).toBe(0);
  });

  it('points the needle at the relative bearing over a fixed card', () => {
    render(<AdfIndicator bearing={45} />);
    expect(transformOf('adf-needle')).toBe('rotate(45deg)');
    expect(transformOf('adf-card')).toBe('rotate(0deg)');
    expect(title()).toBe('ADF indicator: station 045° relative, bearing 045° to station');
  });

  it('turns the card to the heading so the needle reads the bearing to the station', () => {
    render(<AdfIndicator bearing={300} heading={90} />);
    expect(transformOf('adf-card')).toBe('rotate(-90deg)');
    expect(transformOf('adf-needle')).toBe('rotate(300deg)');
    expect(title()).toBe('ADF indicator: station 300° relative, bearing 030° to station');
  });

  it('takes the shortest way round, parks the needle without a signal and survives NaN', () => {
    const { rerender } = render(<AdfIndicator bearing={350} />);
    rerender(<AdfIndicator bearing={10} />);
    expect(transformOf('adf-needle')).toBe('rotate(370deg)');
    rerender(<AdfIndicator bearing={10} signal={false} />);
    expect(screen.getByTestId('adf-flag').getAttribute('opacity')).toBe('1');
    expect(title()).toBe('ADF indicator: no signal');
    rerender(<AdfIndicator bearing={NaN} heading={NaN} />);
    expect(screen.getByTestId('adf-flag').getAttribute('opacity')).toBe('0');
    expect(title()).toBe('ADF indicator: station 000° relative, bearing 000° to station');
  });
});

describe('RadioPanel', () => {
  const text = (id: string) => screen.getByTestId(id).textContent;

  it('formats frequencies and distance', () => {
    expect(formatNav(116.8)).toBe('116.80');
    expect(formatNav()).toBe('---.--');
    expect(formatAdf(250)).toBe('250');
    expect(formatAdf(362.5)).toBe('362.5');
    expect(formatAdf(NaN)).toBe('---');
    expect(formatDme(12.34)).toBe('12.3');
    expect(formatDme(99.96)).toBe('100');
    expect(formatDme(-1)).toBe('--.-');
  });

  it('shows active and standby frequencies and the DME distance', () => {
    render(<RadioPanel nav={{ active: 116.8, standby: 110.5 }} adf={{ active: 250 }} dme={8.42} />);
    expect(text('radio-nav-active')).toBe('116.80');
    expect(text('radio-nav-standby')).toBe('110.50');
    expect(text('radio-adf-active')).toBe('250');
    expect(text('radio-adf-standby')).toBe('---');
    expect(text('radio-dme')).toBe('8.4');
    expect(document.querySelector('title')!.textContent).toBe('Radio panel: NAV 116.80 MHz, ADF 250 kHz, DME 8.4 NM');
  });

  it('shows dashes when nothing is tuned', () => {
    render(<RadioPanel />);
    expect(text('radio-nav-active')).toBe('---.--');
    expect(text('radio-dme')).toBe('--.-');
    expect(document.querySelector('title')!.textContent).toBe('Radio panel: NAV not tuned, ADF not tuned, DME no distance');
  });
});

describe('RadioStack', () => {
  const text = (id: string) => screen.getByTestId(id).textContent;
  const standby = (key: string) => screen.getByTestId(`radio-stack-${key}-standby`) as HTMLInputElement;
  const type = (key: string, value: string) => {
    fireEvent.focus(standby(key));
    fireEvent.change(standby(key), { target: { value } });
  };

  it('parses only frequencies the receivers can tune', () => {
    expect(parseNav('113.4')).toBe(113.4);
    expect(parseNav('113,85')).toBe(113.85);
    expect(parseNav('345')).toBeUndefined();
    expect(parseNav('abc')).toBeUndefined();
    expect(parseAdf('345')).toBe(345);
    expect(parseAdf('362.5')).toBe(362.5);
    expect(parseAdf('113.4')).toBeUndefined();
  });

  it('is an HTML group, not an svg, showing frequencies, idents and DME', () => {
    const { container } = render(<RadioStack nav={{ active: 116.8, standby: 110.5 }} adf={{ active: 250 }} navIdent="KLO" dme={8.42} />);
    expect(container.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Radio panel');
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    expect(text('radio-stack-nav-active')).toBe('116.80');
    expect(standby('nav').value).toBe('110.50');
    expect(text('radio-stack-adf-active')).toBe('250');
    expect(standby('adf').value).toBe('');
    expect(text('radio-stack-nav-ident')).toBe('KLO');
    expect(text('radio-stack-dme')).toBe('8.4');
  });

  it('reports a typed standby frequency on blur and swaps with the button', () => {
    const onNavChange = vi.fn();
    render(<RadioStack nav={{ active: 116.8 }} onNavChange={onNavChange} />);
    type('nav', '113.4');
    fireEvent.blur(standby('nav'));
    expect(onNavChange).toHaveBeenLastCalledWith({ active: 116.8, standby: 113.4 });
    fireEvent.click(screen.getByLabelText('Swap NAV active and standby'));
    // Controlled: the parent did not apply the standby, so the swap moves the active frequency down.
    expect(onNavChange).toHaveBeenLastCalledWith({ active: undefined, standby: 116.8 });
  });

  it('keeps its own state when uncontrolled: Enter tunes the typed frequency', () => {
    const onAdfChange = vi.fn();
    render(<RadioStack defaultAdf={{ active: 250 }} onAdfChange={onAdfChange} />);
    type('adf', '345');
    fireEvent.keyDown(standby('adf'), { key: 'Enter' });
    expect(onAdfChange).toHaveBeenLastCalledWith({ active: 345, standby: 250 });
    expect(text('radio-stack-adf-active')).toBe('345');
    expect(standby('adf').value).toBe('250');
  });

  it('rejects text that is not a frequency', () => {
    const onNavChange = vi.fn();
    render(<RadioStack defaultNav={{ active: 116.8, standby: 110.5 }} onNavChange={onNavChange} />);
    type('nav', '999');
    fireEvent.keyDown(standby('nav'), { key: 'Enter' });
    expect(standby('nav').getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(standby('nav'));
    expect(onNavChange).not.toHaveBeenCalled();
    expect(standby('nav').value).toBe('110.50');
    expect(text('radio-stack-nav-active')).toBe('116.80');
  });
});

describe('DataPanel', () => {
  const value = (i: number) => screen.getByTestId(`data-value-${i}`).textContent;

  it('formats numbers, strings and NaN and lays out the fields in a grid', () => {
    const { container } = render(
      <DataPanel
        heading="Radios"
        fields={[
          { name: 'OAT', value: 14.6, unit: '°C' },
          { name: 'VLOC', value: 110.5, unit: 'MHz', decimals: 2 },
          { name: 'COM', value: '118.700', unit: 'MHz' },
          { name: 'SQK', value: NaN, color: '#ffb000' },
        ]}
      />,
    );
    expect(value(0)).toBe('15');
    expect(value(1)).toBe('110.50');
    expect(value(2)).toBe('118.700');
    expect(value(3)).toBe('---');
    expect(screen.getByTestId('data-value-3').getAttribute('fill')).toBe('#ffb000');
    expect(container.querySelector('title')!.textContent).toBe('Radios: OAT 15 °C, VLOC 110.50 MHz, COM 118.700 MHz, SQK ---');
    // 4 fields → 2 columns: fields 0 and 1 share a row, 0 and 2 share a column.
    const rect = (i: number) => screen.getByTestId(`data-field-${i}`).querySelector('rect')!;
    expect(rect(0).getAttribute('y')).toBe(rect(1).getAttribute('y'));
    expect(rect(0).getAttribute('x')).toBe(rect(2).getAttribute('x'));
  });

  it('draws at most six fields and copes with none', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `F${i}`, value: i }));
    const { rerender } = render(<DataPanel fields={many} />);
    expect(screen.getAllByTestId(/^data-field-/)).toHaveLength(6);
    rerender(<DataPanel />);
    expect(screen.queryAllByTestId(/^data-field-/)).toHaveLength(0);
    expect(document.querySelector('title')!.textContent).toBe('Data panel: no data');
  });
});

describe('FuelIndicator', () => {
  const value = (i: number) => screen.getByTestId(`fuel-value-${i}`);

  it('scales each bar by its fraction, shows FULL at capacity and flags a low tank', () => {
    const { container } = render(
      <FuelIndicator capacity={100} tanks={[{ name: 'Left', quantity: 88.7 }, { name: 'Right', quantity: 100 }, { name: 'Aux', quantity: 4, capacity: 20 }]} />,
    );
    expect(transformOf('fuel-bar-0')).toBe('scaleY(0.887)');
    expect(transformOf('fuel-bar-1')).toBe('scaleY(1)');
    expect(transformOf('fuel-bar-2')).toBe('scaleY(0.2)');
    expect(value(0).textContent).toBe('88.7');
    expect(value(1).textContent).toBe('FULL');
    expect(value(2).textContent).toBe('4.0');
    expect(value(0).getAttribute('fill')).toBe('#fff');
    expect(container.querySelector('title')!.textContent).toBe('FUEL: Left 88.7 of 100.0 gal, Right full, Aux 4.0 of 20.0 gal');
    expect(screen.getAllByTestId(/^fuel-tank-/)).toHaveLength(3);
  });

  it('turns red at the low threshold, clamps and survives NaN', () => {
    const { rerender } = render(<FuelIndicator capacity={50} low={8} unit="L" decimals={0} tanks={[{ name: 'L', quantity: 8 }, { name: 'R', quantity: 80 }]} />);
    expect(value(0).getAttribute('fill')).toBe('#ff3b3b');
    expect(value(0).textContent).toBe('8');
    expect(transformOf('fuel-bar-1')).toBe('scaleY(1)');
    expect(document.querySelector('title')!.textContent).toContain('L 8 of 50 L (low)');
    rerender(<FuelIndicator tanks={[{ name: 'L', quantity: NaN }]} />);
    expect(transformOf('fuel-bar-0')).toBe('scaleY(0)');
    expect(value(0).textContent).toBe('0.0');
  });
});

describe('EngineIndicator', () => {
  const text = (id: string) => screen.getByTestId(id).textContent;

  it('drives the arcs, bars, cylinders and bottom readouts from the reference values', () => {
    const { container } = render(
      <EngineIndicator
        power={75}
        manifold={{ value: 27.4 }}
        rpm={{ value: 2400 }}
        cht={[360, 370, 385, 365, 380, 350]}
        egt={[1350, 1300, 1385, 1320, 1340, 1360]}
        tit={1438}
        gauges={[
          { label: 'Oil P', value: 50, min: 0, max: 100, unit: 'PSI' },
          { label: 'Oil T', value: 202, min: 0, max: 250, unit: '°F' },
          { label: 'Fuel P', value: 15.9, min: 0, max: 30, unit: 'PSI', decimals: 1 },
          { label: 'Fuel F', value: 15.5, min: 0, max: 30, unit: 'GPH', decimals: 1 },
        ]}
        amps={10}
        volts={28.1}
        fuelLeft={26}
        fuelRight={31}
        fuelCapacity={40}
      />,
    );
    // MAN: (27.4 - 10) / 25 of a 200° sweep starting at -100°.
    expect(transformOf('engine-man')).toBe('rotate(39.2deg)');
    expect(transformOf('engine-rpm')).toBe('rotate(60deg)');
    expect(text('engine-cht')).toBe('385');
    expect(text('engine-egt')).toBe('1385');
    expect(text('engine-tit')).toBe('1438');
    expect(transformOf('engine-cht-2')).toBe('scaleY(0.77)');
    expect(transformOf('engine-egt-0')).toBe(`scaleY(${1350 / 1700})`);
    expect(transformOf('engine-bar-0')).toBe('translate(43px, 0px)');
    expect(transformOf('engine-fuel-left')).toBe('scaleY(0.65)');
    expect(text('engine-fuel')).toBe('2631');
    expect(text('engine-amps')).toBe('10A');
    expect(text('engine-volts')).toBe('28.1V');
    expect(container.querySelector('title')!.textContent).toBe(
      'Engine: power 75%, MAN 27.4 IN, RPM 2400, CHT 385°F, EGT 1385°F, TIT 1438°F, Oil P 50 PSI, Oil T 202 °F, Fuel P 15.9 PSI, Fuel F 15.5 GPH, 10 A, fuel 26/31 GAL, 28.1 V',
    );
  });

  it('colours readouts by band and clamps to the scale', () => {
    render(<EngineIndicator manifold={{ value: 30 }} rpm={{ value: 9999 }} gauges={[{ label: 'Oil P', value: 5, min: 0, max: 100, low: 10 }]} />);
    const fills = [...document.querySelectorAll('text')].map((t) => [t.textContent, t.getAttribute('fill')]);
    expect(fills).toContainEqual(['30.0IN', '#ffd400']);
    expect(fills).toContainEqual(['3000', '#ff3030']);
    expect(fills).toContainEqual(['5', '#ff3030']);
    expect(transformOf('engine-rpm')).toBe('rotate(100deg)');
    expect(transformOf('engine-bar-0')).toBe('translate(4.3px, 0px)');
  });

  it('hides sections it has no data for and limits the cylinder count', () => {
    render(<EngineIndicator cht={Array.from({ length: 9 }, () => 300)} />);
    expect(screen.queryByTestId('engine-egt')).toBeNull();
    expect(screen.queryByTestId('engine-tit-bar')).toBeNull();
    expect(screen.getAllByTestId(/^engine-cht-\d/)).toHaveLength(6);
    expect(text('engine-amps')).toBe('---A');
    expect(document.querySelector('title')!.textContent).toBe('Engine: MAN 10.0 IN, RPM 0, CHT 300°F, Oil P 0 PSI, Oil T 0 °F, Fuel P 0.0 PSI, Fuel F 0.0 GPH');
  });
});

describe('FlapIndicator', () => {
  const lit = () => document.querySelectorAll('[data-lit="true"]').length;
  const LIMITS = [
    { flaps: 0, speed: 160 },
    { flaps: 10, speed: 110 },
    { flaps: 20, speed: 96 },
  ];

  it('lights segments from the top, moves the pointer and shows the limit for the current setting', () => {
    const { container } = render(<FlapIndicator flaps={20} speedLimits={LIMITS} />);
    expect(lit()).toBe(10);
    expect(transformOf('flap-pointer')).toBe('translate(0px, 112px)');
    expect(screen.getByTestId('flap-speed').textContent).toBe('96KTS');
    expect(container.querySelector('title')!.textContent).toBe('WING FLAP: 20° of 40°, max 96 knots');
  });

  it('picks the highest reached limit and turns red when above it', () => {
    const { rerender } = render(<FlapIndicator flaps={15} speedLimits={LIMITS} airspeed={120} />);
    expect(screen.getByTestId('flap-speed').textContent).toBe('110KTS');
    expect(screen.getByTestId('flap-speed').parentElement!.getAttribute('fill')).toBe('#ff2a2a');
    rerender(<FlapIndicator flaps={15} speedLimits={LIMITS} airspeed={100} />);
    expect(screen.getByTestId('flap-speed').parentElement!.getAttribute('fill')).toBe('#fff');
  });

  it('clamps, hides the speed without limits and survives NaN', () => {
    const { rerender } = render(<FlapIndicator flaps={99} max={30} segments={10} />);
    expect(lit()).toBe(10);
    expect(screen.queryByTestId('flap-speed')).toBeNull();
    expect(document.querySelector('title')!.textContent).toBe('WING FLAP: 30° of 30°');
    rerender(<FlapIndicator flaps={NaN} />);
    expect(lit()).toBe(0);
    expect(transformOf('flap-pointer')).toBe('translate(0px, 0px)');
  });
});

describe('AoaIndicator', () => {
  const lit = () => document.querySelectorAll('[data-lit="true"]').length;

  it('lights green bars up to the donut at the optimum AoA', () => {
    const { container } = render(<AoaIndicator aoa={10} min={0} optimum={10} max={20} />);
    expect(lit()).toBe(5);
    expect(screen.getByTestId('aoa-row-4').getAttribute('data-lit')).toBe('true');
    expect(screen.getByTestId('aoa-row-5').getAttribute('data-lit')).toBe('false');
    expect(container.querySelector('title')!.textContent).toBe('AOA: 10.0° (optimum)');
  });

  it('spaces rows evenly below and above the optimum', () => {
    const { rerender } = render(<AoaIndicator aoa={4.9} optimum={10} />);
    expect(lit()).toBe(2);
    rerender(<AoaIndicator aoa={15} optimum={10} />);
    expect(lit()).toBe(8);
  });

  it('lights everything and flashes the chevrons at the critical AoA', () => {
    const { container } = render(<AoaIndicator aoa={25} max={20} showValue />);
    expect(lit()).toBe(11);
    expect(container.querySelectorAll('animate').length).toBe(4);
    expect(screen.getByTestId('aoa-value').textContent).toBe('25.0°');
    expect(container.querySelector('title')!.textContent).toBe('AOA: 25.0° (stall warning)');
  });

  it('shows nothing below min and survives NaN', () => {
    const { rerender } = render(<AoaIndicator aoa={-2} />);
    expect(lit()).toBe(0);
    rerender(<AoaIndicator aoa={NaN} showValue />);
    expect(lit()).toBe(0);
    expect(screen.getByTestId('aoa-value').textContent).toBe('---');
    expect(document.querySelectorAll('animate').length).toBe(0);
  });
});

describe('IlsIndicator', () => {
  const opacityOf = (id: string) => screen.getByTestId(id).getAttribute('opacity');
  const title = () => document.querySelector('title')!.textContent;

  it('slides both needles from course, radial and glideslope', () => {
    render(<IlsIndicator course={90} radial={266} glideslope={0.35} />);
    expect(transformOf('ils-card')).toBe('rotate(-90deg)');
    expect(transformOf('ils-loc-needle')).toBe('translate(-36px, 0px)');
    expect(transformOf('ils-gs-needle')).toBe('translate(0px, -45px)');
    expect(opacityOf('ils-to')).toBe('1');
    expect(opacityOf('ils-from')).toBe('0');
    expect(opacityOf('ils-nav-flag')).toBe('0');
    expect(opacityOf('ils-gs-flag')).toBe('0');
    expect(title()).toBe('ILS indicator: course 090°, course needle 4.0° left, glideslope 0.35° up, TO');
  });

  it('clamps to full scale and honours a localizer full scale', () => {
    const { rerender } = render(<IlsIndicator deviation={25} toFrom="FROM" glideslope={-3} />);
    expect(transformOf('ils-loc-needle')).toBe('translate(90px, 0px)');
    expect(transformOf('ils-gs-needle')).toBe('translate(0px, 90px)');
    expect(opacityOf('ils-from')).toBe('1');
    rerender(<IlsIndicator deviation={1.25} fullScale={2.5} glideslope={0.14} />);
    expect(transformOf('ils-loc-needle')).toBe('translate(45px, 0px)');
    expect(transformOf('ils-gs-needle')).toBe('translate(0px, -18px)');
  });

  it('drops the flags and centres the needles without a signal', () => {
    const { rerender } = render(<IlsIndicator course={45} radial={50} signal={false} />);
    expect(opacityOf('ils-nav-flag')).toBe('1');
    expect(opacityOf('ils-gs-flag')).toBe('1');
    expect(opacityOf('ils-to')).toBe('0');
    expect(opacityOf('ils-from')).toBe('0');
    expect(transformOf('ils-loc-needle')).toBe('translate(0px, 0px)');
    expect(transformOf('ils-gs-needle')).toBe('translate(0px, 0px)');
    expect(title()).toBe('ILS indicator: course 045°, no NAV signal, glideslope off');
    rerender(<IlsIndicator course={NaN} radial={NaN} deviation={NaN} glideslope={NaN} />);
    expect(opacityOf('ils-nav-flag')).toBe('0');
    expect(opacityOf('ils-gs-flag')).toBe('1');
    expect(transformOf('ils-card')).toBe('rotate(0deg)');
    rerender(<IlsIndicator glideslope={0.2} glideslopeSignal={false} />);
    expect(opacityOf('ils-gs-flag')).toBe('1');
  });

  it('swings hinged needles so they cross the scales at the matching dot', () => {
    const { rerender } = render(<IlsIndicator needles="swing" deviation={10} glideslope={0.7} />);
    const loc = screen.getByTestId('ils-loc-needle') as unknown as SVGElement;
    const gs = screen.getByTestId('ils-gs-needle') as unknown as SVGElement;
    // Full scale is 90 px from a hinge 108 px away: atan(90 / 108) = 39.81°.
    expect(loc.style.transform).toBe('rotate(39.81deg)');
    expect(loc.style.transformOrigin).toBe('200px 308px');
    expect(gs.style.transform).toBe('rotate(-39.81deg)');
    expect(gs.style.transformOrigin).toBe('92px 200px');
    rerender(<IlsIndicator needles="swing" />);
    expect(transformOf('ils-loc-needle')).toBe('rotate(0deg)');
    // No glideslope: the needle is parked above the scale, as on the real instrument.
    expect(transformOf('ils-gs-needle')).toBe('rotate(-48.01deg)');
    expect(opacityOf('ils-gs-flag')).toBe('1');
  });

  it('draws the OBS knob only with the mounting plate', () => {
    const { rerender } = render(<IlsIndicator />);
    expect(screen.queryByTestId('ils-obs')).toBeTruthy();
    rerender(<IlsIndicator showBox={false} />);
    expect(screen.queryByTestId('ils-obs')).toBeNull();
  });
});
