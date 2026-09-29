'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  Send,
  RefreshCw,
  RotateCcw,
  Fuel,
  ClipboardList,
  Package,
  Wrench,
  UserCheck,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  GitMerge,
  Trash2,
  Ship,
  Building2,
  Landmark,
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  HardDrive,
  Lock,
  Timer
} from 'lucide-react';
import { api } from '../../lib/api';
import {
  NodeId,
  ActionKind,
  ActionDraft,
  FieldAction,
  OutboxEntry,
  SyncLogEntry,
  ReferenceCache,
  getOutbox,
  getSyncLog,
  getTerminalNode,
  setTerminalNode,
  queueAction,
  discardActions,
  pushOutbox,
  batchSize,
  isBrowserOnline,
  isSimulatedOffline,
  setSimulatedOffline,
  getReferenceCache,
  refreshReferenceCache,
  clearLocalSyncData
} from '../../lib/offlineSync';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const NODE_META: Record<NodeId, { short: string; icon: any; station: string | null }> = {
  GOA_HQ: { short: 'Goa HQ', icon: Landmark, station: null },
  BHARATI: { short: 'Bharati', icon: Building2, station: 'BHARATI' },
  MAITRI: { short: 'Maitri', icon: Building2, station: 'MAITRI' },
  VESSEL_VASILY_GOLOVNIN: { short: 'Ship', icon: Ship, station: null }
};

