import { now } from '../../core/clock';
import { fetchWorldSnapshot, IWorldSnapshot } from '../dashboard/service';
import { analyseWorld, emptyContext, calDays, fmt, personArrival, WorldAnalysis } from '../scenarios/service';
import { HealthLevel } from '../scenarios/types';
import { assetEffectiveStatus, getEffectiveArrival, getEffectiveDeparture } from '../../rules';

// Edges in the graph read "source depends on target", e.g. MISSION --NEEDS_CRATE--> CRATE.
// The blast radius of X is therefore everything that (transitively) points at X.

export type EntityKind = 'TRANSPORT' | 'CRATE' | 'PERSON' | 'MISSION' | 'INVENTORY' | 'ASSET';
export type Effect =
  | 'ROOT' | 'DELAYED' | 'BLOCKED' | 'SHORT_CREW' | 'NO_EQUIPMENT'
  | 'RESUPPLY_LATE' | 'FUEL_SHORT' | 'NO_SPARES' | 'IDLE';

export interface Substitute {
  code: string;
  label: string;
  readiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  text: string;
  tradeOff?: string;
}

export interface BlastNode {
  key: string;
  type: EntityKind | 'GROUP';
  id: string;
  ref: string;
  code: string;
  label: string;
  tier: number;
  parentKey: string | null;
  viaRelation: string | null;
  effect: Effect;
  effectText: string;
  info: string[];
  todayStatus: HealthLevel | null;
  todayText?: string;
  /** Days the trigger can slip before this node is affected (delay-type triggers only). Negative = already late. */
  toleranceDays: number | null;
  causes?: Array<{ fromKey: string; code: string; relation: string; text: string; toleranceDays: number | null }>;
  substitutes: Substitute[];
  group?: { memberType: EntityKind; members: Array<{ key: string; code: string; label: string; info: string }> };
}

export interface BlastLink {
  from: string;
  to: string;
  relation: string;
  label: string;
  kind: 'CASCADE' | 'ALSO' | 'IDLE';
}

export interface DominoChain {
  steps: Array<{ key: string; code: string; effectText: string }>;
  endsIn: string;
  priority: number | null;
  toleranceDays: number | null;
}

export interface BlastResult {
  generatedAt: string;
  root: BlastNode;
  failureVerb: string;
  headline: string;
  nodes: BlastNode[];
  links: BlastLink[];
  maxTier: number;
  summary: {
    byTier: Array<{ tier: number; count: number; label: string }>;
    missions: Array<{ code: string; title: string; priority: number; station: string; start: string; effectText: string; todayStatus: HealthLevel | null; toleranceDays: number | null }>;
    cratesHeld: number;
    peopleDelayed: number;
    peopleIdle: number;
    assetsAffected: number;
    assetsIdle: number;
    stocksAffected: number;
    substitutesFound: number;
  };
  chains: DominoChain[];
}

const DAY_MS = 86400000;
const GROUP_THRESHOLD = 6;
const idOf = (d: any) => String(d?._id ?? d?.id ?? '');
const keyOf = (type: string, id: string) => `${type}:${id}`;
const station = (s?: string) => (s ? ({ GOA_HQ: 'Goa HQ', CAPE_TOWN: 'Cape Town', EN_ROUTE_VESSEL: 'the ship' } as Record<string, string>)[s] || s.charAt(0) + s.slice(1).toLowerCase() : '—');
const dayWord = (n: number) => `${n} day${Math.abs(n) === 1 ? '' : 's'}`;

const FAILURE_VERB: Record<EntityKind, string> = {
  TRANSPORT: 'is delayed',
  CRATE: 'is delayed or lost',
  PERSON: 'cannot deploy',
  MISSION: 'is cancelled or postponed',
  INVENTORY: 'runs out',
  ASSET: 'fails'
};

const RELATION_LABEL: Record<string, string> = {
  CARRIED_BY: 'carried by',
  NEEDS_CRATE: 'needs cargo',
  NEEDS_PERSON: 'needs person',
  NEEDS_ASSET: 'needs equipment',
  RESUPPLIED_BY: 'resupplied by',
  CONSUMES: 'runs on',
  NEEDS_SPARE: 'needs spares'
};

function effectFor(relation: string, childType: string, parentNode: BlastNode, world: IWorldSnapshot): { effect: Effect; text: string } {
  switch (relation) {
    case 'CARRIED_BY':
      return childType === 'PERSON'
        ? { effect: 'DELAYED', text: 'Arrives late — travels on this transport' }
        : { effect: 'DELAYED', text: 'Held up — travels on this transport' };
    case 'NEEDS_CRATE':
      return { effect: 'BLOCKED', text: `Cannot start without ${parentNode.code}` };
    case 'NEEDS_PERSON':
      return { effect: 'SHORT_CREW', text: `Loses ${parentNode.code} from its crew` };
    case 'NEEDS_ASSET':
      return { effect: 'NO_EQUIPMENT', text: `Loses ${parentNode.code}` };
    case 'RESUPPLIED_BY':
      return { effect: 'RESUPPLY_LATE', text: 'Resupply arrives late' };
    case 'CONSUMES': {
      const item = world.inventory.find(i => keyOf('INVENTORY', idOf(i)) === parentNode.key);
      return { effect: 'FUEL_SHORT', text: item?.category === 'FUEL' ? 'Could run short of fuel' : 'Could run short of supplies' };
    }
    case 'NEEDS_SPARE':
      return { effect: 'NO_SPARES', text: 'No spare parts if it breaks' };
    default:
      return { effect: 'DELAYED', text: 'Depends on this' };
  }
}

