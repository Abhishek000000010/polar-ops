import crypto from 'crypto';
import { now } from '../../core/clock';
import { appendEvent } from '../../core/events';
import { InventoryItemModel } from '../inventory/model';
import { recordTransaction } from '../inventory/service';
import { AssetModel } from '../assets/model';
import { updateAsset } from '../assets/service';
import { CrateModel } from '../cargo/model';
import { PersonModel } from '../people/model';
import { updateReadiness } from '../people/service';
import { IncidentModel } from '../incidents/model';
import { addIncidentAction } from '../incidents/service';
import { SyncReceiptModel, SyncConflictModel } from './model';
import { NodeId, LinkState, Constellation, SyncNode, FieldAction, ApplyResult, PushRequest } from './types';

// Transport metadata (captured/received times) uses wall-clock time: it describes the real
// radio link, not the simulated expedition calendar. Domain changes go through the services,
// which stamp them with the simulation clock.
const wallNow = () => new Date().toISOString();

// Approximate usable uplink per constellation and link state (kbit/s).
const UPLINK_KBPS: Record<Constellation, Record<LinkState, number>> = {
  IRIDIUM_CERTUS: { ONLINE: 352, DEGRADED: 22, BLACKOUT: 0 },
  STARLINK_POLAR: { ONLINE: 5000, DEGRADED: 400, BLACKOUT: 0 },
  INMARSAT_FLEET: { ONLINE: 432, DEGRADED: 64, BLACKOUT: 0 }
};
const LATENCY_MS: Record<Constellation, Record<LinkState, number>> = {
  IRIDIUM_CERTUS: { ONLINE: 650, DEGRADED: 1800, BLACKOUT: 0 },
  STARLINK_POLAR: { ONLINE: 90, DEGRADED: 400, BLACKOUT: 0 },
  INMARSAT_FLEET: { ONLINE: 700, DEGRADED: 1500, BLACKOUT: 0 }
};

function makeNode(id: NodeId, name: string, role: SyncNode['role'], location: string, link: LinkState, constellation: Constellation): SyncNode {
  return { id, name, role, location, link, constellation, uplinkKbps: UPLINK_KBPS[constellation][link], latencyMs: LATENCY_MS[constellation][link], lastContactAt: null };
}

const defaultNodes = (): Record<NodeId, SyncNode> => ({
  GOA_HQ: makeNode('GOA_HQ', 'NCPOR Goa (HQ)', 'HUB', 'Goa, India', 'ONLINE', 'STARLINK_POLAR'),
  BHARATI: makeNode('BHARATI', 'Bharati Station', 'STATION', 'Larsemann Hills, 69°S', 'ONLINE', 'IRIDIUM_CERTUS'),
  MAITRI: makeNode('MAITRI', 'Maitri Station', 'STATION', 'Schirmacher Oasis, 70°S', 'DEGRADED', 'INMARSAT_FLEET'),
  VESSEL_VASILY_GOLOVNIN: makeNode('VESSEL_VASILY_GOLOVNIN', 'MV Vasily Golovnin', 'SHIP', 'Southern Ocean, en route', 'BLACKOUT', 'IRIDIUM_CERTUS')
});

let nodes = defaultNodes();

export class LinkDownError extends Error {}

// ---------------------------------------------------------------------------
// Integrity: canonical JSON + SHA-256 (the browser computes the same thing)
// ---------------------------------------------------------------------------

