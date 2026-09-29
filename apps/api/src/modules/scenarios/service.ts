import { now } from '../../core/clock';
import { fetchWorldSnapshot, evaluateAlertsOverWorld, IWorldSnapshot, IAlertItem } from '../dashboard/service';
import {
  crateEta,
  getEffectiveArrival,
  getEffectiveDeparture,
  forecastInventory,
  cumulativeBurn,
  burnMultiplierOnDay,
  assetEffectiveStatus,
  stationOccupancy,
  IncomingResupply,
  InventoryForecastResult,
  BurnSegment,
  DailyOccupancy,
  STATION_BED_CAPACITIES
} from '../../rules';
import {
  WhatIfScenarioInput,
  WhatIfScenarioResult,
  IScenarioPreset,
  HealthLevel,
  AppliedDisruption,
  MissionReason,
  MissionComparison,
  FuelComparison,
  OccupancyComparison,
  OccupancyWindow,
  ImpactNode,
  DecisionPoint,
  DecisionOption,
  AlertComparison
} from './types';
import { SCENARIO_PRESETS } from './presets';

const DAY_MS = 86400000;
const HORIZON_DAYS = 60;
const WATCH_DAYS = 3;
const LEVEL_RANK: Record<HealthLevel, number> = { OK: 0, WATCH: 1, AT_RISK: 2, BLOCKED: 3 };
const STATIONS = ['BHARATI', 'MAITRI'];

