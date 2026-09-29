'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Share2,
  Ship,
  Package,
  User,
  Flag,
  Fuel,
  Wrench,
  Layers,
  RefreshCw,
  FileDown,
  Printer,
  ChevronRight,
  Crosshair,
  Loader2,
  Timer,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Types & styling
// ---------------------------------------------------------------------------

type Kind = 'TRANSPORT' | 'CRATE' | 'PERSON' | 'MISSION' | 'INVENTORY' | 'ASSET';

const KINDS: Array<{ id: Kind; label: string; icon: any }> = [
  { id: 'TRANSPORT', label: 'Transport', icon: Ship },
  { id: 'CRATE', label: 'Cargo', icon: Package },
  { id: 'ASSET', label: 'Equipment', icon: Wrench },
  { id: 'INVENTORY', label: 'Stock', icon: Fuel },
  { id: 'PERSON', label: 'People', icon: User },
  { id: 'MISSION', label: 'Mission', icon: Flag }
];

const TYPE_ICON: Record<string, any> = { TRANSPORT: Ship, CRATE: Package, PERSON: User, MISSION: Flag, INVENTORY: Fuel, ASSET: Wrench, GROUP: Layers };

const QUICK_PICKS: Array<{ type: Kind; code: string; why: string }> = [
  { type: 'TRANSPORT', code: 'MV Vasily Golovnin', why: 'the supply ship' },
  { type: 'CRATE', code: 'CRT-1042', why: 'ice-core drill parts' },
  { type: 'CRATE', code: 'CRT-1118', why: 'missed its flight' },
  { type: 'ASSET', code: 'PB-300-04', why: 'mission snowcat' },
  { type: 'ASSET', code: 'GEN-BHARATI-01', why: 'station power' },
  { type: 'INVENTORY', code: 'FUEL-SAB', why: 'Bharati fuel' },
  { type: 'PERSON', code: 'Gurpreet Singh', why: 'chief engineer' }
];

type Severity = 'root' | 'high' | 'medium' | 'idle';
const severityOf = (effect: string): Severity =>
  effect === 'ROOT' ? 'root'
    : ['BLOCKED', 'NO_EQUIPMENT', 'FUEL_SHORT', 'SHORT_CREW'].includes(effect) ? 'high'
      : effect === 'IDLE' ? 'idle' : 'medium';

const SEV_STYLE: Record<Severity, { box: string; text: string; stroke: string; label: string }> = {
  root: { box: 'bg-sky-50 border-sky-500', text: 'text-sky-700', stroke: '#0284c7', label: 'Trigger' },
  high: { box: 'bg-rose-50 border-rose-400', text: 'text-rose-700', stroke: '#f43f5e', label: 'Directly hit' },
  medium: { box: 'bg-amber-50 border-amber-400', text: 'text-amber-800', stroke: '#f59e0b', label: 'Knock-on' },
  idle: { box: 'bg-slate-50 border-slate-300', text: 'text-slate-600', stroke: '#94a3b8', label: 'Left idle' }
};

const TODAY_DOT: Record<string, string> = { OK: 'bg-emerald-500', WATCH: 'bg-amber-500', AT_RISK: 'bg-rose-500', BLOCKED: 'bg-rose-700' };
const TODAY_LABEL: Record<string, string> = { OK: 'on track', WATCH: 'watch', AT_RISK: 'at risk', BLOCKED: 'blocked' };
const READY_STYLE: Record<string, string> = {
  READY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONDITIONAL: 'bg-amber-50 text-amber-800 border-amber-200',
  NOT_READY: 'bg-slate-100 text-slate-500 border-slate-200'
};
const READY_LABEL: Record<string, string> = { READY: 'Ready', CONDITIONAL: 'With trade-off', NOT_READY: 'Not possible' };