export function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function actionHash(a: FieldAction): string {
  const { sha256: _omit, ...rest } = a;
  return sha256(canonicalJson(rest));
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export async function getSyncStatus() {
  const [receipts, openConflicts, resolvedConflicts, counts] = await Promise.all([
    SyncReceiptModel.find().sort({ receivedAt: -1 }).limit(60).lean(),
    SyncConflictModel.find({ status: 'OPEN' }).sort({ createdAt: -1 }).lean(),
    SyncConflictModel.find({ status: 'RESOLVED' }).sort({ resolvedAt: -1 }).limit(10).lean(),
    SyncReceiptModel.aggregate([{ $group: { _id: '$result', n: { $sum: 1 }, dup: { $sum: '$duplicateHits' } } }])
  ]);
  const byResult = Object.fromEntries(counts.map((c: any) => [c._id, c.n]));
  const duplicates = counts.reduce((s: number, c: any) => s + (c.dup || 0), 0);
  return {
    nodes: Object.values(nodes),
    receipts,
    openConflicts,
    resolvedConflicts,
    totals: {
      applied: byResult.APPLIED || 0,
      merged: byResult.MERGED || 0,
      duplicates,
      conflicts: byResult.CONFLICT || 0,
      rejected: byResult.REJECTED || 0
    }
  };
}

export function setLink(nodeId: NodeId, link: LinkState, constellation?: Constellation) {
  const node = nodes[nodeId];
  if (!node) throw new Error(`Node ${nodeId} not found`);
  node.link = link;
  if (constellation) node.constellation = constellation;
  node.uplinkKbps = UPLINK_KBPS[node.constellation][link];
  node.latencyMs = LATENCY_MS[node.constellation][link];
  return node;
}

export async function resetSync() {
  nodes = defaultNodes();
  await Promise.all([SyncReceiptModel.deleteMany({}), SyncConflictModel.deleteMany({})]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Push: verify, de-duplicate, merge, record
// ---------------------------------------------------------------------------

interface Outcome { result: ApplyResult; message: string; conflictIds: string[] }

export async function pushBatch(req: PushRequest) {
  const node = nodes[req.nodeId];
  if (!node) throw new Error(`Node ${req.nodeId} not found`);
  if (node.link === 'BLACKOUT') throw new LinkDownError(`${node.name} has no satellite link — the batch stays in the outbox.`);
  const actions = Array.isArray(req.actions) ? req.actions : [];

  const expectedBatch = sha256(actions.map(a => a.sha256).join(''));
  const batchIntact = expectedBatch === req.batchSha256;

  const results: Array<Outcome & { actionId: string }> = [];
  for (const a of actions) {
    const existing = await SyncReceiptModel.findOne({ actionId: a.id }).lean();
    if (existing) {
      await SyncReceiptModel.updateOne({ actionId: a.id }, { $inc: { duplicateHits: 1 } });
      results.push({ actionId: a.id, result: 'DUPLICATE', message: `Already received ${new Date(existing.receivedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC (${existing.result.toLowerCase()}); not applied twice.`, conflictIds: existing.conflictIds || [] });
      continue;
    }
    let outcome: Outcome;
    if (!batchIntact || actionHash(a) !== a.sha256) {
      outcome = { result: 'REJECTED', message: 'Integrity check failed: the content does not match its SHA-256 — it may have been corrupted in transit. Re-send from the station.', conflictIds: [] };
    } else {
      try {
        outcome = await applyAction(a);
      } catch (err: any) {
        outcome = { result: 'REJECTED', message: err.message || 'Could not apply', conflictIds: [] };
      }
    }
    await SyncReceiptModel.create({
      actionId: a.id, nodeId: req.nodeId, kind: a.kind, targetCode: a.target?.code || '?',
      result: outcome.result, message: outcome.message, conflictIds: outcome.conflictIds,
      capturedAt: a.capturedAt, receivedAt: wallNow(), actor: a.actor, bytes: Buffer.byteLength(canonicalJson(a))
    });
    results.push({ actionId: a.id, ...outcome });
  }

  node.lastContactAt = wallNow();
  return { nodeId: req.nodeId, batchIntact, receivedAt: node.lastContactAt, results };
}

const norm = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : v ?? null);

/** Three-way merge per field: base (what the station saw), local (station's new value), remote (server now). */
function threeWay(change: Record<string, any>, base: Record<string, any>, current: Record<string, any>) {
  const apply: Record<string, any> = {};
  const same: string[] = [];
  const conflicts: Array<{ field: string; base: any; local: any; remote: any }> = [];
  for (const [field, local] of Object.entries(change)) {
    const b = norm(base[field]);
    const l = norm(local);
    const r = norm(current[field]);
    if (l === r) same.push(field);
    else if (r === b) apply[field] = local;
    else conflicts.push({ field, base: base[field] ?? null, local, remote: current[field] ?? null });
  }
  return { apply, same, conflicts };
}

async function recordConflicts(a: FieldAction, targetType: string, targetId: string, list: Array<{ field: string; base: any; local: any; remote: any }>) {
  const ids: string[] = [];
  for (const c of list) {
    const conflictId = `cnf-${crypto.randomBytes(4).toString('hex')}`;
    await SyncConflictModel.create({
      conflictId, actionId: a.id, nodeId: a.nodeId, actor: a.actor, targetType, targetCode: a.target.code, targetId,
      field: c.field, base: c.base, local: c.local, remote: c.remote, capturedAt: a.capturedAt, createdAt: wallNow(), status: 'OPEN'
    });
    ids.push(conflictId);
  }
  return ids;
}

const label = (f: string) => f.replace(/([A-Z])/g, ' $1').toLowerCase();
const show = (v: any) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v));

