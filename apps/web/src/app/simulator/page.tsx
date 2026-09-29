'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SlidersHorizontal,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Ship,
  Package,
  User,
  Users,
  Flag,
  Fuel,
  Wrench,
  Building2,
  CloudSnow,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Lightbulb,
  BedDouble,
  Bell,
  BookOpen,
  ListTree,
  Loader2,
  ShieldCheck,
  Layers
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Shared look for health levels
// ---------------------------------------------------------------------------

type Level = 'OK' | 'WATCH' | 'AT_RISK' | 'BLOCKED' | 'INFO';

const LEVEL_STYLE: Record<Level, { label: string; badge: string; dot: string; panel: string; text: string }> = {
  OK: { label: 'On track', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', panel: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  WATCH: { label: 'Watch', badge: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500', panel: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
  AT_RISK: { label: 'At risk', badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', panel: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
  BLOCKED: { label: 'Blocked', badge: 'bg-rose-600 text-white border-rose-700', dot: 'bg-rose-700', panel: 'bg-rose-100 border-rose-300', text: 'text-rose-800' },
  INFO: { label: 'Info', badge: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400', panel: 'bg-slate-50 border-slate-200', text: 'text-slate-600' }
};

function LevelBadge({ level, small }: { level: Level; small?: boolean }) {
  const s = LEVEL_STYLE[level] || LEVEL_STYLE.INFO;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${small ? 'text-[10px] px-1.5 py-0' : 'text-[11px] px-2 py-0.5'} ${s.badge}`}>
      {s.label}
    </span>
  );
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—';
const fmtNum = (n?: number | null) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-IN'));
const stationName = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const marginText = (m: number | null) => (m === null ? 'no resupply' : m < 0 ? `short ${-m}d` : `${m}d spare`);
const marginLevel = (m: number | null): Level => (m === null ? 'OK' : m < 0 ? 'AT_RISK' : m < 3 ? 'WATCH' : 'OK');

// ---------------------------------------------------------------------------
// Scenario builder model
// ---------------------------------------------------------------------------

type Disruption =
  | { uid: string; type: 'TRANSPORT'; transportId: string; fromStop: number | null; delayDays: number; reason?: string }
  | { uid: string; type: 'WEATHER'; station: string; multiplier: number; durationDays: number; label?: string }
  | { uid: string; type: 'ASSET'; assetId: string; outageDays: number; reason?: string }
  | { uid: string; type: 'PERSON'; personId: string; reason?: string }
  | { uid: string; type: 'EXTRA'; station: string; count: number; durationDays: number; reason?: string };

const uid = () => Math.random().toString(36).slice(2, 9);
const idOf = (x: any) => String(x?._id ?? x?.id ?? '');

const DISRUPTION_META: Record<Disruption['type'], { label: string; icon: any }> = {
  TRANSPORT: { label: 'Transport delay', icon: Ship },
  WEATHER: { label: 'Bad weather', icon: CloudSnow },
  ASSET: { label: 'Equipment failure', icon: Wrench },
  PERSON: { label: 'Person unavailable', icon: User },
  EXTRA: { label: 'Extra people', icon: Users }
};

interface RefData {
  transports: any[];
  assets: any[];
  people: any[];
}

function openStops(t: any): any[] {
  return (t?.schedule || []).filter((s: any) => s.status !== 'DEPARTED' && s.status !== 'ARRIVED');
}

function presetToDisruptions(input: any, ref: RefData): Disruption[] {
  const out: Disruption[] = [];
  const findT = (r: string) => ref.transports.find(t => idOf(t) === r || t.name?.toLowerCase() === r.toLowerCase());
  const findA = (r: string) => ref.assets.find(a => idOf(a) === r || a.assetCode?.toLowerCase() === r.toLowerCase());
  const findP = (r: string) => ref.people.find(p => idOf(p) === r || p.name?.toLowerCase() === r.toLowerCase());
  for (const d of input.transportDelays || []) out.push({ uid: uid(), type: 'TRANSPORT', transportId: findT(d.transportId)?.name || d.transportId, fromStop: d.fromStop ?? null, delayDays: d.delayDays, reason: d.reason });
  for (const w of input.weather || []) out.push({ uid: uid(), type: 'WEATHER', station: w.station, multiplier: w.fuelBurnMultiplier, durationDays: w.durationDays, label: w.label });
  for (const a of input.assetFailures || []) out.push({ uid: uid(), type: 'ASSET', assetId: findA(a.assetId)?.assetCode || a.assetId, outageDays: a.outageDays, reason: a.reason });
  for (const p of input.personnelUnavailable || []) out.push({ uid: uid(), type: 'PERSON', personId: findP(p.personId)?.name || p.personId, reason: p.reason });
  for (const x of input.extraPeople || []) out.push({ uid: uid(), type: 'EXTRA', station: x.station, count: x.count, durationDays: x.durationDays, reason: x.reason });
  return out;
}

function disruptionsToInput(list: Disruption[], name: string) {
  return {
    name,
    transportDelays: list.filter((d): d is Extract<Disruption, { type: 'TRANSPORT' }> => d.type === 'TRANSPORT')
      .map(d => ({ transportId: d.transportId, fromStop: d.fromStop ?? undefined, delayDays: d.delayDays, reason: d.reason })),
    weather: list.filter((d): d is Extract<Disruption, { type: 'WEATHER' }> => d.type === 'WEATHER')
      .map(d => ({ station: d.station, fuelBurnMultiplier: d.multiplier, durationDays: d.durationDays, label: d.label || 'Bad weather' })),
    assetFailures: list.filter((d): d is Extract<Disruption, { type: 'ASSET' }> => d.type === 'ASSET')
      .map(d => ({ assetId: d.assetId, outageDays: d.outageDays, reason: d.reason })),
    personnelUnavailable: list.filter((d): d is Extract<Disruption, { type: 'PERSON' }> => d.type === 'PERSON')
      .map(d => ({ personId: d.personId, reason: d.reason })),
    extraPeople: list.filter((d): d is Extract<Disruption, { type: 'EXTRA' }> => d.type === 'EXTRA')
      .map(d => ({ station: d.station, count: d.count, durationDays: d.durationDays, reason: d.reason }))
  };
}

function newDisruption(type: Disruption['type'], ref: RefData): Disruption {
  switch (type) {
    case 'TRANSPORT': {
      const t = ref.transports.find(x => openStops(x).length) || ref.transports[0];
      return { uid: uid(), type, transportId: t?.name || idOf(t), fromStop: openStops(t)[0]?.stopNumber ?? null, delayDays: 3 };
    }
    case 'WEATHER':
      return { uid: uid(), type, station: 'BHARATI', multiplier: 1.3, durationDays: 7 };
    case 'ASSET': {
      const a = ref.assets[0];
      return { uid: uid(), type, assetId: a?.assetCode || idOf(a), outageDays: 7 };
    }
    case 'PERSON': {
      const p = ref.people[0];
      return { uid: uid(), type, personId: p?.name || idOf(p) };
    }
    case 'EXTRA':
      return { uid: uid(), type, station: 'BHARATI', count: 4, durationDays: 7 };
  }
}

// ---------------------------------------------------------------------------
// Small form controls
// ---------------------------------------------------------------------------

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function NumberField({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-sky-600" />
        <span className="w-16 text-right text-xs font-bold text-slate-900 tabular-nums">{value}{suffix}</span>
      </div>
    </Field>
  );
}

function DisruptionEditor({ d, refData: ref, onChange, onRemove }: { d: Disruption; refData: RefData; onChange: (d: Disruption) => void; onRemove: () => void }) {
  const Meta = DISRUPTION_META[d.type];
  const Icon = Meta.icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Icon className="w-3.5 h-3.5 text-sky-600" /> {Meta.label}
        </span>
        <button onClick={onRemove} className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Remove this change">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {d.type === 'TRANSPORT' && (() => {
        const t = ref.transports.find(x => x.name === d.transportId || idOf(x) === d.transportId || x.name?.toLowerCase() === d.transportId?.toLowerCase());
        const stops = openStops(t);
        return (
          <>
            <Field label="Transport">
              <select className={inputCls} value={t?.name || d.transportId} onChange={e => {
                const val = e.target.value;
                const nt = ref.transports.find(x => x.name === val || idOf(x) === val);
                onChange({ ...d, transportId: nt?.name || val, fromStop: openStops(nt)[0]?.stopNumber ?? null });
              }}>
                {ref.transports.filter(x => openStops(x).length).map(x => <option key={x.name || idOf(x)} value={x.name || idOf(x)}>{x.name}</option>)}
              </select>
            </Field>
            <Field label="Late from which stop (this and every later stop move)">
              <select className={inputCls} value={d.fromStop ?? ''} onChange={e => onChange({ ...d, fromStop: Number(e.target.value) })}>
                {stops.map((s: any) => <option key={s.stopNumber} value={s.stopNumber}>Stop {s.stopNumber}: {s.portOrStation} (due {fmtDate(s.estimatedArrival || s.scheduledArrival)})</option>)}
              </select>
            </Field>
            <NumberField label="Delay" value={d.delayDays} min={1} max={30} suffix=" days" onChange={n => onChange({ ...d, delayDays: n })} />
          </>
        );
      })()}

      {d.type === 'WEATHER' && (
        <>
          <Field label="Station">
            <select className={inputCls} value={d.station} onChange={e => onChange({ ...d, station: e.target.value })}>
              <option value="BHARATI">Bharati</option>
              <option value="MAITRI">Maitri</option>
            </select>
          </Field>
          <NumberField label="Extra fuel use for heating & power" value={Math.round((d.multiplier - 1) * 100)} min={5} max={100} step={5} suffix="%" onChange={n => onChange({ ...d, multiplier: 1 + n / 100 })} />
          <NumberField label="How long" value={d.durationDays} min={1} max={45} suffix=" days" onChange={n => onChange({ ...d, durationDays: n })} />
        </>
      )}

      {d.type === 'ASSET' && (() => {
        const a = ref.assets.find(x => x.assetCode === d.assetId || idOf(x) === d.assetId || x.assetCode?.toLowerCase() === d.assetId?.toLowerCase());
        return (
          <>
            <Field label="Equipment">
              <select className={inputCls} value={a?.assetCode || d.assetId} onChange={e => onChange({ ...d, assetId: e.target.value })}>
                {ref.assets.map(item => <option key={item.assetCode || idOf(item)} value={item.assetCode || idOf(item)}>{item.assetCode} · {stationName(item.location)}</option>)}
              </select>
            </Field>
            <NumberField label="Out of service for" value={d.outageDays} min={1} max={60} suffix=" days" onChange={n => onChange({ ...d, outageDays: n })} />
          </>
        );
      })()}

      {d.type === 'PERSON' && (() => {
        const p = ref.people.find(x => x.name === d.personId || idOf(x) === d.personId || x.name?.toLowerCase() === d.personId?.toLowerCase());
        return (
          <Field label="Person (people assigned to missions)">
            <select className={inputCls} value={p?.name || d.personId} onChange={e => onChange({ ...d, personId: e.target.value })}>
              {ref.people.map(item => <option key={item.name || idOf(item)} value={item.name || idOf(item)}>{item.name} · {item.role}</option>)}
            </select>
          </Field>
        );
      })()}

      {d.type === 'EXTRA' && (
        <>
          <Field label="Station">
            <select className={inputCls} value={d.station} onChange={e => onChange({ ...d, station: e.target.value })}>
              <option value="BHARATI">Bharati</option>
              <option value="MAITRI">Maitri</option>
            </select>
          </Field>
          <NumberField label="Extra people" value={d.count} min={1} max={30} onChange={n => onChange({ ...d, count: n })} />
          <NumberField label="Staying for" value={d.durationDays} min={1} max={45} suffix=" days" onChange={n => onChange({ ...d, durationDays: n })} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result views
// ---------------------------------------------------------------------------

const NODE_ICON: Record<string, any> = {
  TRANSPORT: Ship, CRATE: Package, PERSON: User, MISSION: Flag, INVENTORY: Fuel,
  ASSET: Wrench, STATION: BedDouble, WEATHER: CloudSnow, SUMMARY: Layers
};

function ImpactNodeView({ node, depth }: { node: any; depth: number }) {
  const hasKids = node.children?.length > 0;
  const [open, setOpen] = useState(depth < 1 || node.status !== 'OK');
  const Icon = NODE_ICON[node.kind] || Info;
  const s = LEVEL_STYLE[node.status as Level] || LEVEL_STYLE.INFO;
  return (
    <div className={depth > 0 ? 'pl-4 border-l border-slate-200 ml-2' : ''}>
      <div className={`flex items-start gap-2 rounded-lg px-2 py-2 ${depth === 0 ? `border ${s.panel}` : 'hover:bg-slate-50'}`}>
        <button
          onClick={() => hasKids && setOpen(o => !o)}
          className={`mt-0.5 shrink-0 ${hasKids ? 'text-slate-500 hover:text-slate-900' : 'text-transparent cursor-default'}`}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${s.text}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-xs ${depth === 0 ? 'font-bold' : 'font-semibold'} text-slate-900`}>{node.label}</span>
            {(node.before || node.after) && (
              <span className="inline-flex items-center gap-1 text-[11px]">
                <span className="text-slate-500 line-through decoration-slate-300">{node.before}</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className={`font-bold ${s.text}`}>{node.after}</span>
              </span>
            )}
            {node.status !== 'INFO' && <LevelBadge level={node.status} small />}
          </div>
          {node.note && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{node.note}</p>}
        </div>
      </div>
      {hasKids && open && (
        <div className="mt-1 space-y-1">
          {node.children.map((c: any, i: number) => <ImpactNodeView key={i} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

function Scorecard({ r }: { r: any }) {
  const sc = r.scorecard;
  const tiles = [
    {
      icon: Flag,
      title: 'Missions with new problems',
      value: sc.missionsAtRisk.newlyAffected.length,
      sub: sc.missionsAtRisk.newlyAffected.length ? sc.missionsAtRisk.newlyAffected.join(', ') : 'none',
      level: (sc.missionsAtRisk.newlyAffected.length ? 'AT_RISK' : 'OK') as Level
    },
    ...sc.fuel.map((f: any) => ({
      icon: Fuel,
      title: `${stationName(f.station)} fuel before resupply`,
      value: marginText(f.scenarioMargin),
      sub: `today: ${marginText(f.baselineMargin)}`,
      level: marginLevel(f.scenarioMargin)
    })),
    ...sc.beds.filter((b: any) => b.baselineDays || b.scenarioDays).map((b: any) => ({
      icon: BedDouble,
      title: `${stationName(b.station)} days over bed limit`,
      value: `${b.scenarioDays}d`,
      sub: `today: ${b.baselineDays}d`,
      level: (b.scenarioDays > b.baselineDays ? 'WATCH' : 'OK') as Level
    })),
    {
      icon: Bell,
      title: 'Warnings',
      value: `${sc.alerts.scenario}`,
      sub: `today ${sc.alerts.baseline} · +${sc.alerts.added} new · −${sc.alerts.resolved} gone`,
      level: (sc.alerts.added ? 'WATCH' : 'OK') as Level
    }
  ];
  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      {tiles.map((t, i) => {
        const Icon = t.icon;
        return (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 shadow-card">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Icon className="w-3.5 h-3.5" /> {t.title}
            </div>
            <div className={`mt-1 text-lg font-extrabold ${LEVEL_STYLE[t.level as Level].text}`}>{t.value}</div>
            <div className="text-[11px] text-slate-500 truncate" title={t.sub}>{t.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

function DecisionsView({ decisions }: { decisions: any[] }) {
  if (!decisions.length) {
    return <EmptyNote text="Nothing in this scenario needs a decision — no new mission, fuel or bed problem is created." />;
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Each option is calculated from the plan data. The system does not act on them — a person decides.</p>
      {decisions.map((d, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">{d.problem}</h4>
              {d.detail?.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {d.detail.map((t: string, j: number) => <li key={j} className="text-xs text-slate-600">• {t}</li>)}
                </ul>
              )}
            </div>
            <LevelBadge level={d.severity} />
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {d.options.map((o: any, j: number) => (
              <div key={j} className={`rounded-lg border p-3 space-y-1.5 ${o.feasible ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 bg-slate-50/30 opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{j + 1}. {o.title}</span>
                  <span className={`text-[10px] font-semibold px-1.5 rounded border whitespace-nowrap ${o.feasible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {o.feasible ? 'Possible' : 'Not possible'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{o.effect}</p>
                {o.tradeOff && o.tradeOff !== '—' && (
                  <p className="text-[11px] text-slate-500 leading-relaxed"><span className="font-semibold text-slate-600">Trade-off: </span>{o.tradeOff}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MissionsView({ missions }: { missions: any[] }) {
  return (
    <div className="space-y-3">
      {missions.map(m => (
        <div key={m.missionId} className={`bg-white border rounded-xl p-4 shadow-card ${m.changed ? 'border-slate-300' : 'border-slate-200'}`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{m.code}</span>
                <span className="text-[11px] text-slate-500">{stationName(m.station)} · priority {m.priority} · {fmtDate(m.startDate)}–{fmtDate(m.endDate)}</span>
              </div>
              <h4 className="mt-1 text-sm font-bold text-slate-900 truncate">{m.title}</h4>
            </div>
            <div className="flex items-center gap-2 text-[11px] shrink-0">
              <span className="text-slate-500">Today</span> <LevelBadge level={m.baselineLevel} />
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">Scenario</span> <LevelBadge level={m.scenarioLevel} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            {m.newReasons.map((r: any) => <ReasonLine key={r.key} tag="New" tagCls="bg-rose-600 text-white" text={r.text} />)}
            {m.worsenedReasons.map((r: any) => <ReasonLine key={r.key} tag="Changed" tagCls="bg-amber-500 text-white" text={r.text} was={r.before} />)}
            {m.resolvedReasons.map((r: any) => <ReasonLine key={r.key} tag="Gone" tagCls="bg-emerald-600 text-white" text={r.text} />)}
            {m.unchangedReasons.length > 0 && (
              <details className="text-slate-500">
                <summary className="cursor-pointer text-[11px] font-semibold">{m.unchangedReasons.length} existing issue{m.unchangedReasons.length === 1 ? '' : 's'} (same as today)</summary>
                <div className="mt-1.5 space-y-1">
                  {m.unchangedReasons.map((r: any) => <ReasonLine key={r.key} tag="Today" tagCls="bg-slate-200 text-slate-700" text={r.text} />)}
                </div>
              </details>
            )}
            {!m.changed && m.unchangedReasons.length === 0 && <p className="text-[11px] text-emerald-700">No issues today or in this scenario.</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReasonLine({ tag, tagCls, text, was }: { tag: string; tagCls: string; text: string; was?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 text-[9px] font-bold uppercase px-1.5 rounded ${tagCls}`}>{tag}</span>
      <div className="text-slate-700 leading-relaxed">
        {text}
        {was && <div className="text-[11px] text-slate-400 line-through">{was}</div>}
      </div>
    </div>
  );
}

function FuelView({ fuel }: { fuel: any[] }) {
  return (
    <div className="space-y-4">
      {fuel.map(f => {
        // Show the stretch that matters: from today until a week after the later resupply.
        const startMs = new Date(f.series[0].date).getTime();
        const resupplyDay = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - startMs) / 86400000) : 0);
        const lastDay = Math.min(f.series.length - 1, Math.max(resupplyDay(f.baseline.resupplyDate), resupplyDay(f.scenario.resupplyDate), 14) + 7);
        const data = f.series.slice(0, lastDay + 1).map((p: any) => ({ date: fmtDate(p.date), Today: p.baseline, Scenario: p.scenario }));
        const yMax = Math.ceil((f.stockNow * 1.15) / 10000) * 10000;
        const sameResupply = fmtDate(f.baseline.resupplyDate) === fmtDate(f.scenario.resupplyDate);
        const changed = f.baseline.marginDays !== f.scenario.marginDays || f.baseline.burnRate !== f.scenario.peakBurnRate;
        const rows = [
          ['Fuel use per day', `${fmtNum(f.baseline.burnRate)} ${f.unit}`, f.scenario.peakBurnRate !== f.baseline.burnRate ? `up to ${fmtNum(f.scenario.peakBurnRate)} ${f.unit}` : `${fmtNum(f.scenario.burnRate)} ${f.unit}`],
          [`Reaches safety minimum (${fmtNum(f.minimumLevel)} ${f.unit})`, fmtDate(f.baseline.breachDate), fmtDate(f.scenario.breachDate)],
          [`Resupply lands${f.scenario.resupplyCrate ? ` (${f.scenario.resupplyCrate})` : ''}`, fmtDate(f.baseline.resupplyDate), fmtDate(f.scenario.resupplyDate)],
          ['Time left before resupply', marginText(f.baseline.marginDays), marginText(f.scenario.marginDays)]
        ];
        return (
          <div key={f.station} className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><Fuel className="w-4 h-4 text-amber-600" /> {stationName(f.station)} · {f.itemName}</h4>
              <LevelBadge level={f.status} />
            </div>
            <div className="grid lg:grid-cols-5 gap-4">
              <table className="lg:col-span-2 w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold pb-1"></th>
                    <th className="text-right font-semibold pb-1">Today</th>
                    <th className="text-right font-semibold pb-1">Scenario</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, a, b], i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1.5 pr-2 text-slate-600">{k}</td>
                      <td className="py-1.5 text-right text-slate-500">{a}</td>
                      <td className={`py-1.5 text-right font-bold ${a !== b ? 'text-slate-900' : 'text-slate-500'}`}>{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="lg:col-span-3 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(1, Math.floor(data.length / 7))} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} width={36} domain={[0, yMax]} allowDataOverflow />
                    <Tooltip formatter={(v: any) => `${fmtNum(v)} ${f.unit}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={f.minimumLevel} stroke="#e11d48" strokeDasharray="4 4" label={{ value: 'safety minimum', fontSize: 10, fill: '#e11d48', position: 'insideBottomLeft' }} />
                    {f.baseline.resupplyDate && (
                      <ReferenceLine x={fmtDate(f.baseline.resupplyDate)} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: sameResupply ? 'resupply' : 'resupply today', fontSize: 10, fill: '#64748b', position: 'insideTopLeft' }} />
                    )}
                    {f.scenario.resupplyDate && !sameResupply && (
                      <ReferenceLine x={fmtDate(f.scenario.resupplyDate)} stroke="#0284c7" strokeDasharray="3 3" label={{ value: 'resupply in scenario', fontSize: 10, fill: '#0284c7', position: 'insideTopRight' }} />
                    )}
                    <Line type="monotone" dataKey="Today" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                    <Line type="monotone" dataKey="Scenario" stroke={changed ? '#0284c7' : '#94a3b8'} dot={false} strokeWidth={2.25} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">Stock falls day by day; the vertical lines mark when resupply lands (after that the line leaves the top of the chart). If a line crosses the red safety line before its resupply marker, the station has to use reserve fuel.</p>
          </div>
        );
      })}
    </div>
  );
}

function BedsView({ occupancy }: { occupancy: any[] }) {
  return (
    <div className="space-y-4">
      {occupancy.map(o => {
        const data = o.series.map((p: any) => ({ date: fmtDate(p.date), Today: p.baseline, Scenario: p.scenario }));
        const w = (x: any) => (x ? `${fmtDate(x.from)}–${fmtDate(x.to)}, up to ${x.peak} people` : 'never');
        return (
          <div key={o.station} className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><BedDouble className="w-4 h-4 text-sky-600" /> {stationName(o.station)} · {o.beds} beds</h4>
              <span className="text-[11px] text-slate-600">
                Over the limit — today: <b>{w(o.baselineWindow)}</b> · scenario: <b>{w(o.scenarioWindow)}</b>
              </span>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={6} />
                  <YAxis tick={{ fontSize: 10 }} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={o.beds} stroke="#e11d48" strokeDasharray="4 4" label={{ value: 'beds', fontSize: 10, fill: '#e11d48', position: 'insideTopRight' }} />
                  <Line type="stepAfter" dataKey="Today" stroke="#94a3b8" strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
                  <Line type="stepAfter" dataKey="Scenario" stroke="#0284c7" dot={false} strokeWidth={2.25} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertsView({ alerts }: { alerts: any }) {
  const Row = ({ a, tag, tagCls }: { a: any; tag: string; tagCls: string }) => (
    <div className="flex items-start gap-2 py-2 border-t border-slate-100 first:border-t-0">
      <span className={`mt-0.5 text-[9px] font-bold uppercase px-1.5 rounded ${tagCls}`}>{tag}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-900">{a.title} <span className="text-[10px] font-bold text-slate-500">· {a.severity}</span></div>
        <div className="text-[11px] text-slate-600">{a.description}</div>
      </div>
    </div>
  );
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
      <p className="text-xs text-slate-500 mb-2">
        The same warning rules as the Risk Bottlenecks page, run on the scenario copy. Today: {alerts.baselineCount} warnings · scenario: {alerts.scenarioCount} ({alerts.unchangedCount} unchanged).
      </p>
      {alerts.newAlerts.map((a: any) => <Row key={a.id} a={a} tag="New" tagCls="bg-rose-600 text-white" />)}
      {alerts.changedAlerts.map((c: any) => <Row key={c.after.id} a={c.after} tag={c.before.severity !== c.after.severity ? `${c.before.severity}→${c.after.severity}` : 'Changed'} tagCls="bg-amber-500 text-white" />)}
      {alerts.resolvedAlerts.map((a: any) => <Row key={a.id} a={a} tag="Gone" tagCls="bg-emerald-600 text-white" />)}
      {!alerts.newAlerts.length && !alerts.changedAlerts.length && !alerts.resolvedAlerts.length && <EmptyNote text="No warning appears, changes or disappears in this scenario." />}
    </div>
  );
}

function AssumptionsView({ r }: { r: any }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-2">
        <h4 className="text-sm font-bold text-slate-900">Changes applied to the copy</h4>
        {r.applied.map((a: any, i: number) => (
          <div key={i} className="text-xs border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
            <div className="font-semibold text-slate-900">{a.label}</div>
            <div className="text-slate-600 leading-relaxed">{a.detail}</div>
            {a.warnings.map((w: string, j: number) => <div key={j} className="text-amber-700 mt-0.5">⚠ {w}</div>)}
          </div>
        ))}
        <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
          Checked: {r.checked.crates} crates in transit, {r.checked.people} people, {r.checked.missions} active missions.
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-2">
        <h4 className="text-sm font-bold text-slate-900">How the numbers are calculated</h4>
        <ol className="space-y-1.5 list-decimal pl-4">
          {r.assumptions.map((a: string, i: number) => <li key={i} className="text-xs text-slate-700 leading-relaxed">{a}</li>)}
        </ol>
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">{text}</div>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = 'SPREAD' | 'DECIDE' | 'MISSIONS' | 'FUEL' | 'BEDS' | 'ALERTS' | 'HOW';

export default function SimulatorPage() {
  const [presets, setPresets] = useState<any[]>([]);
  const [ref, setRef] = useState<RefData>({ transports: [], assets: [], people: [] });
  const [disruptions, setDisruptions] = useState<Disruption[]>([]);
  const [activePreset, setActivePreset] = useState<any | null>(null);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('SPREAD');

  const loadReferenceData = useCallback(async () => {
    try {
      const [p, t, a, m, people] = await Promise.all([
        api.getScenarioPresets(), api.getTransport(), api.getAssets(), api.getMissions(), api.getPeople()
      ]);
      setPresets(p?.data || []);
      const onMissions = new Set<string>((m?.data || []).flatMap((x: any) => x.peopleIds || []));
      setRef({
        transports: t?.data || [],
        assets: a?.data || [],
        people: (people?.data || []).filter((x: any) => onMissions.has(idOf(x)))
      });
    } catch (err: any) {
      setError(String(err?.message || err));
    }
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadReferenceData();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadReferenceData]);

  const run = async (input: any) => {
    setRunning(true);
    setError(null);
    try {
      const res = await api.simulateScenario(input);
      if (res?.error) throw new Error(res.error.message);
      setResult(res?.data);
    } catch (e: any) {
      setError(e?.message || 'Simulation failed');
    } finally {
      setRunning(false);
    }
  };

  const choosePreset = (p: any) => {
    setActivePreset(p);
    setDisruptions(presetToDisruptions(p.scenarioInput, ref));
    setTab('SPREAD');
    run(p.scenarioInput);
  };

  const editDisruptions = (next: Disruption[]) => {
    setDisruptions(next);
    setActivePreset(null);
  };

  const runCustom = () => run(disruptionsToInput(disruptions, activePreset?.name || 'Custom scenario'));

  const reset = () => {
    setDisruptions([]);
    setActivePreset(null);
    setResult(null);
  };

  const tabs = useMemo(() => {
    if (!result) return [];
    return [
      { id: 'SPREAD' as Tab, label: 'How it spreads', icon: ListTree },
      { id: 'DECIDE' as Tab, label: `What you can do (${result.decisions.length})`, icon: Lightbulb },
      { id: 'MISSIONS' as Tab, label: 'Missions', icon: Flag },
      { id: 'FUEL' as Tab, label: 'Fuel', icon: Fuel },
      { id: 'BEDS' as Tab, label: 'Beds', icon: BedDouble },
      { id: 'ALERTS' as Tab, label: `Warnings (+${result.alerts.newAlerts.length})`, icon: Bell },
      { id: 'HOW' as Tab, label: 'How this is calculated', icon: BookOpen }
    ];
  }, [result]);

  const verdictStyle = result ? LEVEL_STYLE[result.verdict.level as Level] : LEVEL_STYLE.INFO;
  const VerdictIcon = !result ? Info : result.verdict.level === 'OK' ? CheckCircle2 : result.verdict.level === 'WATCH' ? AlertTriangle : XCircle;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-sky-600" /> What-If Simulator
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Try a change — a late ship, a blizzard, a broken machine, a missing person — on a copy of today&apos;s plan.
            The simulator follows the real links between transport, cargo, people, fuel, equipment and missions,
            shows exactly what is affected and why, and lists options. The live plan is never changed.
          </p>
        </div>
        <span className="self-start md:self-auto inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3.5 h-3.5" /> Live plan untouched{result ? ` · plan date ${fmtDate(result.simulatedAt)}` : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: choose & build */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
            <h2 className="text-sm font-bold text-slate-900">1. Pick a question</h2>
            <div className="space-y-2">
              {presets.map(p => {
                const active = activePreset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => choosePreset(p)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${active ? 'border-sky-400 bg-sky-50 ring-1 ring-sky-200' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{p.name}</span>
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{p.tag}</span>
                    </div>
                    <p className="text-[11px] text-sky-800 mt-0.5">{p.question}</p>
                    {active && <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{p.description}</p>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">2. Adjust or build your own</h2>
              {disruptions.length > 0 && (
                <button onClick={reset} className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            {disruptions.length === 0 && <p className="text-[11px] text-slate-500">Pick a question above, or add changes below. You can combine several.</p>}
            {disruptions.map((d, i) => (
              <DisruptionEditor
                key={d.uid}
                d={d}
                refData={ref}
                onChange={nd => editDisruptions(disruptions.map((x, j) => (j === i ? nd : x)))}
                onRemove={() => editDisruptions(disruptions.filter((_, j) => j !== i))}
              />
            ))}
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DISRUPTION_META) as Disruption['type'][]).map(t => {
                const M = DISRUPTION_META[t];
                const Icon = M.icon;
                return (
                  <button
                    key={t}
                    onClick={() => editDisruptions([...disruptions, newDisruption(t, ref)])}
                    disabled={!ref.transports.length}
                    className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:border-sky-400 hover:text-sky-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" /> <Icon className="w-3 h-3" /> {M.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={runCustom}
              disabled={running || disruptions.length === 0}
              className="w-full mt-1 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {running ? 'Simulating…' : 'Run simulation'}
            </button>
          </div>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-8 space-y-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</div>}

          {!result && !running && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-card space-y-4">
              <h3 className="text-sm font-bold text-slate-900">How to read the results</h3>
              <div className="grid md:grid-cols-3 gap-3 text-xs text-slate-600">
                {[
                  ['Verdict', 'One sentence on what the change does, with the key facts underneath.'],
                  ['How it spreads', 'A tree from the change to everything it touches: cargo, people, fuel, equipment, missions — with before → after dates.'],
                  ['What you can do', 'Options calculated from the data (wait, re-route, use a backup, cut fuel use) with their trade-offs.']
                ].map(([t, d]) => (
                  <div key={t} className="rounded-xl border border-slate-200 p-3">
                    <div className="font-bold text-slate-900 mb-1">{t}</div>
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 items-center">
                Status colours: {(['OK', 'WATCH', 'AT_RISK', 'BLOCKED'] as Level[]).map(l => <LevelBadge key={l} level={l} />)}
                <span className="text-slate-500">“Watch” = under 3 days of slack.</span>
              </div>
            </div>
          )}

          {running && !result && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-card flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Simulating on a copy of the plan…
            </div>
          )}

          {result && (
            <div className={`space-y-5 transition-opacity ${running ? 'opacity-60' : ''}`}>
              {/* Verdict */}
              <div className={`rounded-2xl border p-4 ${verdictStyle.panel}`}>
                <div className="flex items-start gap-3">
                  <VerdictIcon className={`w-5 h-5 mt-0.5 shrink-0 ${verdictStyle.text}`} />
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge level={result.verdict.level} />
                      <h3 className="text-sm font-bold text-slate-900">{result.verdict.headline}</h3>
                    </div>
                    {result.verdict.bullets.length > 0 && (
                      <ul className="space-y-1">
                        {result.verdict.bullets.map((b: string, i: number) => (
                          <li key={i} className="text-xs text-slate-700 leading-relaxed flex gap-2"><span className="text-slate-400">•</span><span>{b}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <Scorecard r={result} />

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-slate-200">
                {tabs.map(t => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 -mb-px transition-colors ${active ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  );
                })}
              </div>

              {tab === 'SPREAD' && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
                  <p className="text-xs text-slate-500">
                    Each branch follows a real link in the plan (carried by → needed by → runs on). Dates show <span className="line-through">today</span> → scenario. Click a row to expand or collapse it.
                  </p>
                  {result.impactTree.length ? result.impactTree.map((n: any, i: number) => <ImpactNodeView key={i} node={n} depth={0} />) : <EmptyNote text="No changes applied." />}
                  {result.checked.unaffectedMissions.length > 0 && (
                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <CheckCircle2 className="inline w-3 h-3 text-emerald-600 mr-1" />
                      Checked and not affected: {result.checked.unaffectedMissions.join(', ')}.
                    </p>
                  )}
                </div>
              )}
              {tab === 'DECIDE' && <DecisionsView decisions={result.decisions} />}
              {tab === 'MISSIONS' && <MissionsView missions={result.missions} />}
              {tab === 'FUEL' && <FuelView fuel={result.fuel} />}
              {tab === 'BEDS' && <BedsView occupancy={result.occupancy} />}
              {tab === 'ALERTS' && <AlertsView alerts={result.alerts} />}
              {tab === 'HOW' && <AssumptionsView r={result} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