function toleranceChip(t: number | null | undefined) {
  if (t === null || t === undefined) return null;
  const cls = t < 0 ? 'bg-rose-600 text-white' : t < 3 ? 'bg-rose-100 text-rose-700' : t < 7 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700';
  const text = t < 0 ? `already ${-t}d late` : `breaks after ${t}d`;
  return <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-px rounded ${cls}`}><Timer className="w-2.5 h-2.5" />{text}</span>;
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

// ---------------------------------------------------------------------------
// Graph layout: one column per degree of separation
// ---------------------------------------------------------------------------

const NODE_W = 220;
const NODE_H = 66;
const COL_GAP = 84;
const ROW_GAP = 12;
const PAD = 24;
const HEADER_H = 28;

interface Placed { node: any; x: number; y: number; ghost?: boolean; sub?: any }

function layout(data: any, selectedKey: string | null) {
  const nodes: any[] = data.nodes;
  const byTier = new Map<number, any[]>();
  for (const n of nodes) byTier.set(n.tier, [...(byTier.get(n.tier) || []), n]);
  const sevRank: Record<Severity, number> = { root: 0, high: 1, medium: 2, idle: 3 };
  const order = new Map<string, number>();
  const tiers = Array.from(byTier.keys()).sort((a, b) => a - b);
  for (const t of tiers) {
    const col = byTier.get(t)!;
    col.sort((a, b) =>
      (order.get(a.parentKey) ?? 0) - (order.get(b.parentKey) ?? 0)
      || sevRank[severityOf(a.effect)] - sevRank[severityOf(b.effect)]
      || (a.toleranceDays ?? 999) - (b.toleranceDays ?? 999)
      || String(a.code).localeCompare(String(b.code)));
    col.forEach((n, i) => order.set(n.key, i));
  }
  const tallest = Math.max(...tiers.map(t => byTier.get(t)!.length));
  const colHeight = (n: number) => n * NODE_H + (n - 1) * ROW_GAP;
  const maxH = colHeight(tallest);
  const placed = new Map<string, Placed>();
  for (const t of tiers) {
    const col = byTier.get(t)!;
    col.forEach((n, i) => placed.set(n.key, { node: n, x: PAD + t * (NODE_W + COL_GAP), y: PAD + HEADER_H + i * (NODE_H + ROW_GAP) }));
  }

  // Alternatives for the selected node get their own column on the right.
  const ghosts: Placed[] = [];
  const sel = selectedKey ? placed.get(selectedKey) : null;
  const subs = sel?.node.substitutes || [];
  const altX = PAD + (Math.max(...tiers) + 1) * (NODE_W + COL_GAP);
  if (sel && subs.length) {
    const startY = Math.max(PAD + HEADER_H, Math.min(sel.y, PAD + HEADER_H + maxH - colHeight(subs.length)));
    subs.forEach((s: any, i: number) => ghosts.push({ node: { key: `alt:${i}` }, sub: s, ghost: true, x: altX, y: startY + i * (NODE_H + ROW_GAP) }));
  }

  const width = (ghosts.length ? altX + NODE_W : PAD + Math.max(...tiers) * (NODE_W + COL_GAP) + NODE_W) + PAD;
  const height = Math.max(PAD * 2 + HEADER_H + maxH, ghosts.length ? ghosts[ghosts.length - 1].y + NODE_H + PAD : 0);
  return { placed, ghosts, width, height, tiers, altX };
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  if (x2 > x1) {
    const dx = Math.max(40, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  }
  // Link back to an earlier column: loop around underneath.
  const drop = 40;
  return `M ${x1} ${y1} C ${x1 + 60} ${y1 + drop}, ${x2 - 60} ${y2 + drop}, ${x2} ${y2}`;
}

const TIER_NAMES = ['Trigger', '1st degree', '2nd degree', '3rd degree', '4th degree', '5th degree', '6th degree'];

function Graph({ data, selectedKey, onSelect }: { data: any; selectedKey: string | null; onSelect: (k: string) => void }) {
  const { placed, ghosts, width, height, tiers, altX } = useMemo(() => layout(data, selectedKey), [data, selectedKey]);

  const focusKey = selectedKey && selectedKey !== data.root.key ? selectedKey : null;
  const highlighted = useMemo(() => {
    const set = new Set<string>();
    let cur = focusKey ? placed.get(focusKey)?.node : null;
    while (cur) {
      set.add(cur.key);
      cur = cur.parentKey ? placed.get(cur.parentKey)?.node : null;
    }
    return set;
  }, [focusKey, placed]);

  return (
    <div className="relative" style={{ width, height }}>
      <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
        <defs>
          {(['root', 'high', 'medium', 'idle'] as Severity[]).map(s => (
            <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SEV_STYLE[s].stroke} />
            </marker>
          ))}
          <marker id="arrow-alt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
          </marker>
        </defs>
        {data.links.map((l: any, i: number) => {
          const a = placed.get(l.from);
          const b = placed.get(l.to);
          if (!a || !b) return null;
          const sev = severityOf(b.node.effect);
          const onPath = highlighted.has(l.from) && highlighted.has(l.to) && b.node.parentKey === l.from;
          const dim = focusKey && !onPath;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          return (
            <g key={i} opacity={dim ? 0.25 : 1}>
              <path
                d={curve(x1, y1, x2, y2)}
                fill="none"
                stroke={SEV_STYLE[sev].stroke}
                strokeWidth={onPath ? 2.5 : l.kind === 'CASCADE' ? 1.6 : 1.1}
                strokeDasharray={l.kind === 'IDLE' ? '2 4' : l.kind === 'ALSO' ? '6 4' : undefined}
                markerEnd={`url(#arrow-${sev})`}
              />
              {l.kind === 'CASCADE' && x2 > x1 && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 9 }}>
                  {l.label}
                </text>
              )}
            </g>
          );
        })}
        {ghosts.map((g, i) => {
          const s = placed.get(selectedKey!)!;
          return (
            <path key={`g${i}`} d={curve(s.x + NODE_W, s.y + NODE_H / 2, g.x, g.y + NODE_H / 2)} fill="none" stroke="#10b981" strokeWidth={1.4} strokeDasharray="5 4" markerEnd="url(#arrow-alt)" />
          );
        })}
      </svg>

      {tiers.map(t => (
        <div key={t} className="absolute text-[10px] font-bold uppercase tracking-wider text-slate-400" style={{ left: PAD + t * (NODE_W + COL_GAP), top: PAD - 6, width: NODE_W }}>
          {TIER_NAMES[t] || `${t}th degree`}
        </div>
      ))}
      {ghosts.length > 0 && (
        <div className="absolute text-[10px] font-bold uppercase tracking-wider text-emerald-600" style={{ left: altX, top: PAD - 6, width: NODE_W }}>
          Alternatives
        </div>
      )}

      {Array.from(placed.values()).map(({ node, x, y }) => {
        const sev = severityOf(node.effect);
        const s = SEV_STYLE[sev];
        const Icon = TYPE_ICON[node.type] || Info;
        const selected = node.key === selectedKey;
        const dim = focusKey && !highlighted.has(node.key) && !selected;
        const available = node.substitutes?.filter((x: any) => x.readiness !== 'NOT_READY').length || 0;
        return (
          <button
            key={node.key}
            onClick={() => onSelect(node.key)}
            className={`absolute text-left rounded-lg border-2 px-2.5 py-1.5 transition-all shadow-sm hover:shadow-md ${s.box} ${selected ? 'ring-2 ring-offset-1 ring-sky-500' : ''} ${dim ? 'opacity-50' : ''} ${node.type === 'GROUP' ? 'border-dashed' : ''}`}
            style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
            title={node.effectText}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Icon className={`w-3.5 h-3.5 shrink-0 ${s.text}`} />
              <span className="text-[11px] font-bold text-slate-900 truncate">{node.code}</span>
              {node.todayStatus && <span className={`ml-auto w-2 h-2 rounded-full shrink-0 ${TODAY_DOT[node.todayStatus]}`} title={`Today: ${TODAY_LABEL[node.todayStatus]}`} />}
            </div>
            <div className={`text-[10px] leading-tight truncate ${s.text}`}>{node.effect === 'ROOT' ? `If this ${data.failureVerb}` : node.effectText}</div>
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {toleranceChip(node.toleranceDays)}
              {available > 0 && <span className="text-[9px] font-bold px-1.5 py-px rounded bg-emerald-100 text-emerald-700">↺ {available} alternative{available === 1 ? '' : 's'}</span>}
              {node.type === 'GROUP' && <span className="text-[9px] text-slate-500 truncate">{node.label}</span>}
            </div>
          </button>
        );
      })}

      {ghosts.map((g, i) => (
        <div
          key={`ghost${i}`}
          className={`absolute rounded-lg border-2 border-dashed px-2.5 py-1.5 bg-white ${g.sub.readiness === 'READY' ? 'border-emerald-400' : g.sub.readiness === 'CONDITIONAL' ? 'border-amber-300' : 'border-slate-300 opacity-70'}`}
          style={{ left: g.x, top: g.y, width: NODE_W, height: NODE_H }}
          title={`${g.sub.text} ${g.sub.tradeOff || ''}`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-slate-900 truncate">{g.sub.code}</span>
            <span className={`text-[9px] font-bold px-1.5 rounded border shrink-0 ${READY_STYLE[g.sub.readiness]}`}>{READY_LABEL[g.sub.readiness]}</span>
          </div>
          <div className="text-[10px] text-slate-600 truncate">{g.sub.label}</div>
          <div className="text-[10px] text-slate-500 truncate">{g.sub.tradeOff || g.sub.text}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side panel
// ---------------------------------------------------------------------------

function NodePanel({ node, data, onRecentre, onSelect }: { node: any; data: any; onRecentre: (n: any) => void; onSelect: (k: string) => void }) {
  const Icon = TYPE_ICON[node.type] || Info;
  const s = SEV_STYLE[severityOf(node.effect)];
  const parent = node.parentKey ? data.nodes.find((n: any) => n.key === node.parentKey) : null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card space-y-3">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 ${s.text}`} />
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{node.code}</div>
          <div className="text-xs text-slate-500">{node.label}</div>
        </div>
      </div>
      <div className={`rounded-lg border px-3 py-2 text-xs ${s.box.replace('border-', 'border-').replace('-500', '-200').replace('-400', '-200')}`}>
        <div className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}{node.tier > 0 ? ` · ${TIER_NAMES[node.tier] || `${node.tier}th degree`}` : ''}</div>
        <div className="text-slate-800 mt-0.5">{node.effect === 'ROOT' ? `If this ${data.failureVerb}` : node.effectText}</div>
        {parent && (
          <button onClick={() => onSelect(parent.key)} className="mt-1 text-[11px] text-sky-700 hover:underline">
            ← because of {parent.code}
          </button>
        )}
      </div>

      {node.toleranceDays !== null && node.toleranceDays !== undefined && (
        <div className="flex items-center gap-2 text-xs text-slate-700">
          {toleranceChip(node.toleranceDays)}
          <span>{node.toleranceDays < 0 ? 'Already late in today’s plan.' : `The trigger can slip ${node.toleranceDays} day${node.toleranceDays === 1 ? '' : 's'} before this is affected.`}</span>
        </div>
      )}

      {node.todayStatus && (
        <div className="text-xs text-slate-600">
          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${TODAY_DOT[node.todayStatus]}`} />
          Today: <b>{TODAY_LABEL[node.todayStatus]}</b>{node.todayText ? ` — ${node.todayText}` : ''}
        </div>
      )}

      {node.info?.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-600">
          {node.info.map((t: string, i: number) => <li key={i}>• {t}</li>)}
        </ul>
      )}

      {node.causes?.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reached through {node.causes.length} path{node.causes.length === 1 ? '' : 's'}</div>
          {node.causes.map((c: any, i: number) => (
            <button key={i} onClick={() => onSelect(c.fromKey)} className="w-full text-left flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">
              <span className="text-slate-700 truncate">{c.text}</span>
              {toleranceChip(c.toleranceDays)}
            </button>
          ))}
        </div>
      )}

      {node.group && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{node.group.members.length} in this group</div>
          <div className="max-h-56 overflow-auto rounded-md border border-slate-200 divide-y divide-slate-100">
            {node.group.members.map((m: any) => (
              <div key={m.key} className="px-2 py-1 text-xs">
                <div className="font-semibold text-slate-800 truncate">{m.code} <span className="font-normal text-slate-500">· {m.label}</span></div>
                <div className="text-[11px] text-slate-500 truncate">{m.info}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.substitutes?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Alternatives found</div>
          {node.substitutes.map((sub: any, i: number) => (
            <div key={i} className="rounded-lg border border-slate-200 p-2 text-xs space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 truncate">{sub.code}</span>
                <span className={`text-[10px] font-bold px-1.5 rounded border shrink-0 ${READY_STYLE[sub.readiness]}`}>{READY_LABEL[sub.readiness]}</span>
              </div>
              <div className="text-slate-500">{sub.label}</div>
              <div className="text-slate-700">{sub.text}</div>
              {sub.tradeOff && <div className="text-slate-500"><b className="text-slate-600">Trade-off:</b> {sub.tradeOff}</div>}
            </div>
          ))}
        </div>
      )}

      {node.type !== 'GROUP' && node.effect !== 'ROOT' && (
        <button onClick={() => onRecentre(node)} className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 flex items-center justify-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5" /> Show the blast radius of {node.code}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dossier export
// ---------------------------------------------------------------------------

const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const tolText = (t: number | null) => (t === null || t === undefined ? '—' : t < 0 ? `already ${-t}d late` : `${t} day${t === 1 ? '' : 's'}`);

function dossierSections(data: any) {
  const withSubs = data.nodes.filter((n: any) => n.substitutes?.length);
  const idlePeople = data.nodes.flatMap((n: any) =>
    n.effect === 'IDLE' && n.type === 'PERSON' ? [`${n.code} (${n.label})`]
      : n.effect === 'IDLE' && n.group?.memberType === 'PERSON' ? n.group.members.map((m: any) => `${m.code} (${m.label})`) : []);
  return { withSubs, idlePeople };
}

function buildMarkdown(data: any): string {
  const { withSubs, idlePeople } = dossierSections(data);
  const s = data.summary;
  const lines = [
    `# Cascade Impact Dossier — ${data.root.code}`,
    '',
    `**For:** Expedition Voyage Leader  `,
    `**Plan date:** ${fmtDate(data.generatedAt)}  `,
    `**Trigger:** If ${data.root.code} (${data.root.label}) ${data.failureVerb}`,
    '',
    '## Summary',
    data.headline,
    '',
    '| Measure | Count |', '|---|---|',
    `| Crates held up | ${s.cratesHeld} |`,
    `| People arriving late | ${s.peopleDelayed} |`,
    `| Missions depending on it | ${s.missions.length} |`,
    `| People left idle | ${s.peopleIdle} |`,
    `| Machines exposed / idle | ${s.assetsAffected} / ${s.assetsIdle} |`,
    `| Supply stocks affected | ${s.stocksAffected} |`,
    `| Alternatives found | ${s.substitutesFound} |`,
    '',
    '## Missions affected',
    '| Mission | Station | Starts | Priority | Can absorb | Why |', '|---|---|---|---|---|---|',
    ...s.missions.map((m: any) => `| ${m.code} — ${m.title} | ${m.station} | ${fmtDate(m.start)} | P${m.priority} | ${tolText(m.toleranceDays)} | ${m.effectText} |`),
    '',
    '## Domino chains (first to break first)',
    ...data.chains.map((c: any, i: number) => `${i + 1}. ${c.steps.map((x: any) => x.code).join(' → ')} — ${c.endsIn}${c.toleranceDays !== null ? ` (breaks after ${tolText(c.toleranceDays)})` : ''}`),
    '',
    '## Alternatives',
    ...withSubs.flatMap((n: any) => [`**${n.code}**`, ...n.substitutes.map((x: any) => `- ${x.code} [${READY_LABEL[x.readiness]}] — ${x.text}${x.tradeOff ? ` Trade-off: ${x.tradeOff}` : ''}`), '']),
    idlePeople.length ? '## People who would be left idle' : '',
    ...idlePeople.map((p: string) => `- ${p}`),
    '',
    '_Decision support only. Generated from plan data; no action has been taken._'
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

function buildHtml(data: any): string {
  const { withSubs, idlePeople } = dossierSections(data);
  const s = data.summary;
  const figures = [
    ['Crates held up', s.cratesHeld], ['People arriving late', s.peopleDelayed], ['Missions depending on it', s.missions.length],
    ['People left idle', s.peopleIdle], ['Machines exposed / idle', `${s.assetsAffected} / ${s.assetsIdle}`], ['Alternatives found', s.substitutesFound]
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cascade dossier — ${esc(data.root.code)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;margin:32px;font-size:12px;line-height:1.5}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
.meta{color:#475569}.headline{background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:10px 12px;font-weight:600}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left;vertical-align:top}th{background:#f8fafc;font-size:11px}
.fig{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fig div{border:1px solid #e2e8f0;border-radius:8px;padding:8px}.fig b{display:block;font-size:18px}
.chain{margin:3px 0}.tag{display:inline-block;font-size:10px;font-weight:700;padding:0 6px;border-radius:4px;border:1px solid #cbd5e1}
.foot{margin-top:24px;color:#64748b;font-style:italic}@media print{body{margin:12mm}}
</style></head><body>
<h1>Cascade Impact Dossier — ${esc(data.root.code)}</h1>
<div class="meta">For: Expedition Voyage Leader · Plan date: ${esc(fmtDate(data.generatedAt))} · Trigger: if ${esc(data.root.code)} (${esc(data.root.label)}) ${esc(data.failureVerb)}</div>
<h2>Summary</h2><div class="headline">${esc(data.headline)}</div>
<div class="fig" style="margin-top:10px">${figures.map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
<h2>Missions affected</h2>
<table><tr><th>Mission</th><th>Station</th><th>Starts</th><th>Priority</th><th>Can absorb</th><th>Why</th></tr>
${s.missions.map((m: any) => `<tr><td><b>${esc(m.code)}</b><br>${esc(m.title)}</td><td>${esc(m.station)}</td><td>${esc(fmtDate(m.start))}</td><td>P${esc(m.priority)}</td><td>${esc(tolText(m.toleranceDays))}</td><td>${esc(m.effectText)}</td></tr>`).join('') || '<tr><td colspan="6">No mission depends on this.</td></tr>'}
</table>
<h2>Domino chains (first to break first)</h2>
${data.chains.map((c: any, i: number) => `<div class="chain">${i + 1}. ${c.steps.map((x: any) => `<b>${esc(x.code)}</b>`).join(' → ')} — ${esc(c.endsIn)}${c.toleranceDays !== null ? ` <span class="tag">breaks after ${esc(tolText(c.toleranceDays))}</span>` : ''}</div>`).join('') || '<div>No chains.</div>'}
<h2>Alternatives</h2>
${withSubs.map((n: any) => `<p><b>${esc(n.code)}</b></p><table><tr><th>Option</th><th>Status</th><th>Details</th><th>Trade-off</th></tr>${n.substitutes.map((x: any) => `<tr><td>${esc(x.code)}<br><span class="meta">${esc(x.label)}</span></td><td>${esc(READY_LABEL[x.readiness])}</td><td>${esc(x.text)}</td><td>${esc(x.tradeOff || '')}</td></tr>`).join('')}</table>`).join('') || '<div>No alternatives needed or found.</div>'}
${idlePeople.length ? `<h2>People who would be left idle</h2><div>${idlePeople.map(esc).join(' · ')}</div>` : ''}
<div class="foot">Decision support only. Generated from plan data as of ${esc(fmtDate(data.generatedAt))}; no action has been taken.</div>
</body></html>`;
}

function exportMarkdown(data: any) {
  const blob = new Blob([buildMarkdown(data)], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cascade-dossier-${String(data.root.code).replace(/[^\w-]+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPrintable(data: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(buildHtml(data));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RippleContent() {
  const params = useSearchParams();
  const [catalog, setCatalog] = useState<Record<Kind, any[]> | null>(null);
  const [kind, setKind] = useState<Kind>('TRANSPORT');
  const [entityRef, setEntityRef] = useState<string>('');
  const [depth, setDepth] = useState(5);
  const [data, setData] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reqCountRef = useRef(0);
  const kindRef = useRef<Kind>(kind);
  kindRef.current = kind;
  const entityRefRef = useRef<string>(entityRef);
  entityRefRef.current = entityRef;

  const loadCatalog = useCallback(async (initialParams?: { type?: string; id?: string }) => {
    try {
      const res = await api.getBlastCatalog();
      const cat = res?.data as Record<Kind, any[]>;
      if (!cat) return null;
      setCatalog(cat);

      if (initialParams) {
        const qType = (initialParams.type || '').toUpperCase().replace('CARGO', 'CRATE') as Kind;
        const qId = initialParams.id || '';
        const match = KINDS.some(k => k.id === qType) && qId
          ? cat[qType]?.find(e => e.id === qId || e.ref?.toLowerCase() === qId.toLowerCase() || e.code?.toLowerCase() === qId.toLowerCase())
          : null;

        if (match) {
          setKind(qType);
          setEntityRef(match.ref);
        } else {
          // Fall back to default ship
          const ship = cat.TRANSPORT?.find(t => t.code?.startsWith('MV') || t.ref?.startsWith('MV')) || cat.TRANSPORT?.[0];
          setKind('TRANSPORT');
          setEntityRef(ship?.ref || '');
        }
      } else {
        // Re-fetch scenario (visibility change, reload): check if current entity still exists
        const curKind = kindRef.current;
        const curRef = entityRefRef.current;
        const exists = cat[curKind]?.some(e => e.ref?.toLowerCase() === curRef?.toLowerCase());
        if (!exists && cat[curKind]?.length) {
          const fallback = cat[curKind][0];
          setEntityRef(fallback.ref);
          setNotice(`The plan data was reset; showing ${fallback.code} instead.`);
        }
      }
      return cat;
    } catch (e: any) {
      setError(String(e?.message || e));
      return null;
    }
  }, []);

  useEffect(() => {
    loadCatalog({
      type: params.get('type') || undefined,
      id: params.get('id') || undefined
    });
  }, [params, loadCatalog]);

  // Document visibilitychange listener to reload catalog when tab is refocused
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadCatalog();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadCatalog]);

  // Blast radius fetch effect with race-condition guard and automatic reseed recovery
  useEffect(() => {
    if (!entityRef) return;
    const reqId = ++reqCountRef.current;
    const curKind = kind;
    const curRef = entityRef;

    setLoading(true);
    setError(null);

    const fetchBlast = async (allowRetry = true) => {
      try {
        const res = await api.getBlast(curKind, encodeURIComponent(curRef), depth);
        if (reqId !== reqCountRef.current) return;

        if (res?.error) {
          throw new Error(res.error.message);
        }
        if (reqId !== reqCountRef.current) return;

        const blastData = res?.data;
        const rootType = blastData?.root?.type === 'CARGO' ? 'CRATE' : blastData?.root?.type;
        if (rootType !== curKind) {
          setData(null);
          return;
        }

        setData(blastData);
        setSelectedKey(blastData.root.key);
        setError(null);
      } catch (err: any) {
        if (reqId !== reqCountRef.current) return;
        const errMsg = String(err?.message || err);

        // If error contains "not found", re-fetch the catalog once, find the same entity by ref, and retry.
        if (allowRetry && errMsg.toLowerCase().includes('not found')) {
          try {
            const catRes = await api.getBlastCatalog();
            if (reqId !== reqCountRef.current) return;
            const newCat = catRes?.data as Record<Kind, any[]>;
            if (newCat) {
              setCatalog(newCat);
              const sameEntity = newCat[curKind]?.find(e => e.ref?.toLowerCase() === curRef.toLowerCase());
              if (sameEntity) {
                const retryRes = await api.getBlast(curKind, encodeURIComponent(sameEntity.ref), depth);
                if (reqId !== reqCountRef.current) return;
                if (retryRes?.data) {
                  const rType = retryRes.data?.root?.type === 'CARGO' ? 'CRATE' : retryRes.data?.root?.type;
                  if (rType === curKind) {
                    setData(retryRes.data);
                    setSelectedKey(retryRes.data.root.key);
                    setError(null);
                    return;
                  }
                }
              } else {
                // If it still isn't there, select first entry of that kind with notice
                const fallback = newCat[curKind]?.[0];
                if (fallback) {
                  setEntityRef(fallback.ref);
                  setNotice(`The plan data was reset; showing ${fallback.code} instead.`);
                  return;
                }
              }
            }
          } catch {
            // fall through
          }
        }

        setData(null);
        setError(errMsg);
      } finally {
        if (reqId === reqCountRef.current) {
          setLoading(false);
        }
      }
    };

    fetchBlast(true);
  }, [kind, entityRef, depth]);

  const pick = (k: Kind, code: string) => {
    setNotice(null);
    const e = catalog?.[k]?.find(x => x.ref?.toLowerCase().startsWith(code.toLowerCase()) || x.code?.toLowerCase().startsWith(code.toLowerCase()));
    if (e) {
      setKind(k);
      setEntityRef(e.ref);
    }
  };

  const recentre = (n: any) => {
    if (n.type === 'GROUP') return;
    setNotice(null);
    const nextKind = (n.type === 'CARGO' ? 'CRATE' : n.type) as Kind;
    setKind(nextKind);
    setEntityRef(n.ref || n.code);
  };

  const selected = data?.nodes?.find((n: any) => n.key === selectedKey) || data?.root;
  const rootMatchesKind = Boolean(data?.root && (data.root.type === kind || (data.root.type === 'CARGO' && kind === 'CRATE') || (data.root.type === 'CRATE' && kind === 'CRATE')));

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-sky-600" /> Dependency &amp; Blast Radius Graph
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
              Pick anything in the plan — a ship, a crate, a machine, a fuel stock, a person or a mission — and see everything that depends on it,
              degree by degree, with how many days of delay each part can absorb and which alternatives exist.
            </p>
          </div>
          {data && rootMatchesKind && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => exportPrintable(data)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Dossier (print / PDF)
              </button>
              <button onClick={() => exportMarkdown(data)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5" /> .md
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="flex flex-wrap gap-1">
            {KINDS.map(k => {
              const Icon = k.icon;
              return (
                <button
                  key={k.id}
                  onClick={() => {
                    setNotice(null);
                    setKind(k.id);
                    setEntityRef(catalog?.[k.id]?.[0]?.ref || '');
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 ${kind === k.id ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {k.label}
                </button>
              );
            })}
          </div>
          <select
            value={entityRef}
            onChange={e => {
              setNotice(null);
              setEntityRef(e.target.value);
            }}
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            {(catalog?.[kind] || []).map(e => <option key={e.id} value={e.ref}>{e.code} — {e.label}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
            Show
            <select value={depth} onChange={e => setDepth(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
              <option value={1}>1st degree</option>
              <option value={2}>up to 2nd degree</option>
              <option value={3}>up to 3rd degree</option>
              <option value={5}>every degree</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 font-semibold">Try:</span>
          {QUICK_PICKS.map(q => (
            <button key={q.code} onClick={() => pick(q.type, q.code)} className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 text-slate-700">
              <b>{q.code}</b> <span className="text-slate-500">· {q.why}</span>
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-700 hover:text-amber-900 font-bold px-1.5">✕</button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => {
              setError(null);
              loadCatalog();
            }}
            className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 font-semibold text-rose-800 hover:bg-rose-100 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload list
          </button>
        </div>
      )}

      {data && rootMatchesKind && (
        <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`}>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-slate-900">{data.headline}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {data.summary.byTier.map((t: any) => (
                <span key={t.tier} className="px-2 py-0.5 rounded-full bg-white border border-rose-200 text-slate-700"><b>{t.count}</b> at {t.label}</span>
              ))}
              {data.summary.substitutesFound > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700"><b>{data.summary.substitutesFound}</b> usable alternatives</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-card">
              <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-slate-100 text-[11px] text-slate-500">
                {(['root', 'high', 'medium', 'idle'] as Severity[]).map(s => (
                  <span key={s} className="flex items-center gap-1"><span className={`w-3 h-3 rounded border-2 ${SEV_STYLE[s].box}`} />{SEV_STYLE[s].label}</span>
                ))}
                <span className="flex items-center gap-1"><span className="w-5 border-t-2 border-dashed border-slate-400" />also depends</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-dashed border-emerald-400" />alternative</span>
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />days of delay it can absorb</span>
                <span className="ml-auto flex items-center gap-1">{loading && <Loader2 className="w-3 h-3 animate-spin" />}Click a box for details</span>
              </div>
              <div className="overflow-auto max-h-[720px] p-2">
                <Graph data={data} selectedKey={selectedKey} onSelect={setSelectedKey} />
              </div>
            </div>
            <div className="xl:col-span-4 space-y-4">
              {selected && <NodePanel node={selected} data={data} onRecentre={recentre} onSelect={setSelectedKey} />}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Domino chains — first to break at the top</h3>
              {data.chains.length === 0 && <p className="text-xs text-slate-500">Nothing downstream.</p>}
              {data.chains.map((c: any, i: number) => (
                <div key={i} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.steps.map((st: any, j: number) => (
                      <React.Fragment key={j}>
                        {j > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                        <button onClick={() => setSelectedKey(st.key)} className="font-semibold text-slate-800 hover:text-sky-700 hover:underline">{st.code}</button>
                      </React.Fragment>
                    ))}
                    <span className="ml-auto">{toleranceChip(c.toleranceDays)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.steps[c.steps.length - 1].effectText} — {c.endsIn}</div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-card space-y-2">
              <h3 className="text-sm font-bold text-slate-900">Missions that depend on {data.root.code}</h3>
              {data.summary.missions.length === 0 && <p className="text-xs text-slate-500">No mission depends on it.</p>}
              {data.summary.missions.map((m: any) => (
                <div key={m.code} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{m.code}</span>
                    <span className="text-slate-500 truncate">{m.title}</span>
                    <span className="ml-auto shrink-0">{toleranceChip(m.toleranceDays)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">{m.station} · starts {fmtDate(m.start)} · priority {m.priority}{m.todayStatus ? ` · today ${TODAY_LABEL[m.todayStatus]}` : ''}</div>
                  <div className="text-[11px] text-slate-700 mt-0.5">{m.effectText}</div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 pt-1 flex items-start gap-1">
                <RefreshCw className="w-3 h-3 mt-0.5 shrink-0" />
                This graph shows what depends on {data.root.code}. To test a specific delay or failure and get calculated options, use the What-If Simulator.
              </p>
            </div>
          </div>
        </div>
      )}

      {(!data || !rootMatchesKind) && !error && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-card flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the dependency graph…
        </div>
      )}
    </div>
  );
}

export default function RipplePage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-slate-500 text-xs">Loading…</div>}>
      <RippleContent />
    </Suspense>
  );
}