async function applyAction(a: FieldAction): Promise<Outcome> {
  const via = `recorded offline at ${nodes[a.nodeId]?.name || a.nodeId} by ${a.actor}`;
  switch (a.kind) {
    case 'STOCK_USED': {
      const item = await InventoryItemModel.findOne({ itemCode: a.target.code, station: a.target.station });
      if (!item) return { result: 'REJECTED', message: `${a.target.code} is not stocked at ${a.target.station}.`, conflictIds: [] };
      const qty = Number(a.change.quantity);
      if (!(qty > 0)) return { result: 'REJECTED', message: 'Quantity must be positive.', conflictIds: [] };
      await recordTransaction(item._id.toString(), 'USED', qty, `${a.note || 'Field usage'} (${via})`, undefined, a.actor);
      return { result: 'MERGED', message: `−${qty.toLocaleString('en-IN')} ${item.unit} added to the ledger alongside any other use recorded meanwhile (usage always adds up; no conflict possible).`, conflictIds: [] };
    }
    case 'STOCK_COUNT': {
      const item = await InventoryItemModel.findOne({ itemCode: a.target.code, station: a.target.station });
      if (!item) return { result: 'REJECTED', message: `${a.target.code} is not stocked at ${a.target.station}.`, conflictIds: [] };
      const { apply, same, conflicts } = threeWay({ quantity: Number(a.change.quantity) }, a.base, { quantity: item.quantity });
      if (conflicts.length) {
        const ids = await recordConflicts(a, 'INVENTORY', item._id.toString(), conflicts);
        return { result: 'CONFLICT', message: `Station counted ${show(a.change.quantity)} ${item.unit}, but the stock changed from ${show(a.base.quantity)} to ${show(item.quantity)} at HQ since the count was taken. Needs review.`, conflictIds: ids };
      }
      if (same.length) return { result: 'APPLIED', message: `Count matches the ledger (${show(item.quantity)} ${item.unit}); nothing to change.`, conflictIds: [] };
      const delta = Number(apply.quantity) - item.quantity;
      await recordTransaction(item._id.toString(), delta < 0 ? 'USED' : 'RECEIVED', Math.abs(delta), `Stock count correction (${via})`, undefined, a.actor);
      return { result: 'APPLIED', message: `Stock set to ${show(apply.quantity)} ${item.unit} (was ${show(item.quantity)}).`, conflictIds: [] };
    }
    case 'CRATE_EVENT': {
      const crate = await CrateModel.findOne({ crateCode: a.target.code });
      if (!crate) return { result: 'REJECTED', message: `Crate ${a.target.code} not found.`, conflictIds: [] };
      const received = a.change.event === 'RECEIVED';
      const alreadyReceived = crate.status === 'RECEIVED_STATION';
      crate.history.push({
        action: received ? 'RECEIVED' : 'INSPECTED',
        timestamp: now().toISOString(),
        location: a.change.location || nodes[a.nodeId]?.name || a.nodeId,
        details: `${a.note || (received ? 'Received' : 'Inspected')} (${via})`,
        loggedBy: a.actor
      } as any);
      if (received && !alreadyReceived) {
        crate.route.forEach((leg: any) => { leg.status = 'COMPLETED'; leg.completedDate = leg.completedDate || now().toISOString(); });
        crate.currentStageIndex = Math.max(0, crate.route.length - 1);
        crate.status = 'RECEIVED_STATION';
      }
      await crate.save();
      await appendEvent('CARGO', crate._id.toString(), received ? 'RECEIVED_VIA_SYNC' : 'INSPECTED_VIA_SYNC', { nodeId: a.nodeId, actionId: a.id, note: a.note }, a.actor);
      return {
        result: 'MERGED',
        message: received && alreadyReceived
          ? `${crate.crateCode} was already marked received; this scan was added to its history.`
          : `${received ? 'Receipt' : 'Inspection'} appended to ${crate.crateCode}'s history (history only grows, so entries from different sites never clash).`,
        conflictIds: []
      };
    }
    case 'ASSET_UPDATE': {
      const asset = await AssetModel.findOne({ assetCode: a.target.code });
      if (!asset) return { result: 'REJECTED', message: `Asset ${a.target.code} not found.`, conflictIds: [] };
      const current = { status: asset.status, runtimeHours: asset.runtimeHours, lastServiceDate: asset.lastServiceDate, nextServiceDueDate: asset.nextServiceDueDate };
      const allowed = Object.fromEntries(Object.entries(a.change).filter(([k]) => k in current));
      const { apply, same, conflicts } = threeWay(allowed, a.base, current);
      if (Object.keys(apply).length) await updateAsset(asset._id.toString(), apply, `${a.actor} (${nodes[a.nodeId]?.name} sync)`);
      const ids = conflicts.length ? await recordConflicts(a, 'ASSET', asset._id.toString(), conflicts) : [];
      const parts = [
        Object.keys(apply).length ? `applied ${Object.keys(apply).map(label).join(', ')}` : '',
        same.length ? `${same.map(label).join(', ')} already matched` : '',
        conflicts.length ? `${conflicts.map(c => label(c.field)).join(', ')} also changed at HQ — needs review` : ''
      ].filter(Boolean);
      return { result: conflicts.length ? 'CONFLICT' : 'APPLIED', message: `${asset.assetCode}: ${parts.join('; ')}.`, conflictIds: ids };
    }
    case 'READINESS_UPDATE': {
      const person = await PersonModel.findOne({ name: a.target.code });
      if (!person) return { result: 'REJECTED', message: `${a.target.code} not found.`, conflictIds: [] };
      const current = { ...(person.readiness as any)?.toObject?.() ?? person.readiness };
      const allowed = Object.fromEntries(Object.entries(a.change).filter(([k]) => ['medicalCleared', 'auliTrainingCompleted', 'passportValid', 'polarPermitIssued'].includes(k)));
      const { apply, same, conflicts } = threeWay(allowed, a.base, current);
      if (Object.keys(apply).length) await updateReadiness(person._id.toString(), apply, `${a.actor} (${nodes[a.nodeId]?.name} sync)`);
      const ids = conflicts.length ? await recordConflicts(a, 'PERSON', person._id.toString(), conflicts) : [];
      const parts = [
        Object.keys(apply).length ? `applied ${Object.keys(apply).map(label).join(', ')}` : '',
        same.length ? `${same.map(label).join(', ')} already matched` : '',
        conflicts.length ? `${conflicts.map(c => label(c.field)).join(', ')} also changed at HQ — needs review` : ''
      ].filter(Boolean);
      return { result: conflicts.length ? 'CONFLICT' : 'APPLIED', message: `${person.name}: ${parts.join('; ')}.`, conflictIds: ids };
    }
    case 'INCIDENT_NOTE': {
      const inc = await IncidentModel.findOne({ incidentCode: a.target.code });
      if (!inc) return { result: 'REJECTED', message: `Incident ${a.target.code} not found.`, conflictIds: [] };
      await addIncidentAction(inc._id.toString(), `${a.change.text} [${via}]`, a.actor);
      return { result: 'MERGED', message: `Note appended to ${inc.incidentCode}'s action log.`, conflictIds: [] };
    }
    default:
      return { result: 'REJECTED', message: `Unknown action kind ${(a as any).kind}.`, conflictIds: [] };
  }
}

