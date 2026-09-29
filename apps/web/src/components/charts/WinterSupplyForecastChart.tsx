'use client';

import React, { useEffect, useState } from 'react';
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
import { Snowflake, Wind, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

interface WinterSupplyForecastChartProps {
  inventory?: any[];
  simDate?: string;
}

export default function WinterSupplyForecastChart({
  inventory = [],
  simDate = '2026-11-15T08:00:00.000Z'
}: WinterSupplyForecastChartProps) {
  const [station, setStation] = useState<'BHARATI' | 'MAITRI'>('BHARATI');
  const [weatherMode, setWeatherMode] = useState<'STANDARD' | 'BLIZZARD'>('STANDARD');
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadForecast() {
      setLoading(true);
      try {
        const mult = weatherMode === 'BLIZZARD' ? 1.35 : 1.0;
        const res = await api.getInventoryForecast(mult);
        if (res?.data) {
          setForecasts(res.data);
        }
      } catch (err) {
        console.error('Failed to load winter forecast', err);
      } finally {
        setLoading(false);
      }
    }
    loadForecast();
  }, [weatherMode]);

  const fuelForecast = forecasts.find(f => f.itemCode === 'FUEL-SAB' && f.station === station);
  const foodForecast = forecasts.find(f => f.itemCode === 'FOOD-RATIONS' && f.station === station);
  const pumpForecast = forecasts.find(f => f.itemCode === 'SPR-CAT-PUMP' && f.station === station);

  const baseDate = new Date(simDate);
  const intervals = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

  const chartData = intervals.map(days => {
    const projDate = new Date(baseDate.getTime() + days * 86400000);
    const dateLabel = projDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    // Normalized remaining percentage relative to initial stock
    const fuelInitial = fuelForecast?.currentStock || (station === 'BHARATI' ? 63000 : 120000);
    const foodInitial = foodForecast?.currentStock || 4200;

    let fuelRemainingPct = 100;
    if (fuelForecast?.timeline) {
      const match = fuelForecast.timeline.find((t: any) => t.dayOffset === days);
      if (match) {
        fuelRemainingPct = Math.max(0, Math.round((match.projectedStock / fuelInitial) * 100));
      }
    } else {
      const burn = (fuelForecast?.burnRate || 1500) * (weatherMode === 'BLIZZARD' ? 1.35 : 1.0);
      fuelRemainingPct = Math.max(0, Math.round(((fuelInitial - days * burn) / fuelInitial) * 100));
    }

    let foodRemainingPct = 100;
    if (foodForecast?.timeline) {
      const match = foodForecast.timeline.find((t: any) => t.dayOffset === days);
      if (match) {
        foodRemainingPct = Math.max(0, Math.round((match.projectedStock / foodInitial) * 100));
      }
    } else {
      const burn = (foodForecast?.burnRate || 45) * (weatherMode === 'BLIZZARD' ? 1.15 : 1.0);
      foodRemainingPct = Math.max(0, Math.round(((foodInitial - days * burn) / foodInitial) * 100));
    }

    // Spares remaining percentage
    const sparesInitial = pumpForecast?.currentStock || 1;
    const sparesPct = Math.max(0, Math.round((sparesInitial / 2) * 100));

    return {
      day: `+${days}d`,
      date: dateLabel,
      Fuel: fuelRemainingPct,
      Food: foodRemainingPct,
      Spares: sparesPct,
      SafetyThreshold: Math.round((fuelForecast?.minimumLevel / fuelInitial) * 100) || 48
    };
  });

  const breachDateStr = fuelForecast?.minBreachDate ? new Date(fuelForecast.minBreachDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '07 Dec';
  const resupplyDateStr = fuelForecast?.nextResupplyDate ? new Date(fuelForecast.nextResupplyDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '30 Nov';
  const marginStr = fuelForecast?.marginDays !== null && fuelForecast?.marginDays !== undefined ? `${fuelForecast.marginDays} days` : 'TBD';

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Snowflake className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Winter Supply Forecast & Stockout Horizon</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              Sensitivity Simulation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulates consumable depletion comparing normal operations vs catastrophic Blizzard surge (×1.35 burn rate).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Weather Toggle */}
          <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold shadow-inner border border-slate-300/70">
            <button
              onClick={() => setWeatherMode('STANDARD')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                weatherMode === 'STANDARD'
                  ? 'bg-slate-900 text-white shadow-sm font-extrabold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <span>Normal Weather</span>
            </button>
            <button
              onClick={() => setWeatherMode('BLIZZARD')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                weatherMode === 'BLIZZARD'
                  ? 'bg-amber-600 text-white shadow-sm font-extrabold animate-pulse'
                  : 'text-slate-700 hover:text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Wind className="w-3.5 h-3.5" />
              <span>Blizzard Surge (×1.35)</span>
            </button>
          </div>

          {/* Station Switcher */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg text-xs font-semibold border border-slate-200">
            <button
              onClick={() => setStation('BHARATI')}
              className={`px-2.5 py-1 rounded transition ${
                station === 'BHARATI' ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Bharati
            </button>
            <button
              onClick={() => setStation('MAITRI')}
              className={`px-2.5 py-1 rounded transition ${
                station === 'MAITRI' ? 'bg-white text-sky-700 shadow-xs font-bold' : 'text-slate-600'
              }`}
            >
              Maitri
            </button>
          </div>
        </div>
      </div>

      {/* Sensitivity Banner */}
      <div className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
        weatherMode === 'BLIZZARD'
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-sky-50 border-sky-200 text-sky-900'
      }`}>
        <div className="flex items-center space-x-2">
          {weatherMode === 'BLIZZARD' ? (
            <Wind className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
          )}
          <span>
            {weatherMode === 'BLIZZARD'
              ? `BLIZZARD ACTIVE: Fuel burn rate increased by +35% to ${fuelForecast?.burnRate?.toLocaleString()} L/day. Minimum stock breach accelerates to ${breachDateStr}.`
              : `STANDARD WEATHER: Fuel burn at steady 14-day average of ${fuelForecast?.burnRate?.toLocaleString()} L/day. Breach projected on ${breachDateStr}.`}
          </span>
        </div>
        <div className="flex items-center space-x-3 shrink-0 font-bold">
          <span>Resupply: {resupplyDateStr}</span>
          <span className="px-2 py-0.5 rounded bg-white/80 border border-current">
            Safety Margin: {marginStr}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs min-w-[200px] space-y-1.5 pointer-events-none z-50">
                      <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
                        <span>{station} Stock Projection</span>
                        <span>{label}</span>
                      </div>
                      <div className="flex justify-between items-center text-rose-400">
                        <span>Polar Diesel Remaining:</span>
                        <span className="font-bold">{payload.find(p => p.dataKey === 'Fuel')?.value}%</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400">
                        <span>Food Rations Remaining:</span>
                        <span className="font-bold">{payload.find(p => p.dataKey === 'Food')?.value}%</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        Minimum Threshold: 48% (Safety Buffer)
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

            <ReferenceLine
              y={48}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: 'Critical Stock Threshold (48%)', fill: '#e11d48', fontSize: 10, position: 'right' }}
            />

            <Line
              type="monotone"
              dataKey="Fuel"
              stroke="#e11d48"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#e11d48' }}
              name={`${station} Polar Diesel (%)`}
            />
            <Line
              type="monotone"
              dataKey="Food"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3, fill: '#059669' }}
              name="Food Rations (%)"
            />
            <Line
              type="monotone"
              dataKey="Spares"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              name="Critical Spares Buffer (%)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
