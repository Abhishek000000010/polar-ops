import { IAlertItem } from '../dashboard/service';

// ---------- Input: a scenario is a list of disruptions applied to a copy of today's world ----------

export interface TransportDelayInput {
  transportId: string; // id or name
  delayDays: number;
  fromStop?: number; // defaults to the first stop that has not departed yet
  reason?: string;
}

export interface WeatherInput {
  station: string;
  fuelBurnMultiplier: number; // 1.35 = 35% more heating fuel
  durationDays: number;
  label?: string;
}

export interface AssetFailureInput {
  assetId: string; // id or asset code
  outageDays: number;
  reason?: string;
}

export interface PersonUnavailableInput {
  personId: string; // id or exact name
  reason?: string;
}

export interface ExtraPeopleInput {
  station: string;
  count: number;
  durationDays: number;
  reason?: string;
}

export interface WhatIfScenarioInput {
  name?: string;
  transportDelays?: TransportDelayInput[];
  weather?: WeatherInput[];
  assetFailures?: AssetFailureInput[];
  personnelUnavailable?: PersonUnavailableInput[];
  extraPeople?: ExtraPeopleInput[];
}

export interface IScenarioPreset {
  id: string;
  name: string;
  tag: string;
  question: string; // the plain-language question the preset answers
  description: string;
  scenarioInput: WhatIfScenarioInput;
}

// ---------- Output ----------

export type HealthLevel = 'OK' | 'WATCH' | 'AT_RISK' | 'BLOCKED';

export interface AppliedDisruption {
  kind: 'TRANSPORT_DELAY' | 'WEATHER' | 'ASSET_FAILURE' | 'PERSON_UNAVAILABLE' | 'EXTRA_PEOPLE';
  label: string;
  detail: string;
  warnings: string[];
}

export interface MissionReason {
  key: string; // stable key so baseline and scenario reasons can be compared
  level: HealthLevel;
  text: string;
}

export interface MissionComparison {
  missionId: string;
  code: string;
  title: string;
  station: string;
  priority: number;
  startDate: string;
  endDate: string;
  baselineLevel: HealthLevel;
  scenarioLevel: HealthLevel;
  changed: boolean;
  newReasons: MissionReason[];
  worsenedReasons: Array<MissionReason & { before: string }>;
  resolvedReasons: MissionReason[];
  unchangedReasons: MissionReason[];
}

export interface FuelSeriesPoint {
  date: string;
  baseline: number;
  scenario: number;
}

export interface FuelComparison {
  station: string;
  itemName: string;
  unit: string;
  minimumLevel: number;
  stockNow: number;
  baseline: { burnRate: number; breachDate: string | null; resupplyDate: string | null; resupplyCrate: string | null; marginDays: number | null };
  scenario: { burnRate: number; peakBurnRate: number; breachDate: string | null; resupplyDate: string | null; resupplyCrate: string | null; marginDays: number | null };
  status: HealthLevel;
  series: FuelSeriesPoint[];
}

export interface OccupancyWindow {
  from: string;
  to: string;
  days: number;
  peak: number;
  peakDate: string;
}

export interface OccupancyComparison {
  station: string;
  beds: number;
  baselineWindow: OccupancyWindow | null;
  scenarioWindow: OccupancyWindow | null;
  series: Array<{ date: string; baseline: number; scenario: number }>;
}

export interface ImpactNode {
  kind: 'TRANSPORT' | 'CRATE' | 'PERSON' | 'MISSION' | 'INVENTORY' | 'ASSET' | 'STATION' | 'WEATHER' | 'SUMMARY';
  label: string;
  before?: string;
  after?: string;
  status: HealthLevel | 'INFO';
  note?: string;
  children: ImpactNode[];
}

export interface DecisionOption {
  title: string;
  effect: string;
  tradeOff: string;
  feasible: boolean;
}

export interface DecisionPoint {
  problem: string;
  detail?: string[];
  severity: HealthLevel;
  options: DecisionOption[];
}

export interface AlertComparison {
  newAlerts: IAlertItem[];
  resolvedAlerts: IAlertItem[];
  changedAlerts: Array<{ before: IAlertItem; after: IAlertItem }>;
  unchangedCount: number;
  baselineCount: number;
  scenarioCount: number;
}

export interface WhatIfScenarioResult {
  scenarioName: string;
  simulatedAt: string;
  verdict: { level: HealthLevel; headline: string; bullets: string[] };
  applied: AppliedDisruption[];
  scorecard: {
    missionsAtRisk: { baseline: number; scenario: number; newlyAffected: string[] };
    fuel: Array<{ station: string; baselineMargin: number | null; scenarioMargin: number | null }>;
    alerts: { baseline: number; scenario: number; added: number; resolved: number };
    beds: Array<{ station: string; baselineDays: number; scenarioDays: number }>;
  };
  impactTree: ImpactNode[];
  checked: { crates: number; people: number; missions: number; unaffectedMissions: string[] };
  missions: MissionComparison[];
  fuel: FuelComparison[];
  occupancy: OccupancyComparison[];
  alerts: AlertComparison;
  decisions: DecisionPoint[];
  assumptions: string[];
}