// ---------------------------------------------------------------------------
// Conflict review
// ---------------------------------------------------------------------------

export async function resolveConflict(conflictId: string, choice: 'STATION' | 'HQ', resolvedBy = 'HQ Logistics') {
  const c = await SyncConflictModel.findOne({ conflictId });
  if (!c) throw new Error(`Conflict ${conflictId} not found`);
  if (c.status !== 'OPEN') return c.toObject();
  if (choice === 'STATION') {
    if (c.targetType === 'ASSET') await updateAsset(c.targetId, { [c.field]: c.local } as any, `${resolvedBy} (kept station value)`);
    else if (c.targetType === 'PERSON') await updateReadiness(c.targetId, { [c.field]: c.local } as any, `${resolvedBy} (kept station value)`);
    else if (c.targetType === 'INVENTORY') {
      const item = await InventoryItemModel.findById(c.targetId);
      if (item) {
        const delta = Number(c.local) - item.quantity;
        if (delta !== 0) await recordTransaction(item._id.toString(), delta < 0 ? 'USED' : 'RECEIVED', Math.abs(delta), `Conflict ${conflictId}: station count kept`, undefined, resolvedBy);
      }
    }
  }
  c.status = 'RESOLVED';
  c.resolution = choice === 'STATION' ? 'Kept station value' : 'Kept HQ value';
  c.resolvedAt = wallNow();
  c.resolvedBy = resolvedBy;
  await c.save();
  return c.toObject();
}

// ---------------------------------------------------------------------------
// Demo: a realistic field day for a station, including one genuine conflict
// ---------------------------------------------------------------------------

type Draft = Omit<FieldAction, 'id' | 'sha256' | 'capturedAt' | 'nodeId'>;

