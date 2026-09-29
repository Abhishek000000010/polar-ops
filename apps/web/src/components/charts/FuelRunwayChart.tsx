'use client';

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { Flame, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';

interface FuelRunwayChartProps {
  bharatiFuel?: number;
  maitriFuel?: number;
  simDate?: string;
  forecasts?: any[];
}

export default function FuelRunwayChart({
  bharatiFuel,
  maitriFuel,
  simDate = '2026-11-15T08:00:00.000Z',
  forecasts: initialForecasts
}: FuelRunwayChartProps) {
  const [activeStation, setActiveStation] = useState<'BOTH' | 'BHARATI' | 'MAITRI'>('BOTH');
  const [forecasts, setForecasts] = useState<any[]>(initialForecasts || []);
  const [loading, setLoading] = useState(!initialForecasts || initialForecasts.length === 0);

  useEffect(() => {
    async function loadForecast() {
      try {
        const res = await api.getInventoryForecast();
        if (res?.data) {
          setForecasts(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch fuel forecast', err);
      } finally {
        setLoading(false);
      }
    }
    loadForecast();
  }, []);

  const bForecast = forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === 'BHARATI');
  const mForecast = forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === 'MAITRI');

  const bBurn = bForecast?.burnRate || 1500;
  const mBurn = mForecast?.burnRate || 1600;

  const bStock = bForecast?.currentStock || bharatiFuel || 63000;
  const mStock = mForecast?.currentStock || maitriFuel || 120000;

  const bMin = bForecast?.minimumLevel || 30000;
  const mMin = mForecast?.minimumLevel || 50000;

  const bDaysLeft = Math.max(0, Math.floor((bStock - bMin) / Math.max(1, bBurn)));
  const mDaysLeft = Math.max(0, Math.floor((mStock - mMin) / Math.max(1, mBurn)));

  const baseDate = new Date(simDate);

  // Generate 60-day projection intervals using real timeline data if available
  const intervals = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const chartData = intervals.map(days => {
    const projDate = new Date(baseDate.getTime() + days * 86400000);
    const dateLabel = projDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    // Use timeline from forecast if available, else exact rule math
    let bVal = Math.max(0, Math.round(bStock - days * bBurn));
    let mVal = Math.max(0, Math.round(mStock - days * mBurn));

    if (bForecast?.timeline) {
      const match = bForecast.timeline.find((t: any) => t.dayOffset === days);
      if (match) bVal = match.projectedStock;
    }
    if (mForecast?.timeline) {
      const match = mForecast.timeline.find((t: any) => t.dayOffset === days);
      if (match) mVal = match.projectedStock;
    }

    return {
      day: `+${days}d`,
      date: dateLabel,
      Bharati: bVal,
      Maitri: mVal,
      BharatiMin: bMin,
      MaitriMin: mMin
    };
  });

  const bResupplyDate = bForecast?.nextResupplyDate ? new Date(bForecast.nextResupplyDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '30 Nov';
  const mResupplyDate = mForecast?.nextResupplyDate ? new Date(mForecast.nextResupplyDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '22 Dec';

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Flame className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Station Fuel Burn & Winter Survival Runway</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              Trend-Aware 14d Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dynamic fuel depletion trajectory anchored at last transaction. Bharati: <strong>{bBurn.toLocaleString()} L/d</strong> (usable runway: {bDaysLeft}d) | Maitri: <strong>{mBurn.toLocaleString()} L/d</strong> (usable runway: {mDaysLeft}d).
          </p>
        </div>

        {/* Station Filter Toggle */}
        <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold shadow-inner self-start sm:self-auto border border-slate-300/70">
          <button
            onClick={() => setActiveStation('BOTH')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeStation === 'BOTH'
                ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            Both Stations
          </button>
          <button
            onClick={() => setActiveStation('BHARATI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeStation === 'BHARATI'
                ? 'bg-rose-600 text-white shadow-sm font-extrabold'
                : 'text-slate-700 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            Bharati ({bDaysLeft}d to min)
          </button>
          <button
            onClick={() => setActiveStation('MAITRI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeStation === 'MAITRI'
                ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                : 'text-slate-700 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Maitri ({mDaysLeft}d to min)
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[11px] uppercase">Bharati Burn Rate</span>
          <span className="text-slate-900 font-bold text-sm">{bBurn.toLocaleString()} L/day</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">14-day weighted average</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[11px] uppercase">Bharati Resupply Marker</span>
          <span className="text-sky-700 font-bold text-sm">{bResupplyDate} (CRT-1043)</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Margin: {bForecast?.marginDays !== null ? `${bForecast?.marginDays} days` : 'TBD'}</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[11px] uppercase">Maitri Burn Rate</span>
          <span className="text-slate-900 font-bold text-sm">{mBurn.toLocaleString()} L/day</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">14-day weighted average</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[11px] uppercase">Maitri Resupply Marker</span>
          <span className="text-emerald-700 font-bold text-sm">{mResupplyDate} (CRT-1044)</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Margin: {mForecast?.marginDays !== null ? `${mForecast?.marginDays} days` : 'TBD'}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorBharati" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorMaitri" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k L`}
              domain={[0, 140000]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs min-w-[200px] space-y-1.5 pointer-events-none z-50">
                      <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
                        <span>Projected Date</span>
                        <span>{label}</span>
                      </div>
                      {(activeStation === 'BOTH' || activeStation === 'BHARATI') && (
                        <div className="flex justify-between items-center text-rose-400">
                          <span>Bharati Stock:</span>
                          <span className="font-bold">{payload.find(p => p.dataKey === 'Bharati')?.value?.toLocaleString()} L</span>
                        </div>
                      )}
                      {(activeStation === 'BOTH' || activeStation === 'MAITRI') && (
                        <div className="flex justify-between items-center text-emerald-400">
                          <span>Maitri Stock:</span>
                          <span className="font-bold">{payload.find(p => p.dataKey === 'Maitri')?.value?.toLocaleString()} L</span>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        Minimum Thresholds: Bharati 30k L | Maitri 50k L
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
            />

            {/* Minimum Threshold Reference Lines */}
            {(activeStation === 'BOTH' || activeStation === 'BHARATI') && (
              <ReferenceLine
                y={bMin}
                stroke="#e11d48"
                strokeDasharray="4 4"
                label={{ value: `Bharati Min (${(bMin/1000)}k L)`, fill: '#e11d48', fontSize: 10, position: 'right' }}
              />
            )}
            {(activeStation === 'BOTH' || activeStation === 'MAITRI') && (
              <ReferenceLine
                y={mMin}
                stroke="#059669"
                strokeDasharray="4 4"
                label={{ value: `Maitri Min (${(mMin/1000)}k L)`, fill: '#059669', fontSize: 10, position: 'right' }}
              />
            )}

            {/* Areas */}
            {(activeStation === 'BOTH' || activeStation === 'BHARATI') && (
              <Area
                type="monotone"
                dataKey="Bharati"
                stroke="#e11d48"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorBharati)"
                name="Bharati Polar Diesel (L)"
              />
            )}

            {(activeStation === 'BOTH' || activeStation === 'MAITRI') && (
              <Area
                type="monotone"
                dataKey="Maitri"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorMaitri)"
                name="Maitri Polar Diesel (L)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