export function getScenarioPresets(): IScenarioPreset[] {
  return SCENARIO_PRESETS;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const idOf = (doc: any): string => String(doc?._id ?? doc?.id ?? '');
const toMs = (iso: string | Date | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
/** Whole calendar days from a to b (UTC), so "arrives 04 Dec, needed 01 Dec" is always 3 days. */
export const calDays = (a: string | Date | null | undefined, b: string | Date | null | undefined) =>
  Math.floor(toMs(b) / DAY_MS) - Math.floor(toMs(a) / DAY_MS);
const maxLevel = (levels: HealthLevel[]): HealthLevel =>
  levels.reduce<HealthLevel>((m, l) => (LEVEL_RANK[l] > LEVEL_RANK[m] ? l : m), 'OK');
const worse = (a: HealthLevel, b: HealthLevel) => LEVEL_RANK[a] > LEVEL_RANK[b];

export function fmt(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

function dayWord(n: number): string {
  return `${n} day${Math.abs(n) === 1 ? '' : 's'}`;
}

const PLACE_NAMES: Record<string, string> = { GOA_HQ: 'Goa HQ', CAPE_TOWN: 'Cape Town', EN_ROUTE_VESSEL: 'the ship' };

function titleCase(station: string): string {
  return PLACE_NAMES[station] || station.charAt(0) + station.slice(1).toLowerCase().replace('_', ' ');
}

function num(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

function marginText(m: number | null): string {
  if (m === null) return 'no resupply planned';
  if (m < 0) return `short by ${dayWord(-m)}`;
  return `${dayWord(m)} spare`;
}

function marginLevel(m: number | null): HealthLevel {
  if (m === null) return 'OK';
  if (m < 0) return 'AT_RISK';
  if (m < WATCH_DAYS) return 'WATCH';
  return 'OK';
}

// ---------------------------------------------------------------------------
// Scenario context: what the disruptions change beyond plain document edits
// ---------------------------------------------------------------------------

export interface ScenarioContext {
  fuelBurn: Record<string, BurnSegment[]>;
  outages: Map<string, { until: Date; reason?: string }>;
  unavailable: Map<string, string>;
  delayedTransports: Map<string, { fromStop: number; days: number }>;
}

export const emptyContext = (): ScenarioContext => ({
  fuelBurn: {},
  outages: new Map(),
  unavailable: new Map(),
  delayedTransports: new Map()
});

// ---------------------------------------------------------------------------
// Analysis of one world (baseline or scenario)
// ---------------------------------------------------------------------------

export interface FuelState {
  item: any;
  forecast: InventoryForecastResult;
  series: number[];
}

export interface WorldAnalysis {
  world: IWorldSnapshot;
  transportsById: Record<string, any>;
  crateEta: Map<string, { eta: string | null; missed: boolean }>;
  fuel: Map<string, FuelState>;
  occupancy: Map<string, DailyOccupancy[]>;
  missions: Map<string, { level: HealthLevel; reasons: MissionReason[] }>;
  alerts: IAlertItem[];
}

export function analyseWorld(world: IWorldSnapshot, currentDate: Date, ctx: ScenarioContext): WorldAnalysis {
  const transportsById: Record<string, any> = {};
  for (const t of world.transports) transportsById[idOf(t)] = t;

  const crateEtaMap = new Map<string, { eta: string | null; missed: boolean }>();
  for (const c of world.crates) {
    const r = crateEta(c, transportsById, currentDate);
    crateEtaMap.set(idOf(c), { eta: r.etaDate, missed: r.missedConnection });
  }

  const resupplies: IncomingResupply[] = world.crates
    .filter(c => c.resupplies?.inventoryItemId && c.status !== 'RECEIVED_STATION')
    .map(c => ({
      crateCode: c.crateCode,
      inventoryItemId: c.resupplies.inventoryItemId,
      quantity: c.resupplies.quantity,
      etaDate: crateEtaMap.get(idOf(c))?.eta ?? null
    }));

  const fuel = new Map<string, FuelState>();
  for (const item of world.inventory.filter(i => i.category === 'FUEL')) {
    const profile = ctx.fuelBurn[item.station] ?? 1;
    const forecast = forecastInventory(item, world.transactions, resupplies, currentDate, profile);
    const resupplyMs = toMs(forecast.nextResupplyDate);
    const series: number[] = [];
    for (let d = 0; d <= HORIZON_DAYS; d++) {
      const dayMs = currentDate.getTime() + d * DAY_MS;
      let stock = forecast.projectedStockAtNow - cumulativeBurn(forecast.baseBurnRate, profile, d);
      if (!isNaN(resupplyMs) && dayMs >= resupplyMs) stock += forecast.resupplyQuantity || 0;
      series.push(Math.max(0, Math.round(stock)));
    }
    fuel.set(item.station, { item, forecast, series });
  }

  const horizonEnd = new Date(currentDate.getTime() + HORIZON_DAYS * DAY_MS);
  const occupancy = new Map<string, DailyOccupancy[]>();
  for (const st of STATIONS) {
    occupancy.set(st, stationOccupancy(world.people, transportsById, st, currentDate, horizonEnd));
  }

  const fuelBurnForAlerts: Record<string, BurnSegment[] | number> = {};
  for (const st of Object.keys(ctx.fuelBurn)) fuelBurnForAlerts[st] = ctx.fuelBurn[st];
  const alerts = evaluateAlertsOverWorld(world, currentDate, fuelBurnForAlerts);

  const analysis: WorldAnalysis = {
    world,
    transportsById,
    crateEta: crateEtaMap,
    fuel,
    occupancy,
    missions: new Map(),
    alerts
  };

  for (const m of world.missions) {
    if (m.status !== 'PLANNED' && m.status !== 'IN_PROGRESS') continue;
    const reasons = missionReasons(m, analysis, currentDate, ctx);
    analysis.missions.set(idOf(m), { level: maxLevel(reasons.map(r => r.level)), reasons });
  }

  return analysis;
}

export function personArrival(person: any, transportsById: Record<string, any>): string | null {
  if (!person?.inboundTransportId) return null;
  const t = transportsById[person.inboundTransportId];
  const stop = t?.schedule?.find((s: any) => s.stopNumber === person.inboundUnloadStop);
  return getEffectiveArrival(stop);
}

export function personDeparture(person: any, transportsById: Record<string, any>): string | null {
  if (!person?.outboundTransportId) return null;
  const t = transportsById[person.outboundTransportId];
  const stop = t?.schedule?.find((s: any) => s.stopNumber === person.outboundLoadStop);
  return getEffectiveDeparture(stop);
}

function consumersOf(world: IWorldSnapshot, inventoryId: string): any[] {
  const assetIds = new Set(
    world.edges
      .filter(e => e.relationType === 'CONSUMES' && e.targetId === inventoryId)
      .map(e => e.sourceId)
  );
  return world.assets.filter(a => assetIds.has(idOf(a)));
}

function missionReasons(m: any, a: WorldAnalysis, currentDate: Date, ctx: ScenarioContext): MissionReason[] {
  const reasons: MissionReason[] = [];
  const startMs = toMs(m.startDate);
  const endMs = toMs(m.endDate);
  const { world } = a;

  for (const cId of m.crateIds || []) {
    const crate = world.crates.find(c => idOf(c) === cId);
    if (!crate || crate.status === 'RECEIVED_STATION') continue;
    const info = a.crateEta.get(cId);
    const key = `crate:${crate.crateCode}`;
    if (info?.missed) {
      reasons.push({ key, level: 'BLOCKED', text: `${crate.crateCode} missed its connection — its carrier left without it. No confirmed delivery date.` });
      continue;
    }
    if (!info?.eta) continue;
    const slack = calDays(info.eta, crate.requiredByDate);
    if (slack < 0) {
      reasons.push({ key, level: 'AT_RISK', text: `${crate.crateCode} arrives ${fmt(info.eta)}, ${dayWord(-slack)} after it is needed (${fmt(crate.requiredByDate)}).` });
    } else if (slack < WATCH_DAYS) {
      reasons.push({ key, level: 'WATCH', text: slack === 0
        ? `${crate.crateCode} arrives ${fmt(info.eta)}, the day it is needed — no slack.`
        : `${crate.crateCode} arrives ${fmt(info.eta)}, only ${dayWord(slack)} before it is needed (${fmt(crate.requiredByDate)}).` });
    }
  }

  for (const pId of m.peopleIds || []) {
    const p = world.people.find(x => idOf(x) === pId);
    if (!p) continue;
    const unavailableReason = ctx.unavailable.get(pId);
    if (unavailableReason) {
      reasons.push({ key: `person:${pId}:available`, level: 'AT_RISK', text: `${p.name} (${p.role}) is unavailable — ${unavailableReason}.` });
      continue;
    }
    const missing: string[] = [];
    if (!p.readiness?.medicalCleared) missing.push('medical clearance');
    if (!p.readiness?.auliTrainingCompleted) missing.push('acclimatisation training');
    if (!p.readiness?.passportValid) missing.push('valid passport');
    if (!p.readiness?.polarPermitIssued) missing.push('polar permit');
    if (missing.length) {
      reasons.push({ key: `person:${pId}:ready`, level: 'AT_RISK', text: `${p.name} (${p.role}) is not cleared to deploy: missing ${missing.join(', ')}.` });
    }
    if (p.destinationLocation === m.station) {
      const arr = personArrival(p, a.transportsById);
      if (arr) {
        const lateDays = calDays(m.startDate, arr);
        if (lateDays > 0) {
          reasons.push({ key: `person:${pId}:arrival`, level: 'AT_RISK', text: `${p.name} (${p.role}) arrives ${fmt(arr)}, ${dayWord(lateDays)} after the mission starts (${fmt(m.startDate)}).` });
        } else if (lateDays === 0) {
          reasons.push({ key: `person:${pId}:arrival`, level: 'WATCH', text: `${p.name} (${p.role}) arrives ${fmt(arr)} — the day the mission starts, with no slack.` });
        }
      }
    }
    const dep = personDeparture(p, a.transportsById);
    if (dep && toMs(dep) < endMs && toMs(dep) > startMs - DAY_MS) {
      reasons.push({ key: `person:${pId}:departure`, level: 'AT_RISK', text: `${p.name} leaves ${titleCase(m.station)} on ${fmt(dep)}, before the mission ends (${fmt(m.endDate)}).` });
    }
  }

  for (const aId of m.assetIds || []) {
    const asset = world.assets.find(x => idOf(x) === aId);
    if (!asset) continue;
    const key = `asset:${asset.assetCode}`;
    const outage = ctx.outages.get(aId);
    const status = assetEffectiveStatus(asset, currentDate);
    if (outage) {
      const untilMs = outage.until.getTime();
      if (untilMs >= endMs) {
        reasons.push({ key, level: 'BLOCKED', text: `${asset.assetCode} is out of service until ${fmt(outage.until)} — for the whole mission.` });
      } else if (calDays(m.startDate, outage.until) > 0) {
        reasons.push({ key, level: 'AT_RISK', text: `${asset.assetCode} is out of service until ${fmt(outage.until)}, ${dayWord(calDays(m.startDate, outage.until))} into the mission.` });
      }
    } else if (status === 'UNDER_REPAIR') {
      reasons.push({ key, level: 'AT_RISK', text: `${asset.assetCode} is under repair with no return-to-service date.` });
    } else if (status === 'MAINTENANCE_DUE') {
      reasons.push({ key, level: 'WATCH', text: `${asset.assetCode} is overdue for service (was due ${fmt(asset.nextServiceDueDate)}).` });
    }

    for (const edge of world.edges.filter(e => e.relationType === 'CONSUMES' && e.sourceId === aId)) {
      const item = world.inventory.find(i => idOf(i) === edge.targetId);
      const f = item && a.fuel.get(item.station);
      if (!f || f.item !== item) continue;
      const { marginDays, minBreachDate, nextResupplyDate } = f.forecast;
      if (marginDays === null || !minBreachDate || toMs(minBreachDate) > endMs) continue;
      const fuelKey = `fuel:${item.station}`;
      if (reasons.some(r => r.key === fuelKey)) continue;
      if (marginDays < 0) {
        reasons.push({ key: fuelKey, level: 'AT_RISK', text: `${titleCase(item.station)} fuel drops below its safety minimum on ${fmt(minBreachDate)}, ${dayWord(-marginDays)} before resupply (${fmt(nextResupplyDate)}). ${asset.assetCode} runs on it.` });
      } else if (marginDays < WATCH_DAYS) {
        reasons.push({ key: fuelKey, level: 'WATCH', text: `${titleCase(item.station)} fuel resupply (${fmt(nextResupplyDate)}) lands only ${dayWord(marginDays)} before stock hits the safety minimum. ${asset.assetCode} runs on it.` });
      }
    }
  }

  if (m.helicopterNeeded) {
    const month = new Date(m.startDate).getUTCMonth() + 1;
    if (month >= 4 && month <= 10) {
      reasons.push({ key: 'heli', level: 'BLOCKED', text: `Needs helicopter support in ${new Date(m.startDate).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}, but helicopters leave Antarctica with the ship in March.` });
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Applying disruptions to the copied world
// ---------------------------------------------------------------------------

function findTransport(world: IWorldSnapshot, ref: string) {
  const r = ref.toLowerCase();
  return world.transports.find(t => idOf(t) === ref)
    || world.transports.find(t => t.name?.toLowerCase() === r)
    || world.transports.find(t => t.name?.toLowerCase().includes(r));
}

function findAsset(world: IWorldSnapshot, ref: string) {
  return world.assets.find(a => idOf(a) === ref || a.assetCode?.toLowerCase() === ref.toLowerCase());
}

function findPerson(world: IWorldSnapshot, ref: string) {
  return world.people.find(p => idOf(p) === ref || p.name?.toLowerCase() === ref.toLowerCase());
}

function shiftStops(transport: any, fromStop: number, days: number) {
  const shift = days * DAY_MS;
  for (const stop of transport.schedule) {
    if (stop.stopNumber < fromStop) continue;
    const arr = getEffectiveArrival(stop);
    const dep = getEffectiveDeparture(stop);
    if (arr) stop.estimatedArrival = new Date(toMs(arr) + shift).toISOString();
    if (dep) stop.estimatedDeparture = new Date(toMs(dep) + shift).toISOString();
  }
}

function applyDisruptions(world: IWorldSnapshot, input: WhatIfScenarioInput, currentDate: Date, baseline: WorldAnalysis) {
  const ctx = emptyContext();
  const applied: AppliedDisruption[] = [];
  const nowMs = currentDate.getTime();

  for (const d of input.transportDelays || []) {
    if (!d.delayDays) continue;
    const t = findTransport(world, d.transportId);
    if (!t?.schedule?.length) {
      applied.push({ kind: 'TRANSPORT_DELAY', label: `Delay: ${d.transportId}`, detail: 'Transport not found — ignored.', warnings: ['Transport not found'] });
      continue;
    }
    const warnings: string[] = [];
    const notDeparted = t.schedule.filter((s: any) => s.status !== 'DEPARTED' && toMs(getEffectiveDeparture(s)) >= nowMs);
    let fromStop = d.fromStop ?? notDeparted[0]?.stopNumber ?? t.schedule[0].stopNumber;
    const chosen = t.schedule.find((s: any) => s.stopNumber === fromStop);
    if (chosen && (chosen.status === 'DEPARTED' || toMs(getEffectiveDeparture(chosen)) < nowMs)) {
      const next = notDeparted.find((s: any) => s.stopNumber > fromStop);
      if (next) {
        warnings.push(`Stop ${fromStop} (${chosen.portOrStation}) has already departed; the delay starts at stop ${next.stopNumber} (${next.portOrStation}).`);
        fromStop = next.stopNumber;
      }
    }
    const before = t.schedule.map((s: any) => ({ n: s.stopNumber, name: s.portOrStation, arr: getEffectiveArrival(s) }));
    shiftStops(t, fromStop, d.delayDays);
    ctx.delayedTransports.set(idOf(t), { fromStop, days: d.delayDays });

    const embarked = world.transports.filter(x => x !== t && x.currentLocation?.toLowerCase().includes(t.name.toLowerCase()));
    for (const e of embarked) {
      const firstOpen = e.schedule?.find((s: any) => s.status !== 'DEPARTED' && toMs(getEffectiveDeparture(s)) >= nowMs);
      if (firstOpen) {
        shiftStops(e, firstOpen.stopNumber, d.delayDays);
        warnings.push(`${e.name} is carried aboard, so its operating windows also move ${dayWord(d.delayDays)}.`);
      }
    }

    const moved = before
      .filter((b: any) => b.n >= fromStop)
      .map((b: any) => {
        const s = t.schedule.find((x: any) => x.stopNumber === b.n);
        return `${b.name.split(' (')[0]} ${fmt(getEffectiveArrival(s))} (was ${fmt(b.arr)})`;
      });
    applied.push({
      kind: 'TRANSPORT_DELAY',
      label: `${t.name} delayed ${dayWord(d.delayDays)}`,
      detail: `${d.reason ? d.reason + '. ' : ''}New arrivals: ${moved.join('; ')}.`,
      warnings
    });
  }

  for (const w of input.weather || []) {
    if (!w.durationDays || !w.fuelBurnMultiplier || w.fuelBurnMultiplier === 1) continue;
    (ctx.fuelBurn[w.station] ||= []).push({ fromDay: 0, toDay: w.durationDays, multiplier: w.fuelBurnMultiplier });
    const pct = Math.round((w.fuelBurnMultiplier - 1) * 100);
    applied.push({
      kind: 'WEATHER',
      label: `${w.label || 'Severe weather'} at ${titleCase(w.station)} for ${dayWord(w.durationDays)}`,
      detail: `Fuel use at ${titleCase(w.station)} ${pct >= 0 ? '+' : ''}${pct}% from ${fmt(currentDate)} to ${fmt(new Date(nowMs + w.durationDays * DAY_MS))}. Other stations unchanged.`,
      warnings: []
    });
  }

  for (const f of input.assetFailures || []) {
    const asset = findAsset(world, f.assetId);
    if (!asset || !f.outageDays) {
      applied.push({ kind: 'ASSET_FAILURE', label: `Failure: ${f.assetId}`, detail: 'Asset not found — ignored.', warnings: ['Asset not found'] });
      continue;
    }
    asset.status = 'UNDER_REPAIR';
    const until = new Date(nowMs + f.outageDays * DAY_MS);
    ctx.outages.set(idOf(asset), { until, reason: f.reason });
    applied.push({
      kind: 'ASSET_FAILURE',
      label: `${asset.assetCode} out of service for ${dayWord(f.outageDays)}`,
      detail: `${f.reason ? f.reason + '. ' : ''}${asset.name} at ${titleCase(asset.location)} is unavailable until ${fmt(until)}.`,
      warnings: []
    });
  }

  for (const u of input.personnelUnavailable || []) {
    const p = findPerson(world, u.personId);
    if (!p) {
      applied.push({ kind: 'PERSON_UNAVAILABLE', label: `Unavailable: ${u.personId}`, detail: 'Person not found — ignored.', warnings: ['Person not found'] });
      continue;
    }
    ctx.unavailable.set(idOf(p), u.reason || 'marked unavailable in this scenario');
    const wasTravelling = !!p.inboundTransportId && p.currentLocation !== p.destinationLocation;
    if (wasTravelling) {
      p.inboundTransportId = undefined;
      p.inboundUnloadStop = undefined;
      p.destinationLocation = p.currentLocation;
    }
    applied.push({
      kind: 'PERSON_UNAVAILABLE',
      label: `${p.name} unavailable`,
      detail: `${p.role}. ${u.reason ? u.reason + '. ' : ''}${wasTravelling ? 'Removed from their inbound transport, so they no longer count against station beds.' : ''}`.trim(),
      warnings: []
    });
  }

  for (const x of input.extraPeople || []) {
    if (!x.count || !x.durationDays) continue;
    const departId = `sim-departure-${x.station}-${x.durationDays}`;
    const departAt = new Date(nowMs + x.durationDays * DAY_MS).toISOString();
    world.transports.push({
      _id: departId,
      name: 'Scenario departure',
      schedule: [{ stopNumber: 1, portOrStation: x.station, scheduledArrival: departAt, scheduledDeparture: departAt, status: 'SCHEDULED' }]
    });
    for (let i = 1; i <= x.count; i++) {
      world.people.push({
        _id: `sim-extra-${x.station}-${i}`,
        name: `Extra person ${i}`,
        role: 'Sheltering field party',
        readiness: { medicalCleared: true, auliTrainingCompleted: true, passportValid: true, polarPermitIssued: true },
        currentLocation: x.station,
        destinationLocation: x.station,
        outboundTransportId: departId,
        outboundLoadStop: 1
      });
    }
    const headNow = baseline.occupancy.get(x.station)?.[0]?.headcount || 0;
    const extraBurn = headNow > 0 ? 1 + x.count / headNow : 1;
    if (extraBurn > 1) (ctx.fuelBurn[x.station] ||= []).push({ fromDay: 0, toDay: x.durationDays, multiplier: extraBurn });
    applied.push({
      kind: 'EXTRA_PEOPLE',
      label: `${x.count} extra people at ${titleCase(x.station)} for ${dayWord(x.durationDays)}`,
      detail: `${x.reason ? x.reason + '. ' : ''}Adds ${x.count} to bed demand until ${fmt(departAt)} and raises fuel use by ${Math.round((extraBurn - 1) * 100)}% (${x.count} on top of ${headNow} people today).`,
      warnings: []
    });
  }

  return { ctx, applied };
}

// ---------------------------------------------------------------------------
// Comparisons
// ---------------------------------------------------------------------------

function compareMissions(base: WorldAnalysis, sim: WorldAnalysis, world: IWorldSnapshot): MissionComparison[] {
  const out: MissionComparison[] = [];
  for (const m of world.missions) {
    const id = idOf(m);
    const b = base.missions.get(id);
    const s = sim.missions.get(id);
    if (!b || !s) continue;
    const bByKey = new Map(b.reasons.map(r => [r.key, r]));
    const sByKey = new Map(s.reasons.map(r => [r.key, r]));
    const newReasons: MissionReason[] = [];
    const worsenedReasons: Array<MissionReason & { before: string }> = [];
    const unchangedReasons: MissionReason[] = [];
    for (const r of s.reasons) {
      const prev = bByKey.get(r.key);
      if (!prev) newReasons.push(r);
      else if (prev.text !== r.text || prev.level !== r.level) worsenedReasons.push({ ...r, before: prev.text });
      else unchangedReasons.push(r);
    }
    const resolvedReasons = b.reasons.filter(r => !sByKey.has(r.key));
    out.push({
      missionId: id,
      code: m.code,
      title: m.title,
      station: m.station,
      priority: m.priority ?? 3,
      startDate: m.startDate,
      endDate: m.endDate,
      baselineLevel: b.level,
      scenarioLevel: s.level,
      changed: newReasons.length + worsenedReasons.length + resolvedReasons.length > 0,
      newReasons,
      worsenedReasons,
      resolvedReasons,
      unchangedReasons
    });
  }
  return out.sort((a, b) => Number(b.changed) - Number(a.changed) || a.priority - b.priority);
}

function compareFuel(base: WorldAnalysis, sim: WorldAnalysis, currentDate: Date, ctx: ScenarioContext): FuelComparison[] {
  const out: FuelComparison[] = [];
  for (const [station, s] of sim.fuel) {
    const b = base.fuel.get(station);
    if (!b) continue;
    const profile = ctx.fuelBurn[station] ?? 1;
    let maxMultiplier = 1;
    for (let d = 0; d < HORIZON_DAYS; d++) maxMultiplier = Math.max(maxMultiplier, burnMultiplierOnDay(profile, d));
    const peak = s.forecast.baseBurnRate * maxMultiplier;
    out.push({
      station,
      itemName: s.item.name,
      unit: s.item.unit,
      minimumLevel: s.item.minimumLevel,
      stockNow: s.forecast.projectedStockAtNow,
      baseline: {
        burnRate: b.forecast.burnRate,
        breachDate: b.forecast.minBreachDate,
        resupplyDate: b.forecast.nextResupplyDate,
        resupplyCrate: b.forecast.resupplyCrateCode || null,
        marginDays: b.forecast.marginDays
      },
      scenario: {
        burnRate: s.forecast.burnRate,
        peakBurnRate: Math.round(peak),
        breachDate: s.forecast.minBreachDate,
        resupplyDate: s.forecast.nextResupplyDate,
        resupplyCrate: s.forecast.resupplyCrateCode || null,
        marginDays: s.forecast.marginDays
      },
      status: marginLevel(s.forecast.marginDays),
      series: s.series.map((v, d) => ({
        date: new Date(currentDate.getTime() + d * DAY_MS).toISOString(),
        baseline: b.series[d],
        scenario: v
      }))
    });
  }
  return out;
}

function overbookedWindow(daily: DailyOccupancy[]): OccupancyWindow | null {
  const over = daily.filter(d => d.isOverbooked);
  if (!over.length) return null;
  const peakDay = over.reduce((p, d) => (d.headcount > p.headcount ? d : p));
  return { from: over[0].date, to: over[over.length - 1].date, days: over.length, peak: peakDay.headcount, peakDate: peakDay.date };
}

function compareOccupancy(base: WorldAnalysis, sim: WorldAnalysis): OccupancyComparison[] {
  return STATIONS.map(st => {
    const b = base.occupancy.get(st) || [];
    const s = sim.occupancy.get(st) || [];
    return {
      station: st,
      beds: STATION_BED_CAPACITIES[st] || 0,
      baselineWindow: overbookedWindow(b),
      scenarioWindow: overbookedWindow(s),
      series: s.map((d, i) => ({ date: d.date, baseline: b[i]?.headcount ?? 0, scenario: d.headcount }))
    };
  });
}

function compareAlerts(base: IAlertItem[], sim: IAlertItem[]): AlertComparison {
  const bMap = new Map(base.map(a => [a.id, a]));
  const sMap = new Map(sim.map(a => [a.id, a]));
  const changedAlerts: AlertComparison['changedAlerts'] = [];
  let unchangedCount = 0;
  for (const a of sim) {
    const prev = bMap.get(a.id);
    if (!prev) continue;
    if (prev.severity !== a.severity || prev.description !== a.description) changedAlerts.push({ before: prev, after: a });
    else unchangedCount++;
  }
  return {
    newAlerts: sim.filter(a => !bMap.has(a.id)),
    resolvedAlerts: base.filter(a => !sMap.has(a.id)),
    changedAlerts,
    unchangedCount,
    baselineCount: base.length,
    scenarioCount: sim.length
  };
}

// ---------------------------------------------------------------------------
// Impact tree: follows the real links from each disruption to what it touches
// ---------------------------------------------------------------------------

function missionNode(mc: MissionComparison | undefined, filterKey?: (key: string) => boolean): ImpactNode | null {
  if (!mc) return null;
  const relevant = [...mc.newReasons, ...mc.worsenedReasons].filter(r => !filterKey || filterKey(r.key));
  if (!relevant.length) return null;
  const label = (l: HealthLevel) => ({ OK: 'on track', WATCH: 'watch', AT_RISK: 'at risk', BLOCKED: 'blocked' }[l]);
  const levelChanged = mc.baselineLevel !== mc.scenarioLevel;
  const already = !levelChanged && LEVEL_RANK[mc.baselineLevel] >= LEVEL_RANK.WATCH
    ? ` (Already ${label(mc.baselineLevel)} today for other reasons — this adds a new one.)`
    : '';
  return {
    kind: 'MISSION',
    label: `${mc.code} · ${mc.title} (priority ${mc.priority})`,
    before: levelChanged ? label(mc.baselineLevel) : undefined,
    after: levelChanged ? label(mc.scenarioLevel) : undefined,
    status: maxLevel(relevant.map(r => r.level)),
    note: relevant.map(r => r.text).join(' ') + already,
    children: []
  };
}

function fuelNode(fc: FuelComparison | undefined, world: IWorldSnapshot, missions: MissionComparison[], combinedNote: boolean): ImpactNode | null {
  if (!fc) return null;
  if (fc.baseline.marginDays === fc.scenario.marginDays && fc.baseline.breachDate?.slice(0, 10) === fc.scenario.breachDate?.slice(0, 10)) return null;
  const fuelItem = world.inventory.find(i => i.category === 'FUEL' && i.station === fc.station);
  const consumers = fuelItem ? consumersOf(world, idOf(fuelItem)) : [];
  const children: ImpactNode[] = [];
  for (const asset of consumers) {
    const users = missions.filter(m => world.missions.find(x => idOf(x) === m.missionId)?.assetIds?.includes(idOf(asset)));
    const mNodes = users.map(u => missionNode(u, k => k === `fuel:${fc.station}`)).filter(Boolean) as ImpactNode[];
    children.push({
      kind: 'ASSET',
      label: `${asset.assetCode} runs on this fuel`,
      status: mNodes.length ? maxLevel(mNodes.map(n => n.status as HealthLevel)) : 'INFO',
      note: mNodes.length ? undefined : users.length ? `Used by ${users.map(u => u.code).join(', ')} — not affected by this change.` : 'Station power — no mission lists it directly, but everything on station depends on it.',
      children: mNodes
    });
  }
  return {
    kind: 'INVENTORY',
    label: `${titleCase(fc.station)} fuel: time left before resupply`,
    before: marginText(fc.baseline.marginDays),
    after: marginText(fc.scenario.marginDays),
    status: fc.status,
    note: `Stock reaches the ${num(fc.minimumLevel)} ${fc.unit} safety minimum on ${fmt(fc.scenario.breachDate)} (was ${fmt(fc.baseline.breachDate)}); resupply ${fc.scenario.resupplyCrate || ''} lands ${fmt(fc.scenario.resupplyDate)} (was ${fmt(fc.baseline.resupplyDate)}).${combinedNote ? ' Figures include every change in this scenario combined.' : ''}`,
    children
  };
}

function bedsNode(oc: OccupancyComparison | undefined): ImpactNode | null {
  if (!oc) return null;
  const b = oc.baselineWindow;
  const s = oc.scenarioWindow;
  const same = (b?.from === s?.from && b?.to === s?.to && b?.peak === s?.peak);
  if (same) return null;
  const w = (x: OccupancyWindow | null) => (x ? `${fmt(x.from)}–${fmt(x.to)} (${x.peak} people)` : 'never overbooked');
  return {
    kind: 'STATION',
    label: `${titleCase(oc.station)} beds (${oc.beds}) overbooked`,
    before: w(b),
    after: w(s),
    status: s ? (b && s.days <= b.days && s.peak <= b.peak ? 'WATCH' : 'AT_RISK') : 'OK',
    note: s ? `Overbooked on ${dayWord(s.days)}; worst on ${fmt(s.peakDate)} with ${s.peak - oc.beds} more people than beds.` : 'Overbooking disappears in this scenario.',
    children: []
  };
}

function buildImpactTree(
  input: WhatIfScenarioInput,
  base: WorldAnalysis,
  sim: WorldAnalysis,
  ctx: ScenarioContext,
  missions: MissionComparison[],
  fuel: FuelComparison[],
  occupancy: OccupancyComparison[]
): ImpactNode[] {
  const world = sim.world;
  const mcById = new Map(missions.map(m => [m.missionId, m]));
  const fuelDriversByStation = new Map<string, number>();
  const noteDriver = (st: string) => fuelDriversByStation.set(st, (fuelDriversByStation.get(st) || 0) + 1);
  for (const w of input.weather || []) noteDriver(w.station);
  for (const x of input.extraPeople || []) noteDriver(x.station);
  for (const [tId, d] of ctx.delayedTransports) {
    for (const c of world.crates) {
      if (c.carrierTransportId === tId && (c.carrierUnloadStop ?? 0) >= d.fromStop && c.resupplies?.inventoryItemId) {
        const item = world.inventory.find(i => idOf(i) === c.resupplies.inventoryItemId);
        if (item?.category === 'FUEL') noteDriver(item.station);
      }
    }
  }
  const combined = (st: string) => (fuelDriversByStation.get(st) || 0) > 1;
  const roots: ImpactNode[] = [];

  for (const [tId, d] of ctx.delayedTransports) {
    const t = sim.transportsById[tId];
    const children: ImpactNode[] = [];

    const crates = world.crates.filter(c => c.carrierTransportId === tId && (c.carrierUnloadStop ?? 0) >= d.fromStop && c.status !== 'RECEIVED_STATION');
    const plain: any[] = [];
    for (const c of crates) {
      const bEta = base.crateEta.get(idOf(c))?.eta;
      const sEta = sim.crateEta.get(idOf(c))?.eta;
      const cChildren: ImpactNode[] = [];
      const mc = c.linkedMissionId ? mcById.get(c.linkedMissionId) : undefined;
      const mNode = missionNode(mc, k => k === `crate:${c.crateCode}`);
      if (mNode) cChildren.push(mNode);
      if (c.resupplies?.inventoryItemId) {
        const item = world.inventory.find(i => idOf(i) === c.resupplies.inventoryItemId);
        if (item?.category === 'FUEL') {
          const fNode = fuelNode(fuel.find(f => f.station === item.station), world, missions, combined(item.station));
          if (fNode) cChildren.push(fNode);
        } else if (item) {
          const users = world.assets.filter(a => (a.requiredSpareItemIds || []).includes(idOf(item)));
          cChildren.push({
            kind: 'INVENTORY',
            label: `${item.name} (${titleCase(item.station)})`,
            before: `${item.quantity} on hand, +${c.resupplies.quantity} on ${fmt(bEta)}`,
            after: `${item.quantity} on hand, +${c.resupplies.quantity} on ${fmt(sEta)}`,
            status: users.length > item.quantity ? 'WATCH' : 'INFO',
            note: users.length > item.quantity
              ? `Only ${item.quantity} spare for ${users.length} machines (${users.map(u => u.assetCode).join(', ')}) — this shortage now lasts ${dayWord(d.days)} longer.`
              : undefined,
            children: []
          });
        }
      }
      if (!cChildren.length && !c.linkedMissionId) {
        plain.push({ c, bEta, sEta });
        continue;
      }
      const slack = calDays(sEta, c.requiredByDate);
      const own: HealthLevel = c.linkedMissionId ? (slack < 0 ? 'AT_RISK' : slack < WATCH_DAYS ? 'WATCH' : 'OK') : 'OK';
      children.push({
        kind: 'CRATE',
        label: `${c.crateCode} · ${c.title}`,
        before: fmt(bEta),
        after: fmt(sEta),
        status: maxLevel([own, ...cChildren.map(n => (n.status === 'INFO' ? 'OK' : n.status) as HealthLevel)]),
        note: c.linkedMissionId ? `Needed by ${fmt(c.requiredByDate)}.` : undefined,
        children: cChildren
      });
    }
    if (plain.length) {
      const late = plain.filter(p => toMs(p.sEta) > toMs(p.c.requiredByDate));
      children.push({
        kind: 'SUMMARY',
        label: `${plain.length} other crate${plain.length === 1 ? '' : 's'} on board arrive ${dayWord(d.days)} later`,
        status: late.length ? 'AT_RISK' : 'OK',
        note: late.length
          ? `${late.length} now miss their required date: ${late.map(p => p.c.crateCode).join(', ')}.`
          : 'All still arrive before their required dates.',
        children: []
      });
    }

    const travellers = world.people.filter(p => p.inboundTransportId === tId && (p.inboundUnloadStop ?? 0) >= d.fromStop);
    const byStation = new Map<string, any[]>();
    for (const p of travellers) byStation.set(p.destinationLocation, [...(byStation.get(p.destinationLocation) || []), p]);
    for (const [st, group] of byStation) {
      const sArr = personArrival(group[0], sim.transportsById);
      const basePerson = base.world.people.find(x => idOf(x) === idOf(group[0]));
      const bArr = personArrival(basePerson, base.transportsById);
      const pChildren: ImpactNode[] = [];
      for (const p of group) {
        const onMissions = missions.filter(m => world.missions.find(x => idOf(x) === m.missionId)?.peopleIds?.includes(idOf(p)));
        const mNodes = onMissions.map(m => missionNode(m, k => k === `person:${idOf(p)}:arrival`)).filter(Boolean) as ImpactNode[];
        if (mNodes.length) {
          pChildren.push({
            kind: 'PERSON',
            label: `${p.name} · ${p.role}`,
            before: fmt(bArr),
            after: fmt(sArr),
            status: maxLevel(mNodes.map(n => n.status as HealthLevel)),
            children: mNodes
          });
        }
      }
      children.push({
        kind: 'PERSON',
        label: `${group.length} people reach ${titleCase(st)} later`,
        before: fmt(bArr),
        after: fmt(sArr),
        status: pChildren.length ? maxLevel(pChildren.map(n => n.status as HealthLevel)) : 'OK',
        note: pChildren.length ? undefined : 'None of them is needed by a mission before they arrive.',
        children: pChildren
      });
    }

    for (const oc of occupancy) {
      const moves = world.people.some(p =>
        (p.inboundTransportId === tId && p.destinationLocation === oc.station) ||
        (p.outboundTransportId === tId && p.currentLocation === oc.station));
      const n = moves ? bedsNode(oc) : null;
      if (n) children.push(n);
    }

    const firstStop = t.schedule.find((s: any) => s.stopNumber === d.fromStop);
    const baseStop = base.transportsById[tId]?.schedule?.find((s: any) => s.stopNumber === d.fromStop);
    roots.push({
      kind: 'TRANSPORT',
      label: `${t.name} delayed ${dayWord(d.days)}`,
      before: `${firstStop?.portOrStation?.split(' (')[0]} ${fmt(getEffectiveArrival(baseStop))}`,
      after: `${firstStop?.portOrStation?.split(' (')[0]} ${fmt(getEffectiveArrival(firstStop))}`,
      status: maxLevel(children.map(c => (c.status === 'INFO' ? 'OK' : c.status) as HealthLevel)),
      note: `Stop ${d.fromStop} and every later stop move by ${dayWord(d.days)}.`,
      children
    });
  }

  for (const w of input.weather || []) {
    const fNode = fuelNode(fuel.find(f => f.station === w.station), world, missions, combined(w.station));
    roots.push({
      kind: 'WEATHER',
      label: `${w.label || 'Severe weather'} at ${titleCase(w.station)}`,
      before: 'normal fuel use',
      after: `+${Math.round((w.fuelBurnMultiplier - 1) * 100)}% for ${dayWord(w.durationDays)}`,
      status: fNode ? (fNode.status as HealthLevel) : 'OK',
      children: fNode ? [fNode] : []
    });
  }

  for (const [aId, outage] of ctx.outages) {
    const asset = world.assets.find(a => idOf(a) === aId);
    if (!asset) continue;
    const children: ImpactNode[] = [];
    const users = missions.filter(m => world.missions.find(x => idOf(x) === m.missionId)?.assetIds?.includes(aId));
    for (const u of users) {
      const n = missionNode(u, k => k === `asset:${asset.assetCode}`);
      children.push(n || {
        kind: 'MISSION',
        label: `${u.code} · ${u.title}`,
        status: 'OK',
        note: `Repair finishes ${fmt(outage.until)}, before this mission needs it (${fmt(u.startDate)}).`,
        children: []
      });
    }
    children.push(...assessOutage(asset, outage, sim, ctx).nodes);
    roots.push({
      kind: 'ASSET',
      label: `${asset.assetCode} out of service`,
      before: 'in service',
      after: `until ${fmt(outage.until)}`,
      status: maxLevel(children.map(c => (c.status === 'INFO' ? 'OK' : c.status) as HealthLevel)),
      note: `${asset.name} · criticality ${asset.criticality}`,
      children
    });
  }

  for (const [pId, reason] of ctx.unavailable) {
    const p = world.people.find(x => idOf(x) === pId);
    if (!p) continue;
    const children: ImpactNode[] = [];
    const onMissions = missions.filter(m => world.missions.find(x => idOf(x) === m.missionId)?.peopleIds?.includes(pId));
    for (const m of onMissions) {
      const n = missionNode(m, k => k === `person:${pId}:available`);
      if (n) children.push(n);
    }
    const standby = p.standbyPersonId ? world.people.find(x => idOf(x) === p.standbyPersonId) : null;
    if (standby) {
      const plan = standbyAssessment(standby, onMissions, sim);
      children.push({ kind: 'PERSON', label: `Standby: ${standby.name} · ${standby.role}`, status: plan.feasible ? 'OK' : 'WATCH', note: plan.text, children: [] });
    } else {
      children.push({ kind: 'SUMMARY', label: 'No designated standby', status: 'AT_RISK', children: [] });
    }
    roots.push({
      kind: 'PERSON',
      label: `${p.name} unavailable`,
      before: 'available',
      after: reason,
      status: maxLevel(children.map(c => (c.status === 'INFO' ? 'OK' : c.status) as HealthLevel)),
      note: p.role,
      children
    });
  }

  for (const x of input.extraPeople || []) {
    const children: ImpactNode[] = [];
    const b = bedsNode(occupancy.find(o => o.station === x.station));
    if (b) children.push(b);
    const f = fuelNode(fuel.find(fc => fc.station === x.station), world, missions, combined(x.station));
    if (f) children.push(f);
    roots.push({
      kind: 'STATION',
      label: `${x.count} extra people at ${titleCase(x.station)}`,
      before: 'as planned',
      after: `+${x.count} for ${dayWord(x.durationDays)}`,
      status: children.length ? maxLevel(children.map(c => c.status as HealthLevel)) : 'OK',
      note: children.length ? undefined : 'Beds and fuel absorb this without breaching limits.',
      children
    });
  }

  return roots;
}

interface Finding { level: HealthLevel; text: string }

/** Backups and spare parts for an asset that is out of service. */
function assessOutage(asset: any, outage: { until: Date }, sim: WorldAnalysis, ctx: ScenarioContext): { nodes: ImpactNode[]; findings: Finding[] } {
  const world = sim.world;
  const nowMs = now().getTime();
  const untilMs = outage.until.getTime();
  const nodes: ImpactNode[] = [];
  const findings: Finding[] = [];
  const kind = asset.category.toLowerCase().replace('_', ' ');

  const alts = world.assets.filter(a => a !== asset && a.category === asset.category && a.location === asset.location && !ctx.outages.has(idOf(a)));
  let ready = 0;
  const caveats: string[] = [];
  for (const alt of alts) {
    const st = assetEffectiveStatus(alt, now());
    const busy = world.missions.filter(m => (m.assetIds || []).includes(idOf(alt)) && toMs(m.startDate) < untilMs && toMs(m.endDate) > nowMs);
    const laterUse = world.missions.filter(m => (m.assetIds || []).includes(idOf(alt)) && toMs(m.startDate) >= untilMs);
    const status: HealthLevel = st === 'UNDER_REPAIR' || st === 'DECOMMISSIONED' ? 'AT_RISK' : st === 'MAINTENANCE_DUE' || busy.length ? 'WATCH' : 'OK';
    if (status === 'OK') ready++;
    if (st === 'MAINTENANCE_DUE') caveats.push(`${alt.assetCode} is itself overdue for service`);
    if (busy.length) caveats.push(`${alt.assetCode} is committed to ${busy.map(m => m.code).join(', ')} during the outage`);
    nodes.push({
      kind: 'ASSET',
      label: `Backup: ${alt.assetCode} · ${alt.name}`,
      status,
      note: [
        st === 'MAINTENANCE_DUE' ? `Service overdue since ${fmt(alt.nextServiceDueDate)}.` : st === 'OPERATIONAL' ? 'Operational.' : `Status: ${st.toLowerCase().replace('_', ' ')}.`,
        busy.length
          ? `Committed to ${busy.map(m => `${m.code} (${fmt(m.startDate)}–${fmt(m.endDate)})`).join(', ')} during the outage.`
          : laterUse.length
            ? `Free during the outage; needed by ${laterUse.map(m => `${m.code} from ${fmt(m.startDate)}`).join(', ')}.`
            : 'Not needed by any mission during the outage.',
        'Output capacity is not recorded — confirm it can carry the load.'
      ].join(' '),
      children: []
    });
  }
  if (!alts.length) {
    nodes.push({ kind: 'SUMMARY', label: `No other ${kind} at ${titleCase(asset.location)}`, status: 'AT_RISK', children: [] });
  }
  const serious = asset.criticality === 'CRITICAL' || asset.criticality === 'HIGH';
  if (!ready) {
    findings.push({
      level: alts.length ? 'WATCH' : serious ? 'AT_RISK' : 'WATCH',
      text: alts.length
        ? `No fully ready backup for ${asset.assetCode} until ${fmt(outage.until)}: ${caveats.join('; ')}.`
        : `No backup ${kind} at ${titleCase(asset.location)} while ${asset.assetCode} is down (until ${fmt(outage.until)}).`
    });
  } else if (caveats.length) {
    findings.push({ level: 'OK', text: `Backup exists for ${asset.assetCode}, but ${caveats.join('; ')}.` });
  }

  for (const spareId of asset.requiredSpareItemIds || []) {
    const spare = world.inventory.find(i => idOf(i) === spareId);
    if (!spare) continue;
    const sharers = world.assets.filter(a => (a.requiredSpareItemIds || []).includes(spareId));
    const others = sharers.filter(s => s !== asset).map(s => s.assetCode);
    const incoming = world.crates.find(c => c.resupplies?.inventoryItemId === spareId && c.status !== 'RECEIVED_STATION');
    const incomingText = incoming ? `${incoming.resupplies.quantity} more arrive ${fmt(sim.crateEta.get(idOf(incoming))?.eta)} (${incoming.crateCode})` : 'none are on order';
    const lastSpare = spare.quantity <= 1 && others.length > 0;
    nodes.push({
      kind: 'INVENTORY',
      label: `Spare parts: ${spare.name}`,
      status: lastSpare ? 'WATCH' : 'OK',
      note: `${spare.quantity} on hand, shared by ${sharers.map(s => s.assetCode).join(', ')}; ${incomingText}.`,
      children: []
    });
    if (lastSpare) {
      findings.push({
        level: 'WATCH',
        text: `If the ${asset.assetCode} repair needs a spare "${spare.name}", it uses the last one — ${others.join(', ')} would have none until ${incoming ? fmt(sim.crateEta.get(idOf(incoming))?.eta) : 'a new order arrives'}.`
      });
    }
  }
  return { nodes, findings };
}

function standbyAssessment(standby: any, missions: MissionComparison[], a: WorldAnalysis): { feasible: boolean; text: string } {
  const r = standby.readiness || {};
  const ready = r.medicalCleared && r.auliTrainingCompleted && r.passportValid && r.polarPermitIssued;
  const station = missions[0]?.station;
  const earliestStart = missions.length ? Math.min(...missions.map(m => toMs(m.startDate))) : NaN;
  if (!ready) return { feasible: false, text: `${standby.name} is not fully cleared to deploy either.` };
  if (!station) return { feasible: true, text: `${standby.name} is cleared to deploy.` };
  if (standby.currentLocation === station) return { feasible: true, text: `${standby.name} is cleared and already at ${titleCase(station)}.` };
  const arr = standby.destinationLocation === station ? personArrival(standby, a.transportsById) : null;
  if (arr && calDays(arr, new Date(earliestStart)) >= 0) return { feasible: true, text: `${standby.name} is cleared and arrives ${fmt(arr)}, in time.` };

  // A usable seat needs a stop that has not departed yet, followed by a stop at the station before the mission starts.
  const nowMs = now().getTime();
  const seats = a.world.transports.flatMap(t => {
    const stops = [...(t.schedule || [])].sort((x: any, y: any) => x.stopNumber - y.stopNumber);
    const unload = stops.find((s: any) => s.portOrStation?.toLowerCase().includes(station.toLowerCase()));
    if (!unload || calDays(getEffectiveArrival(unload), new Date(earliestStart)) < 0) return [];
    const board = stops.find((s: any) => s.stopNumber < unload.stopNumber && toMs(getEffectiveDeparture(s)) > nowMs);
    if (!board) return [];
    const taken = a.world.people.filter(p => p.inboundTransportId === idOf(t)).length;
    const free = (t.passengerSeats || 0) - taken;
    return free > 0 ? [{ t, board, unload, free }] : [];
  });
  if (!seats.length) {
    return { feasible: false, text: `${standby.name} is cleared but is at ${titleCase(standby.currentLocation)}, and no transport with a free seat reaches ${titleCase(station)} before ${fmt(new Date(earliestStart))}.` };
  }
  const s = seats[0];
  return {
    feasible: true,
    text: `${standby.name} is cleared but is at ${titleCase(standby.currentLocation)}. ${s.t.name} leaves ${s.board.portOrStation} on ${fmt(getEffectiveDeparture(s.board))} and reaches ${titleCase(station)} on ${fmt(getEffectiveArrival(s.unload))} (${s.free} seats free) — a seat and onward travel to ${s.board.portOrStation} must be booked.`
  };
}

// ---------------------------------------------------------------------------
// Decision support: options calculated from the data; the operator decides
// ---------------------------------------------------------------------------

function crewConflicts(mission: any, shiftDays: number, world: IWorldSnapshot, a: WorldAnalysis): string[] {
  const newStart = toMs(mission.startDate) + shiftDays * DAY_MS;
  const newEnd = toMs(mission.endDate) + shiftDays * DAY_MS;
  const notes: string[] = [];
  for (const pId of mission.peopleIds || []) {
    const p = world.people.find(x => idOf(x) === pId);
    if (!p) continue;
    for (const other of world.missions) {
      if (other === mission || !(other.peopleIds || []).includes(pId)) continue;
      const oS = toMs(other.startDate);
      const oE = toMs(other.endDate);
      const overlapsNow = oS < toMs(mission.endDate) && oE > toMs(mission.startDate);
      const overlapsNew = oS < newEnd && oE > newStart;
      if (overlapsNew && !overlapsNow) notes.push(`${p.name} would now overlap with ${other.code} (${fmt(other.startDate)}–${fmt(other.endDate)}).`);
    }
    const dep = personDeparture(p, a.transportsById);
    if (dep && toMs(dep) < newEnd && toMs(dep) >= toMs(mission.endDate)) notes.push(`${p.name} leaves on ${fmt(dep)}, before the moved end date.`);
  }
  return notes;
}

function buildDecisions(
  missions: MissionComparison[],
  fuel: FuelComparison[],
  occupancy: OccupancyComparison[],
  sim: WorldAnalysis,
  ctx: ScenarioContext,
  currentDate: Date
): DecisionPoint[] {
  const world = sim.world;
  const decisions: DecisionPoint[] = [];

  for (const mc of missions) {
    const mission = world.missions.find(x => idOf(x) === mc.missionId);
    if (!mission) continue;
    const caused = [...mc.newReasons, ...mc.worsenedReasons].filter(r => LEVEL_RANK[r.level] >= LEVEL_RANK.AT_RISK && !r.key.startsWith('fuel:'));
    if (!caused.length) continue;
    const options: DecisionOption[] = [];
    let waitDays = 0;
    for (const r of caused) {
      let lateDays = 0;

      if (r.key.startsWith('crate:')) {
        const crate = world.crates.find(c => `crate:${c.crateCode}` === r.key);
        const eta = crate && sim.crateEta.get(idOf(crate))?.eta;
        if (!crate || !eta) continue;
        lateDays = calDays(crate.requiredByDate, eta);
        if (!crate.loadedOnCarrier) {
          const alt = world.transports.filter(t => idOf(t) !== crate.carrierTransportId).map(t => {
            const unload = (t.schedule || []).find((s: any) => s.portOrStation?.toLowerCase().includes(crate.destinationStation.toLowerCase().slice(0, 5)));
            const load = (t.schedule || []).find((s: any) => s.stopNumber < (unload?.stopNumber ?? 0) && toMs(getEffectiveDeparture(s)) > currentDate.getTime());
            const arrival = unload ? toMs(getEffectiveArrival(unload)) + (crate.handlingDays ?? 1) * DAY_MS : NaN;
            const booked = world.crates.filter(c => c.carrierTransportId === idOf(t)).reduce((s, c) => s + (c.weightKg || 0), 0);
            return { t, load, arrival, spare: (t.capacityKg || 0) - booked };
          }).filter(x => x.load && !isNaN(x.arrival) && x.arrival <= toMs(crate.requiredByDate) && x.spare >= crate.weightKg);
          options.push(alt.length
            ? { title: `Re-book ${crate.crateCode} on ${alt[0].t.name}`, effect: `Arrives ${fmt(new Date(alt[0].arrival))}, before ${fmt(crate.requiredByDate)}. ${num(alt[0].spare)} kg spare capacity for a ${crate.weightKg} kg crate.`, tradeOff: crate.hazardous ? `Hazardous cargo (${crate.hazardClass}) — needs dangerous-goods approval for that carrier.` : 'Needs a booking change with the carrier.', feasible: true }
            : { title: `Send ${crate.crateCode} another way`, effect: 'No other transport reaches the destination in time with enough spare capacity.', tradeOff: '—', feasible: false });
        } else {
          const carrier = sim.transportsById[crate.carrierTransportId];
          options.push({ title: `Send ${crate.crateCode} another way`, effect: `It is already loaded aboard ${carrier?.name || 'its carrier'}.`, tradeOff: '—', feasible: false });
        }
      } else if (r.key.endsWith(':arrival')) {
        const pId = r.key.split(':')[1];
        const p = world.people.find(x => idOf(x) === pId);
        const arr = personArrival(p, sim.transportsById);
        if (!p || !arr) continue;
        lateDays = calDays(mission.startDate, arr);
        options.push({
          title: `Start on time; ${p.name} joins on arrival`,
          effect: `Mission runs without its ${p.role} for the first ${dayWord(lateDays)}.`,
          tradeOff: 'Only acceptable if that role is not needed in the first days (e.g. set-up by other crew).',
          feasible: true
        });
        const standby = p.standbyPersonId ? world.people.find(x => idOf(x) === p.standbyPersonId) : null;
        if (standby) {
          const plan = standbyAssessment(standby, [mc], sim);
          options.push({ title: `Use standby ${standby.name}`, effect: plan.text, tradeOff: plan.feasible ? `${p.name} is released from this mission.` : 'Needs travel arranged first.', feasible: plan.feasible });
        }
      } else if (r.key.endsWith(':available')) {
        const pId = r.key.split(':')[1];
        const p = world.people.find(x => idOf(x) === pId);
        const standby = p?.standbyPersonId ? world.people.find(x => idOf(x) === p.standbyPersonId) : null;
        if (standby) {
          const plan = standbyAssessment(standby, [mc], sim);
          options.push({ title: `Use standby ${standby.name}`, effect: plan.text, tradeOff: plan.feasible ? 'Standby replaces them on every mission.' : 'Needs travel arranged first.', feasible: plan.feasible });
        } else {
          options.push({ title: 'Find a replacement', effect: `${p?.name} has no designated standby; a qualified replacement must be nominated.`, tradeOff: 'Takes time to clear and transport a new person.', feasible: false });
        }
        options.push({ title: 'Run the mission without this role', effect: `Continue ${mc.code} with the remaining crew.`, tradeOff: `Only if ${p?.role} tasks can be covered by others.`, feasible: true });
      } else if (r.key.startsWith('asset:')) {
        const code = r.key.slice(6);
        const asset = world.assets.find(x => x.assetCode === code);
        const outage = asset && ctx.outages.get(idOf(asset));
        if (!asset) continue;
        if (outage) lateDays = calDays(mission.startDate, outage.until);
        // A substitute is only needed from the mission start until the repair is done.
        const needFrom = toMs(mission.startDate);
        const needTo = outage ? Math.min(outage.until.getTime(), toMs(mission.endDate)) : toMs(mission.endDate);
        const alts = world.assets.filter(x => x !== asset && x.category === asset.category && x.location === asset.location && !ctx.outages.has(idOf(x)));
        for (const alt of alts) {
          const users = world.missions.filter(m => m !== mission && (m.assetIds || []).includes(idOf(alt)) && toMs(m.startDate) < needTo && toMs(m.endDate) > needFrom);
          const st = assetEffectiveStatus(alt, currentDate);
          options.push({
            title: `Use ${alt.assetCode} instead`,
            effect: `${alt.name} is ${st === 'OPERATIONAL' ? 'operational' : st.toLowerCase().replace('_', ' ')} at ${titleCase(alt.location)}.`,
            tradeOff: users.length ? `${users.map(u => `${u.code} (priority ${u.priority}, ${fmt(u.startDate)}–${fmt(u.endDate)})`).join(', ')} would lose it for the overlap.` : 'Not needed by another mission in that period.',
            feasible: st !== 'UNDER_REPAIR'
          });
        }
        if (!alts.length) options.push({ title: 'Use a substitute', effect: `No other ${asset.category.toLowerCase().replace('_', ' ')} at ${titleCase(asset.location)}.`, tradeOff: '—', feasible: false });
      }
      waitDays = Math.max(waitDays, lateDays);
    }

    if (waitDays > 0) {
      const conflicts = crewConflicts(mission, waitDays, world, sim);
      options.unshift({
        title: `Wait: start ${mc.code} ${dayWord(waitDays)} later`,
        effect: `Runs ${fmt(new Date(toMs(mission.startDate) + waitDays * DAY_MS))}–${fmt(new Date(toMs(mission.endDate) + waitDays * DAY_MS))} instead of ${fmt(mission.startDate)}–${fmt(mission.endDate)}${caused.length > 1 ? ', which covers every delay listed' : ''}.`,
        tradeOff: conflicts.length ? conflicts.join(' ') : 'No crew clashes with other missions.',
        feasible: true
      });
    }

    decisions.push({
      problem: `${mc.code} · ${mc.title} (priority ${mc.priority})`,
      detail: caused.map(r => r.text),
      severity: maxLevel(caused.map(r => r.level)),
      options
    });
  }

  for (const fc of fuel) {
    const m = fc.scenario.marginDays;
    const bm = fc.baseline.marginDays;
    if (m === null || m >= WATCH_DAYS || (bm !== null && m >= bm)) continue;
    const resupplyMs = toMs(fc.scenario.resupplyDate);
    const daysToResupply = (resupplyMs - currentDate.getTime()) / DAY_MS;
    if (!(daysToResupply > 0)) continue;
    const budget = fc.stockNow - fc.minimumLevel;
    const profile = ctx.fuelBurn[fc.station] ?? 1;
    const f = sim.fuel.get(fc.station)!;
    const plannedUse = cumulativeBurn(f.forecast.baseBurnRate, profile, daysToResupply);
    const targetDays = daysToResupply + WATCH_DAYS;
    const plannedWithBuffer = cumulativeBurn(f.forecast.baseBurnRate, profile, targetDays);
    const allowed = budget / targetDays;
    const avgPlanned = plannedWithBuffer / targetDays;
    const cut = Math.max(0, 1 - allowed / avgPlanned);
    decisions.push({
      problem: `${titleCase(fc.station)} fuel: ${m < 0 ? `falls below the ${num(fc.minimumLevel)} ${fc.unit} safety minimum ${dayWord(-m)} before resupply` : `only ${dayWord(m)} of slack before resupply`} (resupply ${fmt(fc.scenario.resupplyDate)}).`,
      severity: marginLevel(m),
      options: [
        {
          title: `Cut fuel use at ${titleCase(fc.station)} by ${Math.ceil(cut * 100)}%`,
          effect: `Average ${num(allowed)} ${fc.unit}/day instead of ~${num(avgPlanned)} until resupply keeps ${dayWord(WATCH_DAYS)} of safety margin. Planned use until resupply: ${num(plannedUse)} ${fc.unit}; available above minimum: ${num(budget)} ${fc.unit}.`,
          tradeOff: 'Reduced heating in unoccupied buildings, fewer vehicle runs, deferred non-essential power loads.',
          feasible: cut < 0.4
        },
        ...(m < 0 ? [{
          title: 'Dip into the safety reserve',
          effect: `Use about ${num(plannedUse - budget)} ${fc.unit} below the minimum until resupply arrives.`,
          tradeOff: 'The reserve exists for emergencies; using it leaves no cover if resupply slips again.',
          feasible: true
        }] : [])
      ]
    });
  }

  for (const oc of occupancy) {
    const s = oc.scenarioWindow;
    const b = oc.baselineWindow;
    if (!s || (b && s.days <= b.days && s.peak <= b.peak && s.from === b.from)) continue;
    const extra = s.peak - oc.beds;
    decisions.push({
      problem: `${titleCase(oc.station)} has more people than its ${oc.beds} beds on ${dayWord(s.days)} (${fmt(s.from)}–${fmt(s.to)}), worst on ${fmt(s.peakDate)} with ${s.peak} people.`,
      severity: 'WATCH',
      options: [
        { title: `Find up to ${extra} temporary berths`, effect: `Needed from ${fmt(s.from)} to ${fmt(s.to)} — e.g. on board the ship while it is alongside, or in a field camp.`, tradeOff: 'Extra transfers each day; a field camp needs fuel and a safety lead.', feasible: true },
        { title: `Hold up to ${extra} arrivals until ${fmt(new Date(toMs(s.to) + DAY_MS))}`, effect: 'They stay on the ship until enough people have left.', tradeOff: 'Those people start their work later.', feasible: true }
      ]
    });
  }

  return decisions;
}

// ---------------------------------------------------------------------------
// Verdict, scorecard and assumptions
// ---------------------------------------------------------------------------

function causedReasons(m: MissionComparison): MissionReason[] {
  return [...m.newReasons, ...m.worsenedReasons];
}

function buildVerdict(
  name: string,
  missions: MissionComparison[],
  fuel: FuelComparison[],
  occupancy: OccupancyComparison[],
  alerts: AlertComparison,
  findings: Finding[]
): WhatIfScenarioResult['verdict'] {
  const atRisk = (l: HealthLevel) => LEVEL_RANK[l] >= LEVEL_RANK.AT_RISK;
  const worsened = missions.filter(m => causedReasons(m).some(r => atRisk(r.level)));
  const tighter = missions.filter(m => !worsened.includes(m) && causedReasons(m).length > 0);
  const fuelChanged = fuel.filter(f => f.scenario.marginDays !== f.baseline.marginDays);
  const bedsWorse = occupancy.filter(o => o.scenarioWindow && (!o.baselineWindow || o.scenarioWindow.peak > o.baselineWindow.peak || o.scenarioWindow.days > o.baselineWindow.days));
  const bullets: string[] = [];

  for (const m of worsened) {
    const r = causedReasons(m).sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])[0];
    bullets.push(`${m.code} (priority ${m.priority}): ${r.text}`);
  }
  for (const f of fuelChanged) {
    bullets.push(`${titleCase(f.station)} fuel before resupply: ${marginText(f.baseline.marginDays)} → ${marginText(f.scenario.marginDays)}.`);
  }
  for (const o of occupancy) {
    const b = o.baselineWindow;
    const s = o.scenarioWindow;
    if (b?.from !== s?.from || b?.to !== s?.to || b?.peak !== s?.peak) {
      const w = (x: OccupancyWindow | null) => (x ? `${fmt(x.from)}–${fmt(x.to)}, up to ${x.peak} people` : 'none');
      bullets.push(`${titleCase(o.station)} bed overbooking (${o.beds} beds): ${w(b)} → ${w(s)}.`);
    }
  }
  for (const f of findings) bullets.push(f.text);
  for (const m of tighter) bullets.push(`${m.code}: less slack — ${causedReasons(m)[0].text}`);
  const untouched = missions.filter(m => !m.changed).map(m => m.code);
  if (untouched.length && untouched.length < missions.length) bullets.push(`Not affected: ${untouched.join(', ')}.`);

  const level = maxLevel([
    ...worsened.flatMap(m => causedReasons(m).map(r => r.level)),
    ...tighter.map(() => 'WATCH' as HealthLevel),
    ...fuelChanged.map(f => marginLevel(f.scenario.marginDays)),
    ...bedsWorse.map(() => 'WATCH' as HealthLevel),
    ...findings.map(f => f.level),
    'OK'
  ]);

  const parts: string[] = [];
  if (worsened.length) parts.push(`${worsened.length} of ${missions.length} active missions ${worsened.length === 1 ? 'is' : 'are'} put at risk (${worsened.map(m => m.code).join(', ')})`);
  const breached = fuelChanged.filter(f => (f.scenario.marginDays ?? 0) < 0);
  const shrunk = fuelChanged.filter(f => (f.scenario.marginDays ?? 0) >= 0 && (f.scenario.marginDays ?? 0) < (f.baseline.marginDays ?? 0));
  if (breached.length) parts.push(`${breached.map(f => titleCase(f.station)).join(' and ')} would drop below the fuel safety minimum before resupply`);
  if (shrunk.length) parts.push(`fuel slack shrinks at ${shrunk.map(f => titleCase(f.station)).join(' and ')}`);
  if (bedsWorse.length) parts.push(`${bedsWorse.map(o => titleCase(o.station)).join(' and ')} would be more overbooked`);
  const findingsAtRisk = findings.filter(f => f.level !== 'OK');
  if (!parts.length && findingsAtRisk.length) parts.push('no mission is directly affected, but backup cover is thin');
  const headline = parts.length
    ? `${name}: ${parts.join('; ')}.`
    : alerts.newAlerts.length
      ? `${name}: no mission, fuel stock or bed limit is put at risk; ${alerts.newAlerts.length} new warning${alerts.newAlerts.length === 1 ? ' appears' : 's appear'}.`
      : `${name}: the plan absorbs this — no mission, fuel stock or bed limit is affected.`;

  return { level, headline, bullets };
}

function buildAssumptions(base: WorldAnalysis, currentDate: Date): string[] {
  const burns = Array.from(base.fuel.values()).map(f => `${titleCase(f.item.station)} ${num(f.forecast.baseBurnRate)} ${f.item.unit}/day`).join(', ');
  const handling = Array.from(new Set(base.world.crates.map(c => c.handlingDays ?? 1))).sort().join(' or ');
  return [
    `Everything is calculated on a copy of the data as of ${fmt(currentDate)} ${currentDate.getUTCFullYear()}. The live plan is never changed.`,
    'A transport delay moves the chosen stop and every later stop by the same number of days. Helicopters carried aboard move with the ship.',
    `Cargo is usable ${handling} day(s) after its carrier reaches the stop (unloading, slinging, road transfer).`,
    `Normal fuel use is the average of the last 14 days of recorded use (${burns}). A 60-day average is not used because use rises as summer crews arrive.`,
    'Weather only changes fuel use at the named station, only for the stated number of days.',
    'Extra people raise fuel use in proportion to the station headcount on day one.',
    'A person occupies a bed from the day their transport arrives until the day their departing transport leaves.',
    `A mission is "at risk" if cargo, people or equipment it needs are not in place by its start date. "Watch" means less than ${WATCH_DAYS} days of slack.`,
    'Decision options are calculated from the data; the system does not act on them. A person decides.'
  ];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function simulateScenario(input: WhatIfScenarioInput): Promise<WhatIfScenarioResult> {
  const currentDate = now();
  const baseWorld = await fetchWorldSnapshot();
  const baseline = analyseWorld(baseWorld, currentDate, emptyContext());

  const simWorld: IWorldSnapshot = JSON.parse(JSON.stringify(baseWorld));
  const { ctx, applied } = applyDisruptions(simWorld, input, currentDate, baseline);
  const scenario = analyseWorld(simWorld, currentDate, ctx);

  const missions = compareMissions(baseline, scenario, simWorld);
  const fuel = compareFuel(baseline, scenario, currentDate, ctx);
  const occupancy = compareOccupancy(baseline, scenario);
  const alerts = compareAlerts(baseline.alerts, scenario.alerts);
  const name = input.name || applied.map(a => a.label).join(' + ') || 'No changes';

  const findings: Finding[] = [];
  for (const [aId, outage] of ctx.outages) {
    const asset = simWorld.assets.find(a => idOf(a) === aId);
    if (asset) findings.push(...assessOutage(asset, outage, scenario, ctx).findings);
  }

  const atRisk = (lvl: HealthLevel) => LEVEL_RANK[lvl] >= LEVEL_RANK.AT_RISK;
  return {
    scenarioName: name,
    simulatedAt: currentDate.toISOString(),
    verdict: applied.length ? buildVerdict(name, missions, fuel, occupancy, alerts, findings) : { level: 'OK', headline: 'No changes applied — this is today\'s plan.', bullets: [] },
    applied,
    scorecard: {
      missionsAtRisk: {
        baseline: missions.filter(m => atRisk(m.baselineLevel)).length,
        scenario: missions.filter(m => atRisk(m.scenarioLevel)).length,
        newlyAffected: missions.filter(m => causedReasons(m).some(r => atRisk(r.level))).map(m => m.code)
      },
      fuel: fuel.map(f => ({ station: f.station, baselineMargin: f.baseline.marginDays, scenarioMargin: f.scenario.marginDays })),
      alerts: { baseline: alerts.baselineCount, scenario: alerts.scenarioCount, added: alerts.newAlerts.length, resolved: alerts.resolvedAlerts.length },
      beds: occupancy.map(o => ({ station: o.station, baselineDays: o.baselineWindow?.days ?? 0, scenarioDays: o.scenarioWindow?.days ?? 0 }))
    },
    impactTree: buildImpactTree(input, baseline, scenario, ctx, missions, fuel, occupancy),
    checked: {
      crates: simWorld.crates.filter(c => c.status !== 'RECEIVED_STATION').length,
      people: simWorld.people.length,
      missions: missions.length,
      unaffectedMissions: missions.filter(m => !m.changed).map(m => m.code)
    },
    missions,
    fuel,
    occupancy,
    alerts,
    decisions: buildDecisions(missions, fuel, occupancy, scenario, ctx, currentDate),
    assumptions: buildAssumptions(baseline, currentDate)
  };
}