export function refOf(type: EntityKind | 'GROUP', entity: any): string {
  if (type === 'GROUP') return entity?.id || '';
  switch (type) {
    case 'TRANSPORT': return entity.name || '';
    case 'CRATE': return entity.crateCode || '';
    case 'ASSET': return entity.assetCode || '';
    case 'PERSON': return entity.name || '';
    case 'MISSION': return entity.code || '';
    case 'INVENTORY': return `${entity.itemCode}:${entity.station}`;
    default: return idOf(entity);
  }
}

// ---------------------------------------------------------------------------
// Entity lookup and "today" facts
// ---------------------------------------------------------------------------

interface Ctx {
  world: IWorldSnapshot;
  analysis: WorldAnalysis;
  currentDate: Date;
}

function findEntity(ctx: Ctx, type: EntityKind, idOrRef: string): any {
  const { world } = ctx;
  if (!idOrRef) return undefined;
  const target = String(idOrRef).trim();
  const lower = target.toLowerCase();

  switch (type) {
    case 'TRANSPORT': {
      const byId = world.transports.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.transports.find(x => (x.name || '').toLowerCase() === lower);
    }
    case 'CRATE': {
      const byId = world.crates.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.crates.find(x => (x.crateCode || '').toLowerCase() === lower);
    }
    case 'PERSON': {
      const byId = world.people.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.people.find(x => (x.name || '').toLowerCase() === lower);
    }
    case 'MISSION': {
      const byId = world.missions.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.missions.find(x => (x.code || '').toLowerCase() === lower);
    }
    case 'INVENTORY': {
      const byId = world.inventory.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.inventory.find(x => `${x.itemCode}:${x.station}`.toLowerCase() === lower);
    }
    case 'ASSET': {
      const byId = world.assets.find(x => idOf(x) === target);
      if (byId) return byId;
      return world.assets.find(x => (x.assetCode || '').toLowerCase() === lower);
    }
  }
}

