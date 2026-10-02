import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  Airspeed,
  Altimeter,
  AttitudeIndicator,
  HeadingIndicator,
  TurnCoordinator,
  VerticalSpeed,
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