export async function prepareDemo(nodeId: NodeId): Promise<{ drafts: Draft[]; hqEdit: string | null }> {
  const sim = now();
  const plusDays = (d: number) => new Date(sim.getTime() + d * 86400000).toISOString();
  const drafts: Draft[] = [];
  let hqEdit: string | null = null;

  if (nodeId === 'BHARATI') {
    const fuel = await InventoryItemModel.findOne({ itemCode: 'FUEL-SAB', station: 'BHARATI' });
    const o2 = await InventoryItemModel.findOne({ itemCode: 'MED-O2-CYL', station: 'BHARATI' });
    const pb = await AssetModel.findOne({ assetCode: 'PB-300-04' });
    const gen = await AssetModel.findOne({ assetCode: 'GEN-BHARATI-02' });
    const crate = await CrateModel.findOne({ destinationStation: 'BHARATI', status: 'RECEIVED_STATION' });
    if (fuel) drafts.push({ kind: 'STOCK_USED', actor: 'Station Engineer', target: { type: 'INVENTORY', code: 'FUEL-SAB', station: 'BHARATI' }, base: {}, change: { quantity: 1480 }, note: 'Generators and heating, last 24 h' });
    if (o2) drafts.push({ kind: 'STOCK_COUNT', actor: 'Station Doctor', target: { type: 'INVENTORY', code: 'MED-O2-CYL', station: 'BHARATI' }, base: { quantity: o2.quantity }, change: { quantity: Math.max(0, o2.quantity - 1) }, note: 'Weekly medical store count' });
    if (pb) drafts.push({ kind: 'ASSET_UPDATE', actor: 'Vehicle Mechanic', target: { type: 'ASSET', code: 'PB-300-04' }, base: { runtimeHours: pb.runtimeHours }, change: { runtimeHours: pb.runtimeHours + 14 }, note: 'Daily hour-meter reading' });
    if (crate) drafts.push({ kind: 'CRATE_EVENT', actor: 'Store Keeper', target: { type: 'CRATE', code: crate.crateCode }, base: {}, change: { event: 'INSPECTED', location: 'Bharati cold store' }, note: 'Seals intact, stored at −12 °C' });
    drafts.push({ kind: 'INCIDENT_NOTE', actor: 'Station Leader', target: { type: 'INCIDENT', code: 'INC-2026-01' }, base: {}, change: { text: 'Winds eased to 25 kt; outdoor work resumed with roped teams only.' }, note: 'Weather update' });
    if (gen) {
      drafts.push({
        kind: 'ASSET_UPDATE', actor: 'Station Engineer', target: { type: 'ASSET', code: 'GEN-BHARATI-02' },
        base: { lastServiceDate: gen.lastServiceDate, nextServiceDueDate: gen.nextServiceDueDate },
        change: { lastServiceDate: sim.toISOString(), nextServiceDueDate: plusDays(90) },
        note: 'Overdue 250-h service done on station; next due in 90 days'
      });
      // Meanwhile HQ re-plans the same generator's next service — the station can't see this while offline.
      await updateAsset(gen._id.toString(), { nextServiceDueDate: '2027-01-15T00:00:00.000Z' }, 'NCPOR Engineering, Goa');
      hqEdit = 'While the station was offline, HQ set GEN-BHARATI-02\'s next service to 15 Jan 2027. The station\'s own service record for the same field will conflict when it syncs.';
    }
  } else if (nodeId === 'MAITRI') {
    const lidar = await AssetModel.findOne({ assetCode: 'LIDAR-MAI-01' });
    drafts.push({ kind: 'STOCK_USED', actor: 'Maitri Power Watch', target: { type: 'INVENTORY', code: 'FUEL-SAB', station: 'MAITRI' }, base: {}, change: { quantity: 1590 }, note: 'Station power and heating, last 24 h' });
    if (lidar) drafts.push({ kind: 'ASSET_UPDATE', actor: 'Atmospheric Scientist', target: { type: 'ASSET', code: 'LIDAR-MAI-01' }, base: { runtimeHours: lidar.runtimeHours }, change: { runtimeHours: lidar.runtimeHours + 12 }, note: 'Overnight sounding run' });
  } else if (nodeId === 'VESSEL_VASILY_GOLOVNIN') {
    for (const code of ['CRT-1042', 'CRT-1043']) {
      const c = await CrateModel.findOne({ crateCode: code });
      if (c) drafts.push({ kind: 'CRATE_EVENT', actor: 'Ship Cargo Officer', target: { type: 'CRATE', code }, base: {}, change: { event: 'INSPECTED', location: 'MV Vasily Golovnin, hold 2' }, note: 'Heavy-weather lashings checked' });
    }
  }
  return { drafts, hqEdit };
}