function describe(ctx: Ctx, type: EntityKind, e: any): { code: string; label: string; info: string[]; todayStatus: HealthLevel | null; todayText?: string } {
  const { analysis, currentDate, world } = ctx;
  switch (type) {
    case 'TRANSPORT': {
      const next = (e.schedule || []).find((s: any) => s.status !== 'DEPARTED' && s.status !== 'ARRIVED');
      const crates = world.crates.filter(c => c.carrierTransportId === idOf(e) && c.status !== 'RECEIVED_STATION').length;
      const people = world.people.filter(p => p.inboundTransportId === idOf(e)).length;
      return {
        code: e.name,
        label: `${e.type?.toLowerCase()} · ${e.currentLocation || ''}`,
        info: [
          next ? `Next stop: ${next.portOrStation} on ${fmt(getEffectiveArrival(next))}` : 'No remaining stops',
          `Carrying ${crates} crate${crates === 1 ? '' : 's'} and ${people} ${people === 1 ? 'person' : 'people'}`
        ],
        todayStatus: 'OK'
      };
    }
    case 'CRATE': {
      const eta = analysis.crateEta.get(idOf(e));
      let todayStatus: HealthLevel = 'OK';
      let todayText = 'On schedule';
      if (e.status === 'RECEIVED_STATION') todayText = 'Already delivered';
      else if (eta?.missed) { todayStatus = 'BLOCKED'; todayText = 'Missed its connection'; }
      else if (eta?.eta) {
        const slack = calDays(eta.eta, e.requiredByDate);
        if (slack < 0) { todayStatus = 'AT_RISK'; todayText = `${dayWord(-slack)} late`; }
        else if (slack < 3) { todayStatus = 'WATCH'; todayText = `Only ${dayWord(slack)} slack`; }
        else todayText = `${dayWord(slack)} slack`;
      }
      return {
        code: e.crateCode,
        label: e.title,
        info: [
          `To ${station(e.destinationStation)} · ETA ${fmt(eta?.eta)} · needed by ${fmt(e.requiredByDate)}`,
          `${e.weightKg} kg${e.hazardous ? ` · hazardous (${e.hazardClass})` : ''}${e.loadedOnCarrier ? ' · loaded' : ''}`
        ],
        todayStatus,
        todayText
      };
    }
    case 'PERSON': {
      const r = e.readiness || {};
      const missing = [!r.medicalCleared && 'medical', !r.auliTrainingCompleted && 'training', !r.passportValid && 'passport', !r.polarPermitIssued && 'permit'].filter(Boolean);
      const arr = personArrival(e, analysis.transportsById);
      return {
        code: e.name,
        label: e.role,
        info: [
          e.currentLocation === e.destinationLocation ? `At ${station(e.currentLocation)}` : `${station(e.currentLocation)} → ${station(e.destinationLocation)}${arr ? `, arrives ${fmt(arr)}` : ''}`,
          missing.length ? `Not cleared: ${missing.join(', ')}` : 'Cleared to deploy'
        ],
        todayStatus: missing.length ? 'AT_RISK' : 'OK',
        todayText: missing.length ? `Missing ${missing.join(', ')}` : 'Ready'
      };
    }
    case 'MISSION': {
      const m = analysis.missions.get(idOf(e));
      const top = m?.reasons.slice().sort((a, b) => ['OK', 'WATCH', 'AT_RISK', 'BLOCKED'].indexOf(b.level) - ['OK', 'WATCH', 'AT_RISK', 'BLOCKED'].indexOf(a.level))[0];
      return {
        code: e.code,
        label: e.title,
        info: [
          `${station(e.station)} · ${fmt(e.startDate)}–${fmt(e.endDate)} · priority ${e.priority}`,
          `${(e.peopleIds || []).length} crew · ${(e.assetIds || []).length} equipment · ${(e.crateIds || []).length} cargo`
        ],
        todayStatus: m?.level ?? null,
        todayText: top?.text || 'No issues today'
      };
    }
    case 'INVENTORY': {
      const fuel = analysis.fuel.get(e.station);
      const isTracked = fuel && idOf(fuel.item) === idOf(e);
      const f = isTracked ? fuel!.forecast : null;
      const lvl: HealthLevel = f?.marginDays !== null && f?.marginDays !== undefined
        ? (f.marginDays < 0 ? 'AT_RISK' : f.marginDays < 3 ? 'WATCH' : 'OK')
        : e.quantity <= e.minimumLevel ? 'WATCH' : 'OK';
      return {
        code: `${e.itemCode} · ${station(e.station)}`,
        label: e.name,
        info: [
          `${Math.round(e.quantity).toLocaleString('en-IN')} ${e.unit} on hand · minimum ${Math.round(e.minimumLevel).toLocaleString('en-IN')}`,
          f ? `Hits minimum ${fmt(f.minBreachDate)} · resupply ${fmt(f.nextResupplyDate)}${f.marginDays !== null ? ` (${f.marginDays < 0 ? `short ${dayWord(-f.marginDays)}` : `${dayWord(f.marginDays)} spare`})` : ''}` : `Uses about ${e.dailyBurnRate || 0} ${e.unit}/day`
        ],
        todayStatus: lvl,
        todayText: f?.marginDays !== null && f?.marginDays !== undefined ? `${f.marginDays} days spare before resupply` : undefined
      };
    }
    case 'ASSET': {
      const st = assetEffectiveStatus(e, currentDate);
      return {
        code: e.assetCode,
        label: e.name,
        info: [
          `${station(e.location)} · criticality ${e.criticality}`,
          st === 'MAINTENANCE_DUE' ? `Service overdue since ${fmt(e.nextServiceDueDate)}` : st === 'OPERATIONAL' ? `Next service ${fmt(e.nextServiceDueDate)}` : `Status: ${st.toLowerCase().replace('_', ' ')}`
        ],
        todayStatus: st === 'UNDER_REPAIR' || st === 'DECOMMISSIONED' ? 'AT_RISK' : st === 'MAINTENANCE_DUE' ? 'WATCH' : 'OK',
        todayText: st.toLowerCase().replace('_', ' ')
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Substitute discovery
// ---------------------------------------------------------------------------

function missionWindows(ctx: Ctx, missionIds: string[]) {
  const ms = ctx.world.missions.filter(m => missionIds.includes(idOf(m)));
  if (!ms.length) return { from: ctx.currentDate.getTime(), to: ctx.currentDate.getTime() + 60 * DAY_MS, missions: ms };
  return { from: Math.min(...ms.map(m => new Date(m.startDate).getTime())), to: Math.max(...ms.map(m => new Date(m.endDate).getTime())), missions: ms };
}

function assetSubstitutes(ctx: Ctx, asset: any, dependentMissionIds: string[]): Substitute[] {
  const { world, currentDate } = ctx;
  const win = missionWindows(ctx, dependentMissionIds);
  return world.assets
    .filter(a => a !== asset && a.category === asset.category && a.location === asset.location)
    .map(a => {
      const st = assetEffectiveStatus(a, currentDate);
      const busy = world.missions.filter(m => !dependentMissionIds.includes(idOf(m)) && (m.assetIds || []).includes(idOf(a))
        && new Date(m.startDate).getTime() < win.to && new Date(m.endDate).getTime() > win.from);
      const readiness: Substitute['readiness'] = st === 'UNDER_REPAIR' || st === 'DECOMMISSIONED' ? 'NOT_READY' : st === 'MAINTENANCE_DUE' || busy.length ? 'CONDITIONAL' : 'READY';
      return {
        code: a.assetCode,
        label: a.name,
        readiness,
        text: st === 'OPERATIONAL' ? `Operational at ${station(a.location)}.` : st === 'MAINTENANCE_DUE' ? `Usable, but its own service is overdue (since ${fmt(a.nextServiceDueDate)}).` : `Not usable: ${st.toLowerCase().replace('_', ' ')}.`,
        tradeOff: busy.length
          ? `Borrowing it takes it from ${busy.map(m => `${m.code} (priority ${m.priority}, ${fmt(m.startDate)}–${fmt(m.endDate)})`).join(', ')}.`
          : 'Not committed to another mission in that period.'
      };
    })
    .sort((a, b) => ['READY', 'CONDITIONAL', 'NOT_READY'].indexOf(a.readiness) - ['READY', 'CONDITIONAL', 'NOT_READY'].indexOf(b.readiness));
}

function isReady(p: any) {
  const r = p.readiness || {};
  return !!(r.medicalCleared && r.auliTrainingCompleted && r.passportValid && r.polarPermitIssued);
}

function personSubstitutes(ctx: Ctx, person: any, dependentMissionIds: string[]): Substitute[] {
  const { world, analysis } = ctx;
  const win = missionWindows(ctx, dependentMissionIds);
  const targetStation = win.missions[0]?.station || person.destinationLocation;
  const startMs = win.missions.length ? Math.min(...win.missions.map(m => new Date(m.startDate).getTime())) : win.from;
  const out: Substitute[] = [];

  const where = (p: any) => {
    if (p.currentLocation === targetStation) return { ok: true, text: `already at ${station(targetStation)}` };
    const arr = p.destinationLocation === targetStation ? personArrival(p, analysis.transportsById) : null;
    if (arr) return { ok: new Date(arr).getTime() <= startMs, text: `arrives ${station(targetStation)} ${fmt(arr)}` };
    return { ok: false, text: `at ${station(p.currentLocation)} with no booked travel to ${station(targetStation)}` };
  };
  const conflicts = (p: any) => world.missions.filter(m => !dependentMissionIds.includes(idOf(m)) && (m.peopleIds || []).includes(idOf(p))
    && new Date(m.startDate).getTime() < win.to && new Date(m.endDate).getTime() > win.from);

  const standby = person.standbyPersonId ? world.people.find(p => idOf(p) === person.standbyPersonId) : null;
  if (standby) {
    const w = where(standby);
    const c = conflicts(standby);
    out.push({
      code: standby.name,
      label: `Designated standby · ${standby.role}`,
      readiness: isReady(standby) && w.ok && !c.length ? 'READY' : isReady(standby) ? 'CONDITIONAL' : 'NOT_READY',
      text: `${isReady(standby) ? 'Cleared to deploy' : 'Not fully cleared'}; ${w.text}.`,
      tradeOff: c.length ? `Already on ${c.map(m => m.code).join(', ')} in that period.` : w.ok ? 'Can take over directly.' : 'Travel must be booked first.'
    });
  }

  const skills = new Set((person.skills || []).map((s: string) => s.toLowerCase()));
  const onDependent = new Set(win.missions.flatMap(m => m.peopleIds || []));
  const candidates = world.people
    .filter(p => p !== person && p !== standby && isReady(p) && !onDependent.has(idOf(p))
      && (p.destinationLocation === targetStation || p.currentLocation === targetStation)
      && (p.role === person.role || (p.skills || []).some((s: string) => skills.has(s.toLowerCase()))))
    .map(p => ({ p, w: where(p), c: conflicts(p), shared: (p.skills || []).filter((s: string) => skills.has(s.toLowerCase())) }))
    .sort((a, b) => Number(b.w.ok) - Number(a.w.ok) || a.c.length - b.c.length)
    .slice(0, 3);
  for (const { p, w, c, shared } of candidates) {
    out.push({
      code: p.name,
      label: `${p.role}${shared.length ? ` · shares ${shared.join(', ')}` : ' · same role'}`,
      readiness: w.ok && !c.length ? 'READY' : 'CONDITIONAL',
      text: `Cleared; ${w.text}.`,
      tradeOff: c.length ? `Would be pulled from ${c.map(m => `${m.code} (priority ${m.priority})`).join(', ')}.` : 'Not committed to another mission in that period.'
    });
  }
  return out;
}

function crateSubstitutes(ctx: Ctx, crate: any): Substitute[] {
  const { world, analysis, currentDate } = ctx;
  const carrier = analysis.transportsById[crate.carrierTransportId];
  if (crate.loadedOnCarrier) {
    return [{ code: 'Re-routing', label: 'Send it another way', readiness: 'NOT_READY', text: `Already loaded aboard ${carrier?.name || 'its carrier'}; it cannot be moved to another transport en route.` }];
  }
  const dest = (crate.destinationStation || '').toLowerCase().slice(0, 5);
  return world.transports
    .filter(t => idOf(t) !== crate.carrierTransportId)
    .map(t => {
      const stops = [...(t.schedule || [])].sort((a: any, b: any) => a.stopNumber - b.stopNumber);
      const unload = stops.find((s: any) => s.portOrStation?.toLowerCase().includes(dest));
      const board = unload && stops.find((s: any) => s.stopNumber < unload.stopNumber && new Date(getEffectiveDeparture(s) || 0).getTime() > currentDate.getTime());
      if (!unload || !board) return null;
      const eta = new Date(new Date(getEffectiveArrival(unload)!).getTime() + (crate.handlingDays ?? 1) * DAY_MS);
      const booked = world.crates.filter(c => c.carrierTransportId === idOf(t)).reduce((s, c) => s + (c.weightKg || 0), 0);
      const spare = (t.capacityKg || 0) - booked;
      const slack = calDays(eta, crate.requiredByDate);
      const fits = spare >= crate.weightKg;
      return {
        code: t.name,
        label: `Leaves ${board.portOrStation} ${fmt(getEffectiveDeparture(board))}`,
        readiness: (fits && slack >= 0 ? 'READY' : fits ? 'CONDITIONAL' : 'NOT_READY') as Substitute['readiness'],
        text: `Delivers by ${fmt(eta)} (${slack >= 0 ? `${dayWord(slack)} before` : `${dayWord(-slack)} after`} the ${fmt(crate.requiredByDate)} deadline). ${Math.max(0, Math.round(spare)).toLocaleString('en-IN')} kg spare for a ${crate.weightKg} kg crate.`,
        tradeOff: crate.hazardous ? `Hazardous cargo (${crate.hazardClass}) needs dangerous-goods approval for this carrier.` : 'Needs a booking change.'
      } as Substitute;
    })
    .filter(Boolean) as Substitute[];
}

function transportSubstitutes(ctx: Ctx, t: any): Substitute[] {
  const { world, currentDate } = ctx;
  const open = (t.schedule || []).filter((s: any) => s.status !== 'DEPARTED' && s.status !== 'ARRIVED');
  const out: Substitute[] = [];
  for (const other of world.transports) {
    if (other === t || other.currentLocation?.toLowerCase().includes(t.name?.toLowerCase())) continue;
    for (const s of open) {
      const key = (s.portOrStation || '').toLowerCase().split(' ')[0];
      const match = (other.schedule || []).find((o: any) => o.portOrStation?.toLowerCase().includes(key) && new Date(getEffectiveArrival(o) || 0).getTime() > currentDate.getTime());
      if (!match) continue;
      const booked = world.crates.filter(c => c.carrierTransportId === idOf(other)).reduce((sum, c) => sum + (c.weightKg || 0), 0);
      const seats = (other.passengerSeats || 0) - world.people.filter(p => p.inboundTransportId === idOf(other)).length;
      out.push({
        code: other.name,
        label: `Also reaches ${match.portOrStation} on ${fmt(getEffectiveArrival(match))}`,
        readiness: 'CONDITIONAL',
        text: `${Math.max(0, Math.round(((other.capacityKg || 0) - booked) / 1000))} t cargo and ${Math.max(0, seats)} seats free.`,
        tradeOff: 'Much smaller than the original carrier — only the most critical cargo and people could switch.'
      });
      break;
    }
  }
  return out;
}

function inventorySubstitutes(ctx: Ctx, item: any): Substitute[] {
  return ctx.world.inventory
    .filter(i => i !== item && i.itemCode === item.itemCode)
    .map(i => {
      const surplus = i.quantity - i.minimumLevel;
      return {
        code: `${i.itemCode} · ${station(i.station)}`,
        label: i.name,
        readiness: (surplus > 0 ? 'CONDITIONAL' : 'NOT_READY') as Substitute['readiness'],
        text: surplus > 0 ? `${Math.round(surplus).toLocaleString('en-IN')} ${i.unit} above its own minimum at ${station(i.station)}.` : `No surplus at ${station(i.station)}.`,
        tradeOff: 'Needs a transport between stations; the other station’s own margin shrinks.'
      };
    });
}

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

export async function computeBlastRadius(rawType: string, id: string, maxDepth = 5): Promise<BlastResult> {
  const type = (rawType.toUpperCase() === 'CARGO' ? 'CRATE' : rawType.toUpperCase()) as EntityKind;
  const currentDate = now();
  const world = await fetchWorldSnapshot();
  const analysis = analyseWorld(world, currentDate, emptyContext());
  const ctx: Ctx = { world, analysis, currentDate };

  const rootEntity = findEntity(ctx, type, id);
  if (!rootEntity) throw new Error(`${type} ${id} not found`);

  const edges = world.edges.filter(e => e.relationType !== 'BACKUP_FOR');
  const nodes = new Map<string, BlastNode>();
  const links: BlastLink[] = [];
  const linkSet = new Set<string>();
  const addLink = (l: BlastLink) => {
    const k = `${l.from}>${l.to}`;
    if (l.from === l.to || linkSet.has(k)) return;
    linkSet.add(k);
    links.push(l);
  };

  const make = (t: EntityKind, entity: any, tier: number, parentKey: string | null, viaRelation: string | null, effect: Effect, effectText: string): BlastNode => {
    const d = describe(ctx, t, entity);
    return { key: keyOf(t, idOf(entity)), type: t, id: idOf(entity), ref: refOf(t, entity), code: d.code, label: d.label, tier, parentKey, viaRelation, effect, effectText, info: d.info, todayStatus: d.todayStatus, todayText: d.todayText, toleranceDays: null, substitutes: [] };
  };

  const root = make(type, rootEntity, 0, null, null, 'ROOT', `If this ${FAILURE_VERB[type]}`);
  nodes.set(root.key, root);

  // 1. Cascade: follow dependents (incoming edges), breadth first.
  const queue: BlastNode[] = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.tier >= maxDepth || cur.type === 'GROUP') continue;
    if (cur.type === 'MISSION') continue; // a mission's consequences are its idle crew/equipment (step 2)
    for (const e of edges) {
      if (e.targetType !== cur.type || e.targetId !== cur.id) continue;
      const childKey = keyOf(e.sourceType, e.sourceId);
      if (nodes.has(childKey)) {
        addLink({ from: cur.key, to: childKey, relation: e.relationType, label: RELATION_LABEL[e.relationType] || e.relationType, kind: 'ALSO' });
        continue;
      }
      const ent = findEntity(ctx, e.sourceType, e.sourceId);
      if (!ent) continue;
      if (e.sourceType === 'MISSION' && ent.status !== 'PLANNED' && ent.status !== 'IN_PROGRESS') continue;
      const { effect, text } = effectFor(e.relationType, e.sourceType, cur, world);
      const child = make(e.sourceType, ent, cur.tier + 1, cur.key, e.relationType, effect, text);
      nodes.set(childKey, child);
      addLink({ from: cur.key, to: childKey, relation: e.relationType, label: RELATION_LABEL[e.relationType] || e.relationType, kind: 'CASCADE' });
      queue.push(child);
    }
  }

  // 1b. A mission reached along several paths keeps every cause; the strongest one leads.
  const EFFECT_RANK: Record<string, number> = { BLOCKED: 5, NO_EQUIPMENT: 4, FUEL_SHORT: 3, SHORT_CREW: 2 };
  for (const m of nodes.values()) {
    if (m.type !== 'MISSION' || m.tier === 0) continue;
    const causes = links
      .filter(l => l.to === m.key)
      .map(l => ({ link: l, from: nodes.get(l.from)!, ...effectFor(l.relation, 'MISSION', nodes.get(l.from)!, world) }))
      .sort((a, b) => (EFFECT_RANK[b.effect] || 0) - (EFFECT_RANK[a.effect] || 0));
    const lead = causes.find(c => c.from.tier === m.tier - 1) || causes[0];
    for (const c of causes) c.link.kind = c === lead ? 'CASCADE' : 'ALSO';
    m.parentKey = lead.from.key;
    m.viaRelation = lead.link.relation;
    m.effect = causes[0].effect;
    m.effectText = Array.from(new Set(causes.map(c => c.text))).join('; ');
    m.causes = causes.map(c => ({ fromKey: c.from.key, code: c.from.code, relation: c.link.relation, text: c.text, toleranceDays: null }));
  }

  // 1c. Tolerance: how many days a delayed trigger (transport or cargo) can slip before each node breaks.
  if (type === 'TRANSPORT' || type === 'CRATE') {
    const fuelMargin = (itemId: string) => {
      const item = world.inventory.find(i => idOf(i) === itemId);
      const f = item && analysis.fuel.get(item.station);
      return f && idOf(f.item) === itemId ? f.forecast.marginDays : null;
    };
    const minOf = (xs: Array<number | null>) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.min(...v) : null;
    };
    // Missions last: their tolerance is the minimum over every path that reaches them.
    const ordered = Array.from(nodes.values()).sort((a, b) => Number(a.type === 'MISSION') - Number(b.type === 'MISSION') || a.tier - b.tier);
    for (const n of ordered) {
      if (n.tier === 0 && type !== 'CRATE') continue;
      const ent = findEntity(ctx, n.type as EntityKind, n.id);
      if (n.type === 'CRATE') {
        if (ent.linkedMissionId) {
          const eta = analysis.crateEta.get(n.id)?.eta;
          n.toleranceDays = eta ? calDays(eta, ent.requiredByDate) : null;
        } else if (ent.resupplies?.inventoryItemId) {
          n.toleranceDays = fuelMargin(ent.resupplies.inventoryItemId);
        }
      } else if (n.type === 'INVENTORY' && n.effect === 'RESUPPLY_LATE') {
        n.toleranceDays = fuelMargin(n.id);
      } else if (n.type === 'ASSET' && n.effect === 'FUEL_SHORT') {
        n.toleranceDays = n.parentKey ? nodes.get(n.parentKey)?.toleranceDays ?? null : null;
      } else if (n.type === 'MISSION' && n.causes) {
        const mission = ent;
        for (const c of n.causes) {
          const from = nodes.get(c.fromKey)!;
          if (from.type === 'PERSON') {
            const arr = personArrival(findEntity(ctx, 'PERSON', from.id), analysis.transportsById);
            c.toleranceDays = arr ? calDays(arr, mission.startDate) : null;
          } else {
            c.toleranceDays = from.toleranceDays;
          }
        }
        n.toleranceDays = minOf(n.causes.map(c => c.toleranceDays));
      }
    }
    for (const n of nodes.values()) {
      if (n.type !== 'PERSON' || n.effect !== 'DELAYED') continue;
      n.toleranceDays = minOf(Array.from(nodes.values())
        .filter(m => m.type === 'MISSION')
        .flatMap(m => (m.causes || []).filter(c => c.fromKey === n.key).map(c => c.toleranceDays)));
    }
  }

  // 2. Missions that are hit leave their other crew and equipment idle.
  const hitMissions = Array.from(nodes.values()).filter(n => n.type === 'MISSION');
  if (type === 'MISSION') hitMissions.push(root);
  for (const m of hitMissions) {
    const mission = findEntity(ctx, 'MISSION', m.id);
    const needs = [
      ...(mission.peopleIds || []).map((pid: string) => ['PERSON', pid] as const),
      ...(mission.assetIds || []).map((aid: string) => ['ASSET', aid] as const)
    ];
    for (const [t, eid] of needs) {
      const k = keyOf(t, eid);
      if (nodes.has(k)) {
        if (k !== m.key && nodes.get(k)!.tier > 0) addLink({ from: m.key, to: k, relation: 'IDLE', label: 'left idle', kind: 'ALSO' });
        continue;
      }
      const ent = findEntity(ctx, t, eid);
      if (!ent) continue;
      const idle = make(t, ent, m.tier + 1, m.key, 'IDLE', 'IDLE', t === 'PERSON' ? `Stranded — ${m.code} cannot proceed` : `Idle — ${m.code} cannot proceed`);
      nodes.set(k, idle);
      addLink({ from: m.key, to: k, relation: 'IDLE', label: 'left idle', kind: 'IDLE' });
    }
  }

  // 3. Substitutes for compromised assets, people, cargo, transport and stock.
  const dependentMissions = (n: BlastNode) => links.filter(l => l.from === n.key && nodes.get(l.to)?.type === 'MISSION' && l.kind !== 'IDLE').map(l => nodes.get(l.to)!.id);
  for (const n of nodes.values()) {
    const ent = n.type !== 'GROUP' ? findEntity(ctx, n.type as EntityKind, n.id) : null;
    if (!ent) continue;
    const onMissions = dependentMissions(n);
    if (n.type === 'ASSET' && (n.effect === 'ROOT' || onMissions.length)) n.substitutes = assetSubstitutes(ctx, ent, onMissions);
    else if (n.type === 'PERSON' && (n.effect === 'ROOT' || onMissions.length)) n.substitutes = personSubstitutes(ctx, ent, onMissions);
    else if (n.type === 'CRATE' && (n.effect === 'ROOT' || onMissions.length)) n.substitutes = crateSubstitutes(ctx, ent);
    else if (n.type === 'TRANSPORT' && n.effect === 'ROOT') n.substitutes = transportSubstitutes(ctx, ent);
    else if (n.type === 'INVENTORY' && (n.effect === 'ROOT' || n.effect === 'RESUPPLY_LATE')) n.substitutes = inventorySubstitutes(ctx, ent);
  }

  // 4. Collapse long lists of leaf nodes that lead nowhere into one group per parent.
  const hasChildren = (k: string) => links.some(l => l.from === k);
  const byParent = new Map<string, BlastNode[]>();
  for (const n of nodes.values()) {
    if (!n.parentKey || n.type === 'MISSION' || hasChildren(n.key) || n.substitutes.length) continue;
    const g = `${n.parentKey}|${n.type}|${n.effect}`;
    byParent.set(g, [...(byParent.get(g) || []), n]);
  }
  for (const [g, members] of byParent) {
    if (members.length <= GROUP_THRESHOLD) continue;
    const [parentKey, memberType, effect] = g.split('|');
    const noun = memberType === 'PERSON' ? 'people' : memberType === 'CRATE' ? 'crates' : memberType === 'ASSET' ? 'assets' : 'items';
    const groupKey = `GROUP:${g}`;
    const first = members[0];
    nodes.set(groupKey, {
      key: groupKey,
      type: 'GROUP',
      id: groupKey,
      ref: groupKey,
      code: `${members.length} ${noun}`,
      label: effect === 'IDLE' ? 'left idle' : 'no mission depends on them',
      tier: first.tier,
      parentKey,
      viaRelation: first.viaRelation,
      effect: effect as Effect,
      effectText: first.effectText,
      info: [effect === 'IDLE' ? 'Left idle while the mission cannot proceed.' : 'Held up, but no mission or stock depends on them.'],
      todayStatus: null,
      toleranceDays: null,
      substitutes: [],
      group: { memberType: memberType as EntityKind, members: members.map(m => ({ key: m.key, code: m.code, label: m.label, info: m.info[0] })) }
    });
    const memberKeys = new Set(members.map(m => m.key));
    for (const m of members) nodes.delete(m.key);
    for (let i = links.length - 1; i >= 0; i--) {
      if (memberKeys.has(links[i].to) || memberKeys.has(links[i].from)) links.splice(i, 1);
    }
    addLink({ from: parentKey, to: groupKey, relation: first.viaRelation || '', label: RELATION_LABEL[first.viaRelation || ''] || (effect === 'IDLE' ? 'left idle' : ''), kind: effect === 'IDLE' ? 'IDLE' : 'CASCADE' });
  }

  // 5. Domino chains: root → … → each mission (and each end asset with no mission).
  const pathTo = (k: string) => {
    const steps: DominoChain['steps'] = [];
    let cur = nodes.get(k);
    while (cur) {
      steps.unshift({ key: cur.key, code: cur.code, effectText: cur.effect === 'ROOT' ? FAILURE_VERB[type] : cur.effectText });
      cur = cur.parentKey ? nodes.get(cur.parentKey) : undefined;
    }
    return steps;
  };
  const chains: DominoChain[] = [];
  const idleOf = (missionKey: string) => {
    const idle = links.filter(l => l.from === missionKey && l.relation === 'IDLE').map(l => nodes.get(l.to)!).filter(Boolean);
    const people = idle.reduce((s, x) => s + (x.type === 'PERSON' ? 1 : x.group?.memberType === 'PERSON' ? x.group.members.length : 0), 0);
    const assets = idle.reduce((s, x) => s + (x.type === 'ASSET' ? 1 : x.group?.memberType === 'ASSET' ? x.group.members.length : 0), 0);
    return people || assets ? `${people} crew stranded, ${assets} equipment idle` : 'mission affected';
  };
  for (const n of nodes.values()) {
    if (n.type === 'MISSION' && n.tier > 0) {
      const m = findEntity(ctx, 'MISSION', n.id);
      for (const c of n.causes || []) {
        chains.push({
          steps: [...pathTo(c.fromKey), { key: n.key, code: n.code, effectText: c.text }],
          endsIn: idleOf(n.key),
          priority: m?.priority ?? null,
          toleranceDays: c.toleranceDays
        });
      }
    } else if (n.type === 'ASSET' && n.effect !== 'IDLE' && !links.some(l => l.from === n.key && nodes.get(l.to)?.type === 'MISSION')) {
      chains.push({ steps: pathTo(n.key), endsIn: 'no mission lists it, but station operations rely on it', priority: null, toleranceDays: n.toleranceDays });
    }
  }
  if (type === 'MISSION') chains.push({ steps: pathTo(root.key), endsIn: idleOf(root.key), priority: rootEntity.priority, toleranceDays: null });
  const tol = (c: DominoChain) => (c.toleranceDays === null ? 9999 : c.toleranceDays);
  chains.sort((a, b) => tol(a) - tol(b) || (a.priority ?? 9) - (b.priority ?? 9) || a.steps.length - b.steps.length);

  // 6. Summary and headline.
  const all = Array.from(nodes.values()).filter(n => n.tier > 0);
  const count = (pred: (n: BlastNode) => boolean, memberType?: EntityKind) =>
    all.reduce((s, n) => s + (n.type === 'GROUP' ? (n.group!.memberType === memberType && pred(n) ? n.group!.members.length : 0) : pred(n) ? 1 : 0), 0);
  const missions = all.filter(n => n.type === 'MISSION').map(n => {
    const m = findEntity(ctx, 'MISSION', n.id);
    return { code: n.code, title: n.label, priority: m.priority, station: m.station, start: m.startDate, effectText: n.effectText, todayStatus: n.todayStatus, toleranceDays: n.toleranceDays };
  }).sort((a, b) => (a.toleranceDays ?? 9999) - (b.toleranceDays ?? 9999) || a.priority - b.priority);

  const summary: BlastResult['summary'] = {
    byTier: [],
    missions,
    cratesHeld: count(n => n.type === 'CRATE' || (n.type === 'GROUP' && n.group!.memberType === 'CRATE'), 'CRATE'),
    peopleDelayed: count(n => (n.type === 'PERSON' || n.type === 'GROUP') && n.effect === 'DELAYED', 'PERSON'),
    peopleIdle: count(n => (n.type === 'PERSON' || n.type === 'GROUP') && n.effect === 'IDLE', 'PERSON'),
    assetsAffected: count(n => n.type === 'ASSET' && n.effect !== 'IDLE'),
    assetsIdle: count(n => (n.type === 'ASSET' || n.type === 'GROUP') && n.effect === 'IDLE', 'ASSET'),
    stocksAffected: count(n => n.type === 'INVENTORY'),
    substitutesFound: Array.from(nodes.values()).reduce((s, n) => s + n.substitutes.filter(x => x.readiness !== 'NOT_READY').length, 0)
  };
  const maxTier = Math.max(0, ...Array.from(nodes.values()).map(n => n.tier));
  const TIER_LABEL = ['Trigger', '1st degree', '2nd degree', '3rd degree', '4th degree', '5th degree', '6th degree'];
  for (let t = 1; t <= maxTier; t++) {
    summary.byTier.push({ tier: t, label: TIER_LABEL[t] || `${t}th degree`, count: all.filter(n => n.tier === t).reduce((s, n) => s + (n.group ? n.group.members.length : 1), 0) });
  }

  const parts: string[] = [];
  if (summary.cratesHeld) parts.push(`${summary.cratesHeld} crate${summary.cratesHeld === 1 ? '' : 's'} held up`);
  if (summary.peopleDelayed) parts.push(`${summary.peopleDelayed} ${summary.peopleDelayed === 1 ? 'person arrives' : 'people arrive'} late`);
  if (summary.stocksAffected) parts.push(`${summary.stocksAffected} supply stock${summary.stocksAffected === 1 ? '' : 's'} resupplied late`);
  if (summary.assetsAffected) parts.push(`${summary.assetsAffected} machine${summary.assetsAffected === 1 ? '' : 's'} exposed`);
  if (missions.length) parts.push(`${missions.length} mission${missions.length === 1 ? ' depends' : 's depend'} on it (${missions.map(m => `${m.code} P${m.priority}`).join(', ')})`);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (summary.peopleIdle || summary.assetsIdle) parts.push(`${plural(summary.peopleIdle, 'person', 'people')} and ${plural(summary.assetsIdle, 'machine', 'machines')} left idle`);
  let headline = parts.length
    ? `If ${root.code} ${FAILURE_VERB[type]}: ${parts.join('; ')}.`
    : root.type === 'ASSET'
      ? `No mission lists ${root.code} directly, but station operations rely on it. ${root.substitutes.filter(s => s.readiness !== 'NOT_READY').length} possible backup(s) found.`
      : `If ${root.code} ${FAILURE_VERB[type]}, nothing else in the plan depends on it.`;
  const firstBreak = chains.find(c => c.toleranceDays !== null);
  if (firstBreak) {
    const last = firstBreak.steps[firstBreak.steps.length - 1];
    headline += firstBreak.toleranceDays! < 0
      ? ` ${last.code} is already ${dayWord(-firstBreak.toleranceDays!)} late today.`
      : ` First to break: ${last.code}, after ${dayWord(firstBreak.toleranceDays!)} of delay.`;
  }

  return {
    generatedAt: currentDate.toISOString(),
    root,
    failureVerb: FAILURE_VERB[type],
    headline,
    nodes: Array.from(nodes.values()),
    links,
    maxTier,
    summary,
    chains
  };
}

export async function listBlastCatalog() {
  const world = await fetchWorldSnapshot();
  const active = (m: any) => m.status === 'PLANNED' || m.status === 'IN_PROGRESS';
  return {
    TRANSPORT: world.transports.map(t => ({ id: idOf(t), ref: t.name, code: t.name, label: t.type })),
    CRATE: world.crates.filter(c => c.status !== 'RECEIVED_STATION').map(c => ({ id: idOf(c), ref: c.crateCode, code: c.crateCode, label: c.title })),
    ASSET: world.assets.map(a => ({ id: idOf(a), ref: a.assetCode, code: a.assetCode, label: a.name })),
    INVENTORY: world.inventory.map(i => ({ id: idOf(i), ref: `${i.itemCode}:${i.station}`, code: `${i.itemCode} · ${station(i.station)}`, label: i.name })),
    PERSON: world.people
      .filter(p => world.missions.some(m => active(m) && (m.peopleIds || []).includes(idOf(p))) || world.people.some(x => x.standbyPersonId === idOf(p)))
      .map(p => ({ id: idOf(p), ref: p.name, code: p.name, label: p.role })),
    MISSION: world.missions.filter(active).map(m => ({ id: idOf(m), ref: m.code, code: m.code, label: m.title }))
  };
}