const LINK_STYLE: Record<string, { label: string; cls: string; dot: string }> = {
  ONLINE: { label: 'Link up', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  DEGRADED: { label: 'Weak link', cls: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  BLACKOUT: { label: 'No link', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' }
};

const CONSTELLATION: Record<string, string> = { IRIDIUM_CERTUS: 'Iridium Certus', STARLINK_POLAR: 'Starlink (polar)', INMARSAT_FLEET: 'Inmarsat Fleet' };

const KIND_META: Record<ActionKind, { label: string; icon: any; rule: string; ruleTag: string }> = {
  STOCK_USED: { label: 'Stock used', icon: Fuel, rule: 'Usage amounts add up, so entries from anywhere combine without conflict.', ruleTag: 'Adds up' },
  STOCK_COUNT: { label: 'Stock count', icon: ClipboardList, rule: 'A count replaces the stock level — unless HQ changed it since, then it goes to review.', ruleTag: '3-way merge' },
  CRATE_EVENT: { label: 'Cargo scan', icon: Package, rule: 'Scans are appended to the crate history; history only grows, so it never clashes.', ruleTag: 'Append only' },
  ASSET_UPDATE: { label: 'Equipment log', icon: Wrench, rule: 'Each field merges on its own; only a field HQ also changed goes to review.', ruleTag: '3-way merge' },
  READINESS_UPDATE: { label: 'Readiness', icon: UserCheck, rule: 'Each check merges on its own; only a check HQ also changed goes to review.', ruleTag: '3-way merge' },
  INCIDENT_NOTE: { label: 'Incident note', icon: MessageSquare, rule: 'Notes are appended to the incident log; never clash.', ruleTag: 'Append only' }
};

const RESULT_STYLE: Record<string, { label: string; cls: string; icon: any }> = {
  APPLIED: { label: 'Applied', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  MERGED: { label: 'Merged', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: GitMerge },
  DUPLICATE: { label: 'Already had it', cls: 'bg-slate-50 text-slate-600 border-slate-200', icon: Copy },
  CONFLICT: { label: 'Needs review', cls: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle }
};

const READINESS_LABEL: Record<string, string> = {
  medicalCleared: 'Medical clearance',
  auliTrainingCompleted: 'Acclimatisation training',
  passportValid: 'Valid passport',
  polarPermitIssued: 'Polar permit'
};

const fmtBytes = (b: number | null | undefined) => (b === null || b === undefined ? '—' : b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);
const fmtTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const fmtAgo = (iso?: string | null) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};
const fmtVal = (v: any) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return String(v);
};
const fieldLabel = (f: string) => READINESS_LABEL[f] || f.replace(/([A-Z])/g, ' $1').toLowerCase();

function describeAction(a: FieldAction): string {
  switch (a.kind) {
    case 'STOCK_USED': return `Used ${fmtVal(a.change.quantity)} of ${a.target.code} at ${a.target.station}`;
    case 'STOCK_COUNT': return `Counted ${fmtVal(a.change.quantity)} ${a.target.code} at ${a.target.station} (ledger said ${fmtVal(a.base.quantity)})`;
    case 'CRATE_EVENT': return `${a.change.event === 'RECEIVED' ? 'Received' : 'Inspected'} ${a.target.code} — ${a.change.location}`;
    case 'ASSET_UPDATE':
    case 'READINESS_UPDATE':
      return `${a.target.code}: ${Object.keys(a.change).map(k => `${fieldLabel(k)} ${fmtVal(a.base[k])} → ${fmtVal(a.change[k])}`).join('; ')}`;
    case 'INCIDENT_NOTE': return `${a.target.code}: “${a.change.text}”`;
  }
}

/** Values the station currently believes, i.e. the cached server copy plus its own pending entries. */
function localView(cache: ReferenceCache | null, outbox: OutboxEntry[]) {
  const stock = new Map<string, number>();
  const assets = new Map<string, Record<string, any>>();
  const people = new Map<string, Record<string, any>>();
  for (const i of cache?.inventory || []) stock.set(`${i.itemCode}@${i.station}`, i.quantity);
  for (const a of cache?.assets || []) assets.set(a.assetCode, { status: a.status, runtimeHours: a.runtimeHours, lastServiceDate: a.lastServiceDate, nextServiceDueDate: a.nextServiceDueDate });
  for (const p of cache?.people || []) people.set(p.name, { ...p.readiness });
  for (const { action: a, state } of outbox) {
    if (state !== 'PENDING') continue;
    const key = `${a.target.code}@${a.target.station}`;
    if (a.kind === 'STOCK_USED') stock.set(key, (stock.get(key) ?? 0) - Number(a.change.quantity));
    if (a.kind === 'STOCK_COUNT') stock.set(key, Number(a.change.quantity));
    if (a.kind === 'ASSET_UPDATE') assets.set(a.target.code, { ...(assets.get(a.target.code) || {}), ...a.change });
    if (a.kind === 'READINESS_UPDATE') people.set(a.target.code, { ...(people.get(a.target.code) || {}), ...a.change });
  }
  return { stock, assets, people };
}

// ---------------------------------------------------------------------------
// Entry form
// ---------------------------------------------------------------------------

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

function EntryForm({ node, cache, outbox, onSaved }: { node: NodeId; cache: ReferenceCache | null; outbox: OutboxEntry[]; onSaved: (a: FieldAction) => void }) {
  const [kind, setKind] = useState<ActionKind>('STOCK_USED');
  const [target, setTarget] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [note, setNote] = useState('');
  const [actor, setActor] = useState('Station Engineer');
  const [event, setEvent] = useState<'INSPECTED' | 'RECEIVED'>('INSPECTED');
  const [assetEdits, setAssetEdits] = useState<Record<string, any>>({});
  const [readinessEdits, setReadinessEdits] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const station = NODE_META[node].station;
  const view = useMemo(() => localView(cache, outbox), [cache, outbox]);
  const items = (cache?.inventory || []).filter(i => !station || i.station === station);
  const assets = (cache?.assets || []).filter(a => !station || a.location === station);

  useEffect(() => {
    setError(null);
    setNote('');
    setAssetEdits({});
    setReadinessEdits({});
    const first =
      kind === 'STOCK_USED' || kind === 'STOCK_COUNT' ? (items[0] ? `${items[0].itemCode}@${items[0].station}` : '')
        : kind === 'CRATE_EVENT' ? cache?.crates[0]?.crateCode
          : kind === 'ASSET_UPDATE' ? assets[0]?.assetCode
            : kind === 'READINESS_UPDATE' ? cache?.people[0]?.name
              : cache?.incidents[0]?.incidentCode;
    setTarget(first || '');
  }, [kind, node, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (kind === 'STOCK_COUNT') setQty(view.stock.get(target) ?? 0);
    if (kind === 'STOCK_USED') setQty(0);
    setAssetEdits({});
    setReadinessEdits({});
  }, [target, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cache) {
    return <p className="text-xs text-slate-500">Reference data has not been cached on this terminal yet. Reconnect once to download it — after that, forms work offline.</p>;
  }

  const item = items.find(i => `${i.itemCode}@${i.station}` === target);
  const assetBase = view.assets.get(target) || {};
  const personBase = view.people.get(target) || {};

  const buildDraft = (): ActionDraft | string => {
    const common = { actor: actor || 'Field operator', note: note || undefined };
    switch (kind) {
      case 'STOCK_USED':
        if (!item) return 'Pick an item.';
        if (!(qty > 0)) return 'Enter the quantity used.';
        return { ...common, kind, target: { type: 'INVENTORY', code: item.itemCode, station: item.station }, base: {}, change: { quantity: qty } };
      case 'STOCK_COUNT': {
        if (!item) return 'Pick an item.';
        const base = view.stock.get(target) ?? item.quantity;
        return { ...common, kind, target: { type: 'INVENTORY', code: item.itemCode, station: item.station }, base: { quantity: base }, change: { quantity: qty } };
      }
      case 'CRATE_EVENT':
        if (!target) return 'Pick a crate.';
        return { ...common, kind, target: { type: 'CRATE', code: target }, base: {}, change: { event, location: NODE_META[node].short } };
      case 'ASSET_UPDATE': {
        const change = Object.fromEntries(Object.entries(assetEdits).filter(([k, v]) => v !== '' && v !== undefined && String(v) !== String(assetBase[k] ?? '')));
        if (!Object.keys(change).length) return 'Change at least one field.';
        return { ...common, kind, target: { type: 'ASSET', code: target }, base: Object.fromEntries(Object.keys(change).map(k => [k, assetBase[k] ?? null])), change };
      }
      case 'READINESS_UPDATE': {
        const change = Object.fromEntries(Object.entries(readinessEdits).filter(([k, v]) => v !== !!personBase[k]));
        if (!Object.keys(change).length) return 'Change at least one check.';
        return { ...common, kind, target: { type: 'PERSON', code: target }, base: Object.fromEntries(Object.keys(change).map(k => [k, !!personBase[k]])), change };
      }
      case 'INCIDENT_NOTE':
        if (!text.trim()) return 'Write the note.';
        return { ...common, kind, target: { type: 'INCIDENT', code: target }, base: {}, change: { text: text.trim() } };
    }
  };

  const save = async () => {
    const draft = buildDraft();
    if (typeof draft === 'string') return setError(draft);
    const a = await queueAction(node, draft);
    setError(null);
    setNote('');
    setText('');
    setAssetEdits({});
    setReadinessEdits({});
    onSaved(a);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(KIND_META) as ActionKind[]).map(k => {
          const M = KIND_META[k];
          const Icon = M.icon;
          return (
            <button key={k} onClick={() => setKind(k)} className={`text-[11px] font-semibold px-2 py-1.5 rounded-lg border flex items-center gap-1 justify-center ${kind === k ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              <Icon className="w-3.5 h-3.5" /> {M.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <GitMerge className="w-3.5 h-3.5 shrink-0 mt-px text-sky-600" />
        <span><b className="text-slate-700">{KIND_META[kind].ruleTag}:</b> {KIND_META[kind].rule}</span>
      </p>

      {(kind === 'STOCK_USED' || kind === 'STOCK_COUNT') && (
        <>
          <Field label="Item">
            <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
              {items.map(i => <option key={`${i.itemCode}@${i.station}`} value={`${i.itemCode}@${i.station}`}>{i.itemCode} · {i.name} ({i.station})</option>)}
            </select>
          </Field>
          <Field
            label={kind === 'STOCK_USED' ? `Quantity used${item ? ` (${item.unit})` : ''}` : `Counted quantity${item ? ` (${item.unit})` : ''}`}
            hint={item ? `This terminal's view: ${fmtVal(view.stock.get(target))} ${item.unit} (server copy cached ${fmtAgo(cache.savedAt)}, plus entries still in the outbox).` : undefined}
          >
            <input type="number" min={0} className={inputCls} value={qty} onChange={e => setQty(Number(e.target.value))} />
          </Field>
        </>
      )}

      {kind === 'CRATE_EVENT' && (
        <>
          <Field label="Crate">
            <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
              {cache.crates.map(c => <option key={c.crateCode} value={c.crateCode}>{c.crateCode} · {c.title.slice(0, 50)}</option>)}
            </select>
          </Field>
          <Field label="Scan type">
            <div className="flex gap-1">
              {(['INSPECTED', 'RECEIVED'] as const).map(ev => (
                <button key={ev} onClick={() => setEvent(ev)} className={`flex-1 text-xs px-2 py-1.5 rounded-lg border ${event === ev ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                  {ev === 'INSPECTED' ? 'Inspected' : 'Received at station'}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}

      {kind === 'ASSET_UPDATE' && (
        <>
          <Field label="Equipment">
            <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
              {assets.map(a => <option key={a.assetCode} value={a.assetCode}>{a.assetCode} · {a.name.slice(0, 44)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Runtime hours" hint={`now ${fmtVal(assetBase.runtimeHours)}`}>
              <input type="number" className={inputCls} placeholder={String(assetBase.runtimeHours ?? '')} value={assetEdits.runtimeHours ?? ''} onChange={e => setAssetEdits({ ...assetEdits, runtimeHours: e.target.value === '' ? '' : Number(e.target.value) })} />
            </Field>
            <Field label="Status" hint={`now ${fmtVal(assetBase.status)}`}>
              <select className={inputCls} value={assetEdits.status ?? ''} onChange={e => setAssetEdits({ ...assetEdits, status: e.target.value })}>
                <option value="">(no change)</option>
                {['OPERATIONAL', 'MAINTENANCE_DUE', 'UNDER_REPAIR'].map(s => <option key={s} value={s}>{s.toLowerCase().replace('_', ' ')}</option>)}
              </select>
            </Field>
            <Field label="Serviced on" hint={`last ${fmtVal(assetBase.lastServiceDate)}`}>
              <input type="date" className={inputCls} value={assetEdits.lastServiceDate?.slice(0, 10) ?? ''} onChange={e => setAssetEdits({ ...assetEdits, lastServiceDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })} />
            </Field>
            <Field label="Next service due" hint={`now ${fmtVal(assetBase.nextServiceDueDate)}`}>
              <input type="date" className={inputCls} value={assetEdits.nextServiceDueDate?.slice(0, 10) ?? ''} onChange={e => setAssetEdits({ ...assetEdits, nextServiceDueDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })} />
            </Field>
          </div>
        </>
      )}

      {kind === 'READINESS_UPDATE' && (
        <>
          <Field label="Person">
            <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
              {cache.people.map(p => <option key={p.name} value={p.name}>{p.name} · {p.role}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(READINESS_LABEL).map(k => {
              const value = readinessEdits[k] ?? !!personBase[k];
              return (
                <label key={k} className={`flex items-center gap-2 text-xs rounded-lg border px-2 py-1.5 cursor-pointer ${value !== !!personBase[k] ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`}>
                  <input type="checkbox" checked={value} onChange={e => setReadinessEdits({ ...readinessEdits, [k]: e.target.checked })} className="accent-sky-600" />
                  {READINESS_LABEL[k]}
                </label>
              );
            })}
          </div>
        </>
      )}

      {kind === 'INCIDENT_NOTE' && (
        <>
          <Field label="Incident">
            <select className={inputCls} value={target} onChange={e => setTarget(e.target.value)}>
              {cache.incidents.map(i => <option key={i.incidentCode} value={i.incidentCode}>{i.incidentCode} · {i.title.slice(0, 50)}</option>)}
            </select>
          </Field>
          <Field label="Note">
            <textarea rows={2} className={inputCls} value={text} onChange={e => setText(e.target.value)} placeholder="What happened, what was done" />
          </Field>
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Recorded by">
          <input className={inputCls} value={actor} onChange={e => setActor(e.target.value)} />
        </Field>
        {kind !== 'INCIDENT_NOTE' && (
          <Field label="Note (optional)">
            <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button onClick={save} className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-700 text-white flex items-center justify-center gap-2">
        <HardDrive className="w-3.5 h-3.5" /> Save to this terminal&apos;s outbox
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FieldSyncPage() {
  const [node, setNode] = useState<NodeId>('BHARATI');
  const [status, setStatus] = useState<any>(null);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [cache, setCache] = useState<ReferenceCache | null>(null);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lostAck, setLostAck] = useState(false);
  const [batch, setBatch] = useState<{ rawBytes: number; compressedBytes: number | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [showHow, setShowHow] = useState(false);

  const refreshLocal = useCallback(() => {
    setOutbox(getOutbox());
    setLog(getSyncLog());
    setOnline(isBrowserOnline());
  }, []);

  const loadStatus = useCallback(async () => {
    if (!isBrowserOnline()) return;
    const res = await api.getSyncStatus();
    if (res?.data) setStatus(res.data);
  }, []);

  useEffect(() => {
    setNode(getTerminalNode());
    setCache(getReferenceCache());
    refreshLocal();
    loadStatus();
    refreshReferenceCache().then(c => c && setCache(c));
    const onSync = (e: Event) => {
      setSyncing(!!(e as CustomEvent).detail?.syncing);
      if (!(e as CustomEvent).detail?.syncing) { loadStatus(); refreshReferenceCache().then(c => c && setCache(c)); }
    };
    const onConn = () => { refreshLocal(); loadStatus(); };
    const events = ['polar:outbox_change', 'polar:sync_log'];
    events.forEach(ev => window.addEventListener(ev, refreshLocal));
    ['online', 'offline', 'polar:connectivity_change'].forEach(ev => window.addEventListener(ev, onConn));
    window.addEventListener('polar:sync_state', onSync);
    const poll = setInterval(loadStatus, 8000);
    return () => {
      events.forEach(ev => window.removeEventListener(ev, refreshLocal));
      ['online', 'offline', 'polar:connectivity_change'].forEach(ev => window.removeEventListener(ev, onConn));
      window.removeEventListener('polar:sync_state', onSync);
      clearInterval(poll);
    };
  }, [refreshLocal, loadStatus]);

  const nodeEntries = outbox.filter(e => e.action.nodeId === node);
  const pending = nodeEntries.filter(e => e.state === 'PENDING');
  const rejected = nodeEntries.filter(e => e.state === 'REJECTED');
  const serverNode = status?.nodes?.find((n: any) => n.id === node);

  useEffect(() => {
    if (!pending.length) return setBatch(null);
    batchSize(pending.map(e => e.action)).then(setBatch);
  }, [outbox, node]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseNode = (n: NodeId) => {
    setNode(n);
    setTerminalNode(n);
  };

  const setLink = async (link: string) => {
    await api.setSyncLink(node, link);
    window.dispatchEvent(new CustomEvent('polar:link_change'));
    loadStatus();
  };

  const syncNow = async () => {
    const res = await pushOutbox(node, { simulateLostAck: lostAck });
    if (lostAck) setLostAck(false);
    refreshLocal();
    loadStatus();
    if (res) setNotice(null);
  };

  const loadDemo = async () => {
    if (!isBrowserOnline()) return setNotice('Reconnect once to fetch the demo entries, then go offline to record them.');
    setDemoBusy(true);
    try {
      const res = await api.prepareSyncDemo(node);
      const drafts: ActionDraft[] = res?.data?.drafts || [];
      for (const d of drafts) await queueAction(node, d);
      setNotice(`${drafts.length} entries from a typical day at ${NODE_META[node].short} were saved to the outbox.${res?.data?.hqEdit ? ` ${res.data.hqEdit}` : ''}`);
      setCache(await refreshReferenceCache());
      loadStatus();
    } finally {
      setDemoBusy(false);
    }
  };

  const resetAll = async () => {
    if (!confirm('Clear this terminal\'s outbox and log, and the server\'s sync receipts and conflicts?')) return;
    clearLocalSyncData();
    await api.resetSync();
    setNotice(null);
    loadStatus();
  };

  const resolve = async (conflictId: string, choice: 'STATION' | 'HQ') => {
    await api.resolveSyncConflict(conflictId, choice);
    loadStatus();
    refreshReferenceCache().then(c => c && setCache(c));
  };

  const linkDown = serverNode?.link === 'BLACKOUT';
  const airtimeSec = batch?.compressedBytes && serverNode?.uplinkKbps ? (batch.compressedBytes * 8) / (serverNode.uplinkKbps * 1000) + (serverNode.latencyMs || 0) / 1000 : null;
  const saving = batch?.compressedBytes ? Math.round((1 - batch.compressedBytes / batch.rawBytes) * 100) : null;
  const blockReason = !online ? 'This terminal is offline' : linkDown ? `${NODE_META[node].short} has no satellite link` : !pending.length ? 'Nothing to send' : null;
  const lastLog = log.find(l => l.nodeId === node);
  const conflicts = status?.openConflicts || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-600" /> Field Sync
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Stations keep working when the satellite link drops. Every entry is saved on this terminal first, then sent as one signed,
              compressed batch as soon as a link is available — automatically. HQ applies each entry once, merges what can be merged,
              and asks a person only when both sides changed the same thing.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {online ? 'Terminal online' : 'Terminal offline — saving locally'}
            </span>
            <button onClick={() => setSimulatedOffline(!isSimulatedOffline())} className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${online ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-amber-600 border-amber-700 text-white hover:bg-amber-700'}`}>
              {online ? 'Go offline' : 'Reconnect'}
            </button>
            <button onClick={resetAll} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1" title="Clear outbox, log, receipts and conflicts">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>

        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
          {[
            [HardDrive, 'Record anywhere', 'Forms work offline using data cached on this terminal.'],
            [Lock, 'Seal each entry', 'SHA-256 of every entry; HQ rejects anything altered in transit.'],
            [Send, 'Send when the link allows', 'One gzip batch; retried automatically with back-off.'],
            [GitMerge, 'Merge at HQ, once', 'Receipts stop double-applying; real clashes go to review.']
          ].map(([Icon, t, d]: any, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <span className="w-5 h-5 shrink-0 rounded-full bg-sky-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1"><Icon className="w-3 h-3 text-sky-600" />{t}</div>
                <div className="text-slate-500">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Sites */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {(Object.keys(NODE_META) as NodeId[]).map(id => {
          const M = NODE_META[id];
          const Icon = M.icon;
          const s = status?.nodes?.find((n: any) => n.id === id);
          const L = LINK_STYLE[s?.link || 'ONLINE'];
          const count = outbox.filter(e => e.action.nodeId === id && e.state === 'PENDING').length;
          const active = id === node;
          return (
            <button key={id} onClick={() => chooseNode(id)} className={`text-left bg-white rounded-xl border p-3 shadow-card transition ${active ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900"><Icon className="w-3.5 h-3.5 text-slate-500" />{s?.name || M.short}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${L.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${L.dot}`} />{L.label}</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{s ? `${CONSTELLATION[s.constellation]} · ${s.uplinkKbps ? `${s.uplinkKbps.toLocaleString('en-IN')} kbit/s up` : 'no uplink'}` : '—'}</div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Last contact {fmtAgo(s?.lastContactAt)}</span>
                {count > 0 && <span className="font-bold text-amber-700">{count} waiting</span>}
              </div>
              {active && <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-700">This terminal</div>}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 flex items-start gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-sky-600" /> <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: record */}
        <div className="xl:col-span-5 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Record a field entry · {NODE_META[node].short}</h2>
              {cache && <span className="text-[10px] text-slate-400">data cached {fmtAgo(cache.savedAt)}</span>}
            </div>
            <EntryForm node={node} cache={cache} outbox={outbox} onSaved={() => { refreshLocal(); setNotice(online ? 'Saved. It will be sent automatically in a few seconds — or press Send now.' : 'Saved on this terminal. It will be sent automatically when the link returns.'); }} />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-2">
            <h2 className="text-sm font-bold text-slate-900">Demo: a day at {NODE_META[node].short}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Adds a realistic set of entries for this site to the outbox.
              {node === 'BHARATI' && ' At the same moment HQ edits one of the same generator fields, so you get one real conflict to review.'}
              {' '}Tip: press <b>Go offline</b> first to watch them wait, then <b>Reconnect</b>.
            </p>
            <button onClick={loadDemo} disabled={demoBusy || node === 'GOA_HQ'} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center gap-1.5 disabled:opacity-50">
              {demoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {node === 'GOA_HQ' ? 'HQ is the hub — pick a station or the ship' : 'Load demo entries'}
            </button>
          </div>
        </div>

        {/* Right: outbox & results */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Outbox · {NODE_META[node].short}</h2>
                <p className="text-[11px] text-slate-500">Kept on this terminal until HQ confirms each entry.</p>
              </div>
              {serverNode && node !== 'GOA_HQ' && (
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-500 mr-1">Satellite link:</span>
                  {(['ONLINE', 'DEGRADED', 'BLACKOUT'] as const).map(l => (
                    <button key={l} onClick={() => setLink(l)} className={`px-2 py-1 rounded-md border font-semibold ${serverNode.link === l ? LINK_STYLE[l].cls : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      {LINK_STYLE[l].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
              {[
                ['Waiting', `${pending.length}`, 'entries'],
                ['Plain size', fmtBytes(batch?.rawBytes), 'JSON'],
                ['Sent size', fmtBytes(batch?.compressedBytes), saving !== null ? `gzip, ${saving}% smaller` : 'gzip'],
                ['Airtime', airtimeSec !== null ? `${airtimeSec < 1 ? airtimeSec.toFixed(2) : airtimeSec.toFixed(1)} s` : linkDown ? '—' : '—', serverNode ? `at ${serverNode.uplinkKbps.toLocaleString('en-IN')} kbit/s` : '']
              ].map(([t, v, s]) => (
                <div key={t} className="rounded-xl border border-slate-200 p-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t}</div>
                  <div className="text-base font-extrabold text-slate-900">{v}</div>
                  <div className="text-[10px] text-slate-500">{s}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={syncNow} disabled={!!blockReason || syncing} className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {syncing ? 'Sending…' : 'Send now'}
              </button>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer" title="HQ receives the batch but the reply never reaches the station, so the terminal sends it again. HQ recognises the entries and does not apply them twice.">
                <input type="checkbox" checked={lostAck} onChange={e => setLostAck(e.target.checked)} className="accent-amber-600" />
                Simulate a lost reply (shows re-sends are safe)
              </label>
              {blockReason && <span className="text-[11px] text-slate-500">{blockReason}{blockReason !== 'Nothing to send' ? ' — entries wait here and go automatically later.' : '.'}</span>}
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {nodeEntries.length === 0 && <p className="p-4 text-xs text-slate-500 text-center">Outbox is empty.</p>}
              {nodeEntries.map(({ action: a, state, attempts, lastError, bytes }) => {
                const M = KIND_META[a.kind];
                const Icon = M.icon;
                return (
                  <div key={a.id} className="p-2.5 flex items-start gap-2.5 text-xs">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${state === 'REJECTED' ? 'text-rose-500' : 'text-slate-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-900 font-semibold">{describeAction(a)}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                        <span>{M.label} · {a.actor}</span>
                        <span>saved {fmtTime(a.capturedAt)}</span>
                        <span>{fmtBytes(bytes)}</span>
                        <span className="font-mono" title={a.sha256}>sha256 {a.sha256.slice(0, 10)}…</span>
                        {attempts > 0 && <span>{attempts} attempt{attempts === 1 ? '' : 's'}</span>}
                      </div>
                      {lastError && <div className={`text-[11px] mt-0.5 ${state === 'REJECTED' ? 'text-rose-600' : 'text-amber-700'}`}>{lastError}</div>}
                    </div>
                    {state === 'REJECTED' ? (
                      <button onClick={() => discardActions([a.id])} className="p-1 rounded text-rose-500 hover:bg-rose-50" title="Discard"><Trash2 className="w-3.5 h-3.5" /></button>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">waiting</span>
                    )}
                  </div>
                );
              })}
            </div>
            {rejected.length > 0 && <p className="text-[11px] text-rose-600">{rejected.length} entr{rejected.length === 1 ? 'y was' : 'ies were'} rejected by HQ — read the reason, fix and re-enter, then discard.</p>}
          </div>

          {lastLog && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Last send · {fmtTime(lastLog.at)}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lastLog.outcome === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                  {lastLog.outcome === 'DELIVERED' ? 'Delivered' : lastLog.outcome === 'LINK_DOWN' ? 'No satellite link' : lastLog.outcome === 'OFFLINE' ? 'Terminal offline' : 'Failed'}
                </span>
              </div>
              <p className="text-xs text-slate-600">{lastLog.message} {lastLog.count} entr{lastLog.count === 1 ? 'y' : 'ies'}, {fmtBytes(lastLog.compressedBytes)} sent.</p>
              {lastLog.results.map(r => {
                const S = RESULT_STYLE[r.result];
                const Icon = S.icon;
                return (
                  <div key={r.actionId} className="flex items-start gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${S.cls}`}><Icon className="w-3 h-3" />{S.label}</span>
                    <span className="text-slate-700"><b>{r.target}</b> — {r.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conflicts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Needs review ({conflicts.length})</h2>
          <span className="text-[11px] text-slate-500">Only fields changed on both sides land here; everything else merged automatically.</span>
        </div>
        {conflicts.length === 0 && <p className="text-xs text-slate-500">No open conflicts.</p>}
        {conflicts.map((c: any) => (
          <div key={c.conflictId} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-2">
            <div className="text-xs text-slate-800"><b>{c.targetCode}</b> · {fieldLabel(c.field)} <span className="text-slate-500">— entered by {c.actor} at {NODE_META[c.nodeId as NodeId]?.short || c.nodeId}, {fmtTime(c.capturedAt)}</span></div>
            <div className="grid md:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Both saw</div>
                <div className="font-semibold text-slate-700">{fmtVal(c.base)}</div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-white p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Station changed it to</div>
                <div className="font-semibold text-slate-900">{fmtVal(c.local)}</div>
              </div>
              <div className="rounded-lg border border-violet-200 bg-white p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700">HQ changed it to (current)</div>
                <div className="font-semibold text-slate-900">{fmtVal(c.remote)}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => resolve(c.conflictId, 'STATION')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500">Keep station value</button>
              <button onClick={() => resolve(c.conflictId, 'HQ')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">Keep HQ value</button>
            </div>
          </div>
        ))}
        {status?.resolvedConflicts?.length > 0 && (
          <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
            {status.resolvedConflicts.map((c: any) => (
              <div key={c.conflictId}><CheckCircle2 className="inline w-3 h-3 text-emerald-600 mr-1" />{c.targetCode} · {fieldLabel(c.field)} — {c.resolution} ({c.resolvedBy}, {fmtAgo(c.resolvedAt)})</div>
            ))}
          </div>
        )}
      </div>

      {/* HQ ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> HQ receipts ledger</h2>
          {status && (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              {(['applied', 'merged', 'duplicates', 'conflicts', 'rejected'] as const).map(k => (
                <span key={k} className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600"><b>{status.totals[k]}</b> {k}</span>
              ))}
              <button onClick={loadStatus} className="px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1"><RefreshCw className="w-3 h-3" />refresh</button>
            </div>
          )}
        </div>
        {!online && <p className="text-xs text-amber-700">Offline — showing the last copy downloaded.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="py-1.5 pr-2 font-semibold">Received</th>
                <th className="py-1.5 pr-2 font-semibold">From</th>
                <th className="py-1.5 pr-2 font-semibold">Entry</th>
                <th className="py-1.5 pr-2 font-semibold">Result</th>
                <th className="py-1.5 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(status?.receipts || []).length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-500">Nothing received yet.</td></tr>}
              {(status?.receipts || []).map((r: any) => {
                const S = RESULT_STYLE[r.result] || RESULT_STYLE.APPLIED;
                return (
                  <tr key={r.actionId} className="border-b border-slate-50 align-top">
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-600">{fmtTime(r.receivedAt)}<div className="text-[10px] text-slate-400">saved {fmtTime(r.capturedAt)}</div></td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{NODE_META[r.nodeId as NodeId]?.short || r.nodeId}<div className="text-[10px] text-slate-400">{r.actor}</div></td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{KIND_META[r.kind as ActionKind]?.label || r.kind}<div className="text-[10px] text-slate-500 font-semibold">{r.targetCode}</div></td>
                    <td className="py-1.5 pr-2"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${S.cls}`}>{S.label}</span></td>
                    <td className="py-1.5 text-slate-600">{r.message}{r.duplicateHits > 0 && <span className="ml-1 text-[10px] font-semibold text-slate-500">· re-sent ×{r.duplicateHits}, ignored</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card">
        <button onClick={() => setShowHow(s => !s)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-900">
          How this works
          {showHow ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showHow && (
          <div className="px-4 pb-4 grid lg:grid-cols-2 gap-4 text-xs text-slate-700">
            <div className="space-y-2">
              <p><b>Saved locally first.</b> Every entry goes into this terminal&apos;s outbox (browser storage) with the values the station last saw. It survives reloads and dead links, and leaves only when HQ returns a receipt for it.</p>
              <p><b>Sealed.</b> Each entry carries a SHA-256 of its exact content, and the batch carries a hash of all of them. HQ recomputes both and rejects anything that does not match.</p>
              <p><b>Applied once.</b> HQ stores a receipt per entry ID. If a reply is lost and the station sends again, HQ recognises the ID and answers “already had it” instead of applying it twice.</p>
              <p><b>Small on the wire.</b> The batch is gzip-compressed; sizes shown are measured in the browser, and airtime uses the site&apos;s current uplink rate (approximate figures per satellite service).</p>
              <p><b>Automatic.</b> While anything is waiting and the terminal is online, it retries every few seconds, backing off up to 2 minutes when the satellite link is down.</p>
            </div>
            <table className="w-full self-start">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="py-1.5 pr-2 font-semibold">Entry</th>
                  <th className="py-1.5 pr-2 font-semibold">Merge rule</th>
                </tr>
              </thead>
              <tbody>
                {(Object.keys(KIND_META) as ActionKind[]).map(k => (
                  <tr key={k} className="border-b border-slate-50 align-top">
                    <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">{KIND_META[k].label}</td>
                    <td className="py-1.5"><span className="text-[10px] font-bold px-1.5 rounded bg-sky-50 text-sky-700 border border-sky-200 mr-1">{KIND_META[k].ruleTag}</span>{KIND_META[k].rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1"><Timer className="w-3 h-3" /> Link rates are approximate; satellite states are set by hand here to demonstrate behaviour.</p>
    </div>
  );
}
