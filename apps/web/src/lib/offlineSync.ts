import { api } from './api';

// Store-and-forward outbox for a field terminal. Everything lives in localStorage so it survives
// reloads and a dead link; actions leave the outbox only when the server acknowledges them.

export type NodeId = 'GOA_HQ' | 'BHARATI' | 'MAITRI' | 'VESSEL_VASILY_GOLOVNIN';
export type ActionKind = 'STOCK_USED' | 'STOCK_COUNT' | 'CRATE_EVENT' | 'ASSET_UPDATE' | 'READINESS_UPDATE' | 'INCIDENT_NOTE';
export type ApplyResult = 'APPLIED' | 'MERGED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';

export interface FieldAction {
  id: string;
  nodeId: NodeId;
  kind: ActionKind;
  actor: string;
  capturedAt: string;
  target: { type: 'INVENTORY' | 'CRATE' | 'ASSET' | 'PERSON' | 'INCIDENT'; code: string; station?: string };
  base: Record<string, any>;
  change: Record<string, any>;
  note?: string;
  sha256: string;
}

export type ActionDraft = Omit<FieldAction, 'id' | 'nodeId' | 'capturedAt' | 'sha256'>;

export interface OutboxEntry {
  action: FieldAction;
  state: 'PENDING' | 'REJECTED';
  attempts: number;
  lastError?: string;
  bytes: number;
}

export interface SyncLogEntry {
  at: string;
  nodeId: NodeId;
  outcome: 'DELIVERED' | 'LINK_DOWN' | 'OFFLINE' | 'FAILED';
  message: string;
  count: number;
  rawBytes: number;
  compressedBytes: number | null;
  lostAck: boolean;
  results: Array<{ actionId: string; kind: ActionKind; target: string; result: ApplyResult; message: string }>;
}

const OUTBOX_KEY = 'polar_ops_outbox_v2';
const LOG_KEY = 'polar_ops_sync_log_v2';
const NODE_KEY = 'polar_ops_terminal_node';
const REF_KEY = 'polar_ops_reference_cache_v1';
const SIMULATED_OFFLINE_KEY = 'polar_ops_simulated_offline';

