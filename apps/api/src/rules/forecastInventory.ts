import { InventoryItem, InventoryTransaction } from '@polar-ops/shared';

const DAY_MS = 86400000;

export interface InventoryForecastResult {
  itemId: string;
  itemCode: string;
  station: string;
  currentStock: number;
  projectedStockAtNow: number;
  minimumLevel: number;
  burnRate: number;
  baseBurnRate: number;
  naiveBurnRate: number;
  minBreachDate: string | null;
  nextResupplyDate: string | null;
  resupplyCrateCode?: string | null;
  resupplyQuantity?: number;
  marginDays: number | null;
  timeline: Array<{
    date: string;
    dayOffset: number;
    projectedStock: number;
    minimumLevel: number;
  }>;
}

export interface IncomingResupply {
  crateCode: string;
  inventoryItemId: string;
  quantity: number;
  etaDate: string | null;
}

/** A temporary change in consumption, e.g. a 10-day blizzard (fromDay 0, toDay 10, multiplier 1.35). Days are counted from now. */
export interface BurnSegment {
  fromDay: number;
  toDay: number;
  multiplier: number;
}

/** A plain number applies to the whole horizon; segments multiply together where they overlap. */
export type BurnProfile = number | BurnSegment[];

export function burnMultiplierOnDay(profile: BurnProfile, day: number): number {
  if (typeof profile === 'number') return profile;
  return profile.reduce((m, s) => (day >= s.fromDay && day < s.toDay ? m * s.multiplier : m), 1);
}

/** Fuel consumed between now and `days` from now. */
export function cumulativeBurn(baseBurn: number, profile: BurnProfile, days: number): number {
  if (typeof profile === 'number') return baseBurn * profile * days;
  let total = 0;
  const whole = Math.floor(days);
  for (let d = 0; d < whole; d++) total += baseBurn * burnMultiplierOnDay(profile, d);
  total += baseBurn * burnMultiplierOnDay(profile, whole) * (days - whole);
  return total;
}

/** Days until `budget` litres are consumed; null if never within the horizon. */
export function daysToConsume(baseBurn: number, profile: BurnProfile, budget: number, horizonDays = 730): number | null {
  if (budget <= 0) return 0;
  if (baseBurn <= 0) return null;
  if (typeof profile === 'number') return profile > 0 ? budget / (baseBurn * profile) : null;
  let used = 0;
  for (let d = 0; d < horizonDays; d++) {
    const today = baseBurn * burnMultiplierOnDay(profile, d);
    if (used + today >= budget) return d + (budget - used) / today;
    used += today;
  }
  return null;
}

export function forecastInventory(
  item: Partial<InventoryItem> & { id?: string; _id?: any },
  transactions: Array<Partial<InventoryTransaction>>,
  incomingResupplies: IncomingResupply[] = [],
  now: Date = new Date('2026-11-15T08:00:00.000Z'),
  burnProfile: BurnProfile = 1
): InventoryForecastResult {
  const itemId = String(item.id || item._id || '');
  const itemCode = item.itemCode || '';
  const station = item.station || '';
  const initialQty = item.quantity ?? 0;
  const minLevel = item.minimumLevel ?? 0;

  const usedTxs = transactions
    .filter(t => {
      if (t.type !== 'USED') return false;
      if (item.station && t.station && t.station !== item.station) return false;
      if (itemId && t.itemId && t.itemId === itemId) return true;
      if (itemCode && t.itemCode === itemCode) return true;
      return false;
    })
    .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

  let baseBurn = item.dailyBurnRate || 0;
  let naiveBase = baseBurn;
  let anchorMs = now.getTime();

  if (usedTxs.length > 0) {
    anchorMs = new Date(usedTxs[usedTxs.length - 1].timestamp || now).getTime();
    const txs14 = usedTxs.slice(-14);
    baseBurn = txs14.reduce((acc, t) => acc + (t.quantity ?? 0), 0) / Math.max(1, txs14.length);
    naiveBase = usedTxs.reduce((acc, t) => acc + (t.quantity ?? 0), 0) / usedTxs.length;
  }

  // Scenario changes start "now"; any time since the last recorded transaction burns at the normal rate.
  const daysSinceAnchor = Math.max(0, (now.getTime() - anchorMs) / DAY_MS);
  const stockAtNow = Math.max(0, Math.round(initialQty - daysSinceAnchor * baseBurn));

  let minBreachDate: string | null = null;
  if (baseBurn > 0) {
    const days = daysToConsume(baseBurn, burnProfile, stockAtNow - minLevel);
    if (days !== null) minBreachDate = new Date(now.getTime() + days * DAY_MS).toISOString();
  }

  const earliestResupply = incomingResupplies
    .filter(r => (r.inventoryItemId === itemId || r.inventoryItemId === itemCode) && r.etaDate)
    .sort((a, b) => new Date(a.etaDate!).getTime() - new Date(b.etaDate!).getTime())[0] || null;
  const nextResupplyDate = earliestResupply ? earliestResupply.etaDate : null;

  let marginDays: number | null = null;
  if (minBreachDate && nextResupplyDate) {
    marginDays = Math.floor((new Date(minBreachDate).getTime() - new Date(nextResupplyDate).getTime()) / DAY_MS);
  }

  const timeline: InventoryForecastResult['timeline'] = [];
  for (let d = 0; d <= 60; d += 2) {
    timeline.push({
      date: new Date(now.getTime() + d * DAY_MS).toISOString(),
      dayOffset: d,
      projectedStock: Math.max(0, Math.round(stockAtNow - cumulativeBurn(baseBurn, burnProfile, d))),
      minimumLevel: minLevel
    });
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    itemId,
    itemCode,
    station,
    currentStock: initialQty,
    projectedStockAtNow: stockAtNow,
    minimumLevel: minLevel,
    burnRate: round2(baseBurn * burnMultiplierOnDay(burnProfile, 0)),
    baseBurnRate: round2(baseBurn),
    naiveBurnRate: round2(naiveBase * burnMultiplierOnDay(burnProfile, 0)),
    minBreachDate,
    nextResupplyDate,
    resupplyCrateCode: earliestResupply?.crateCode || null,
    resupplyQuantity: earliestResupply?.quantity || 0,
    marginDays,
    timeline
  };
}
