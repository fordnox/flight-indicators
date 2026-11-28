export { AttitudeIndicator, type AttitudeIndicatorProps } from './components/AttitudeIndicator';
export { HeadingIndicator, type HeadingIndicatorProps } from './components/HeadingIndicator';
export { Airspeed, type AirspeedProps, type AirspeedArcs } from './components/Airspeed';
export { Altimeter, type AltimeterProps, type PressureUnit } from './components/Altimeter';
export { VerticalSpeed, type VerticalSpeedProps } from './components/VerticalSpeed';
export { TurnCoordinator, type TurnCoordinatorProps } from './components/TurnCoordinator';
export { WindIndicator, type WindIndicatorProps, type RunwaySide } from './components/WindIndicator';
export { VorIndicator, vorDeviation, type VorIndicatorProps, type ToFrom, type VorNeedle } from './components/VorIndicator';
export { IlsIndicator, type IlsIndicatorProps, type IlsNeedles } from './components/IlsIndicator';
export { HsiIndicator, type HsiIndicatorProps } from './components/HsiIndicator';
export { AdfIndicator, relativeBearing, type AdfIndicatorProps } from './components/AdfIndicator';
export { RadioPanel, formatNav, formatAdf, formatDme, type RadioPanelProps, type RadioFrequency } from './components/RadioPanel';
export { RadioStack, parseNav, parseAdf, type RadioStackProps } from './components/RadioStack';
export { DataPanel, formatValue, MAX_FIELDS, type DataPanelProps, type DataField } from './components/DataPanel';
export { FuelIndicator, MAX_TANKS, type FuelIndicatorProps, type FuelTank } from './components/FuelIndicator';
export {
  EngineIndicator,
  DEFAULT_MANIFOLD,
  DEFAULT_RPM,
  DEFAULT_BAR_GAUGES,
  MAX_CYLINDERS,
  MAX_BAR_GAUGES,
  type EngineIndicatorProps,
  type EngineGauge,
  type EngineBarGauge,
} from './components/EngineIndicator';
export { FlapIndicator, type FlapIndicatorProps, type FlapSpeedLimit } from './components/FlapIndicator';
export { AoaIndicator, type AoaIndicatorProps } from './components/AoaIndicator';
export {
  DigitalClock,
  formatTimer,
  HOLD_TIME,
  type DigitalClockProps,
  type ClockMode,
  type UpperDisplay,
  type ClockAlarm,
} from './components/DigitalClock';
export {
  DualGauge,
  FuelQuantityGauge,
  OilGauge,
  VacuumAmmeterGauge,
  EgtFuelFlowGauge,
  ManifoldFuelFlowGauge,
  FUEL_QUANTITY_SCALE,
  OIL_TEMPERATURE_SCALE,
  OIL_PRESSURE_SCALE,
  VACUUM_SCALE,
  AMMETER_SCALE,
  EGT_SCALE,
  FUEL_FLOW_SCALE,
  MANIFOLD_SCALE,
  type DualGaugeProps,
  type DualGaugeScale,
  type FuelQuantityGaugeProps,
  type OilGaugeProps,
  type VacuumAmmeterGaugeProps,
  type EgtFuelFlowGaugeProps,
  type ManifoldFuelFlowGaugeProps,
} from './components/DualGauge';
export { Tachometer, type TachometerProps } from './components/Tachometer';
export { MagneticCompass, type MagneticCompassProps } from './components/MagneticCompass';
export { TrimIndicator, type TrimIndicatorProps } from './components/TrimIndicator';
export { HobbsMeter, type HobbsMeterProps } from './components/HobbsMeter';
export { drumPositions } from './components/Odometer';
export {
  AnnunciatorPanel,
  DEFAULT_ANNUNCIATORS,
  type AnnunciatorPanelProps,
  type Annunciator,
  type AnnunciatorState,
} from './components/AnnunciatorPanel';
export type { InstrumentProps } from './components/Instrument';