const isBrowser = () => typeof window !== 'undefined';
const emit = (name: string, detail?: any) => isBrowser() && window.dispatchEvent(new CustomEvent(name, { detail }));

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Could not save ${key}`, e);
  }
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

export function isSimulatedOffline(): boolean {
  return isBrowser() && localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
}

export function isBrowserOnline(): boolean {
  if (!isBrowser()) return true;
  return navigator.onLine && !isSimulatedOffline();
}

export function setSimulatedOffline(offline: boolean) {
  if (!isBrowser()) return;
  localStorage.setItem(SIMULATED_OFFLINE_KEY, offline ? 'true' : 'false');
  emit('polar:connectivity_change', { online: !offline });
}

export function getTerminalNode(): NodeId {
  return (isBrowser() && (localStorage.getItem(NODE_KEY) as NodeId)) || 'BHARATI';
}

export function setTerminalNode(node: NodeId) {
  if (!isBrowser()) return;
  localStorage.setItem(NODE_KEY, node);
  emit('polar:outbox_change');
}

// ---------------------------------------------------------------------------
// Integrity & size (same canonical form as the server)
// ---------------------------------------------------------------------------

export function canonicalJson(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Real gzip size of a payload (null if the browser has no CompressionStream). */
export async function gzipSize(text: string): Promise<number | null> {
  if (typeof (globalThis as any).CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new (globalThis as any).CompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  return buf.byteLength;
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export function getOutbox(): OutboxEntry[] {
  return read<OutboxEntry[]>(OUTBOX_KEY, []);
}

function saveOutbox(list: OutboxEntry[]) {
  write(OUTBOX_KEY, list);
  emit('polar:outbox_change', { count: list.length });
}

export function pendingCount(nodeId?: NodeId): number {
  return getOutbox().filter(e => e.state === 'PENDING' && (!nodeId || e.action.nodeId === nodeId)).length;
}

export async function queueAction(nodeId: NodeId, draft: ActionDraft): Promise<FieldAction> {
  const unsigned = {
    ...draft,
    id: (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    nodeId,
    capturedAt: new Date().toISOString()
  };
  const action: FieldAction = { ...unsigned, sha256: await sha256Hex(canonicalJson(unsigned)) };
  saveOutbox([...getOutbox(), { action, state: 'PENDING', attempts: 0, bytes: byteLength(JSON.stringify(action)) }]);
  return action;
}

export function discardActions(ids: string[]) {
  const drop = new Set(ids);
  saveOutbox(getOutbox().filter(e => !drop.has(e.action.id)));
}

export function getSyncLog(): SyncLogEntry[] {
  return read<SyncLogEntry[]>(LOG_KEY, []);
}

function addLog(entry: SyncLogEntry) {
  write(LOG_KEY, [entry, ...getSyncLog()].slice(0, 30));
  emit('polar:sync_log');
}

export function clearLocalSyncData() {
  if (!isBrowser()) return;
  localStorage.removeItem(OUTBOX_KEY);
  localStorage.removeItem(LOG_KEY);
  emit('polar:outbox_change', { count: 0 });
  emit('polar:sync_log');
}

export async function batchSize(actions: FieldAction[]) {
  const json = JSON.stringify(actions);
  return { rawBytes: byteLength(json), compressedBytes: await gzipSize(json) };
}

let pushing = false;

/**
 * Send every pending action for a node in one batch. Actions stay in the outbox unless the server
 * acknowledges them, so a dropped link or a lost reply never loses or double-applies work.
 * `simulateLostAck` keeps them even after delivery, to demonstrate that a re-send is harmless.
 */
export async function pushOutbox(nodeId: NodeId, opts: { simulateLostAck?: boolean } = {}): Promise<SyncLogEntry | null> {
  if (pushing) return null;
  const entries = getOutbox().filter(e => e.action.nodeId === nodeId && e.state === 'PENDING');
  if (!entries.length) return null;
  const actions = entries.map(e => e.action);
  const { rawBytes, compressedBytes } = await batchSize(actions);
  const base = { at: new Date().toISOString(), nodeId, count: actions.length, rawBytes, compressedBytes, lostAck: false, results: [] as SyncLogEntry['results'] };

  if (!isBrowserOnline()) {
    const log: SyncLogEntry = { ...base, outcome: 'OFFLINE', message: 'This terminal is offline — nothing was sent.' };
    addLog(log);
    return log;
  }

  pushing = true;
  emit('polar:sync_state', { syncing: true });
  try {
    const batchSha256 = await sha256Hex(actions.map(a => a.sha256).join(''));
    const res = await api.syncPush({ nodeId, actions, batchSha256, compressedBytes: compressedBytes ?? undefined });
    const bump = (msg: string) => saveOutbox(getOutbox().map(e => (entries.some(x => x.action.id === e.action.id) ? { ...e, attempts: e.attempts + 1, lastError: msg } : e)));

    if (res?.error) {
      const outcome = res.error.code === 'LINK_DOWN' ? 'LINK_DOWN' : 'FAILED';
      bump(res.error.message);
      const log: SyncLogEntry = { ...base, outcome, message: res.error.message };
      addLog(log);
      return log;
    }

    const byId = new Map(actions.map(a => [a.id, a]));
    const results = (res.data.results as any[]).map(r => ({
      actionId: r.actionId,
      kind: byId.get(r.actionId)!.kind,
      target: byId.get(r.actionId)!.target.code,
      result: r.result as ApplyResult,
      message: r.message
    }));
    const rejected = new Map(results.filter(r => r.result === 'REJECTED').map(r => [r.actionId, r.message]));
    const acknowledged = new Set(results.map(r => r.actionId));

    saveOutbox(getOutbox().flatMap(e => {
      if (!acknowledged.has(e.action.id)) return [e];
      if (rejected.has(e.action.id)) return [{ ...e, state: 'REJECTED' as const, attempts: e.attempts + 1, lastError: rejected.get(e.action.id) }];
      if (opts.simulateLostAck) return [{ ...e, attempts: e.attempts + 1, lastError: 'Reply lost on the link (simulated) — will be re-sent' }];
      return [];
    }));

    const counts = results.reduce<Record<string, number>>((m, r) => ({ ...m, [r.result]: (m[r.result] || 0) + 1 }), {});
    const summary = Object.entries(counts).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ');
    const log: SyncLogEntry = {
      ...base,
      outcome: 'DELIVERED',
      lostAck: !!opts.simulateLostAck,
      message: opts.simulateLostAck
        ? `Delivered (${summary}), but the reply was lost — the terminal will send these again.`
        : `Delivered: ${summary}.`,
      results
    };
    addLog(log);
    return log;
  } finally {
    pushing = false;
    emit('polar:sync_state', { syncing: false });
  }
}

// ---------------------------------------------------------------------------
// Automatic sync: retry with back-off while anything is pending and the terminal is online.
// ---------------------------------------------------------------------------

let autoTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 5000;

export function startAutoSync(): () => void {
  if (!isBrowser()) return () => {};
  const tick = async () => {
    autoTimer = null;
    const node = getTerminalNode();
    if (pendingCount(node) && isBrowserOnline()) {
      const log = await pushOutbox(node);
      backoffMs = log?.outcome === 'DELIVERED' ? 5000 : Math.min(backoffMs * 2, 120000);
    }
    schedule();
  };
  const schedule = (ms = backoffMs) => {
    if (autoTimer) clearTimeout(autoTimer);
    autoTimer = setTimeout(tick, ms);
  };
  const kick = () => { backoffMs = 5000; schedule(500); };
  window.addEventListener('online', kick);
  window.addEventListener('polar:connectivity_change', kick);
  window.addEventListener('polar:link_change', kick);
  schedule(2000);
  return () => {
    if (autoTimer) clearTimeout(autoTimer);
    window.removeEventListener('online', kick);
    window.removeEventListener('polar:connectivity_change', kick);
    window.removeEventListener('polar:link_change', kick);
  };
}

// ---------------------------------------------------------------------------
// Reference data cached for offline forms (pickers must work without a link)
// ---------------------------------------------------------------------------

export interface ReferenceCache {
  savedAt: string;
  inventory: Array<{ itemCode: string; station: string; name: string; unit: string; quantity: number }>;
  crates: Array<{ crateCode: string; title: string; status: string; destinationStation: string }>;
  assets: Array<{ assetCode: string; name: string; location: string; status: string; runtimeHours: number; lastServiceDate: string; nextServiceDueDate: string }>;
  people: Array<{ name: string; role: string; readiness: Record<string, boolean> }>;
  incidents: Array<{ incidentCode: string; title: string; status: string }>;
}

export function getReferenceCache(): ReferenceCache | null {
  return read<ReferenceCache | null>(REF_KEY, null);
}

export async function refreshReferenceCache(): Promise<ReferenceCache | null> {
  if (!isBrowserOnline()) return getReferenceCache();
  const [inv, crates, assets, people, incidents] = await Promise.all([
    api.getInventory(), api.getCrates(), api.getAssets(), api.getPeople(), api.getIncidents()
  ]);
  if (!inv?.data || !crates?.data || !assets?.data || !people?.data) return getReferenceCache();
  const cache: ReferenceCache = {
    savedAt: new Date().toISOString(),
    inventory: inv.data.map((i: any) => ({ itemCode: i.itemCode, station: i.station, name: i.name, unit: i.unit, quantity: i.quantity })),
    crates: crates.data.map((c: any) => ({ crateCode: c.crateCode, title: c.title, status: c.status, destinationStation: c.destinationStation })),
    assets: assets.data.map((a: any) => ({ assetCode: a.assetCode, name: a.name, location: a.location, status: a.status, runtimeHours: a.runtimeHours, lastServiceDate: a.lastServiceDate, nextServiceDueDate: a.nextServiceDueDate })),
    people: people.data.map((p: any) => ({ name: p.name, role: p.role, readiness: p.readiness || {} })),
    incidents: (incidents?.data || []).map((i: any) => ({ incidentCode: i.incidentCode, title: i.title, status: i.status }))
  };
  write(REF_KEY, cache);
  return cache;
}
