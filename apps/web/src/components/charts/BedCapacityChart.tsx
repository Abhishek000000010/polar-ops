'use client';

import React, { useEffect, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import { BedDouble, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { api } from '../../lib/api';

interface BedCapacityChartProps {
  people?: any[];
  simDate?: string;
}

export default function BedCapacityChart({
  people = [],
  simDate = '2026-11-15T08:00:00.000Z'
}: BedCapacityChartProps) {
  const [selectedStation, setSelectedStation] = useState<'BHARATI' | 'MAITRI'>('BHARATI');
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [bedCapacity, setBedCapacity] = useState<number>(47);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOccupancy() {
      setLoading(true);
      try {
        const res = await api.getOccupancy(selectedStation, 60);
        if (res?.data) {
          setBedCapacity(res.data.bedCapacity || (selectedStation === 'BHARATI' ? 47 : 65));
          if (res.data.daily) {
            setOccupancyData(res.data.daily);
          }
        }
      } catch (err) {
        console.error('Failed to load occupancy data', err);
      } finally {
        setLoading(false);
      }
    }
    loadOccupancy();
  }, [selectedStation]);

  // Format daily occupancy for chart
  const chartData = occupancyData.map(d => {
    const isOverbooked = d.headcount > bedCapacity;
    const isNearCapacity = d.headcount >= bedCapacity - 3;
    const formattedDate = new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    return {
      date: formattedDate,
      fullDate: d.date,
      headcount: d.headcount,
      bedCapacity,
      isOverbooked,
      status: isOverbooked ? 'OVERBOOKED' : isNearCapacity ? 'NEAR_CAPACITY' : 'NORMAL'
    };
  });

  const maxHeadcount = Math.max(0, ...occupancyData.map(d => d.headcount));
  const overbookedDays = occupancyData.filter(d => d.isOverbooked);
  const hasOverbooking = overbookedDays.length > 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <BedDouble className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Bed Capacity & Station Headcount Planner</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              Certified Habitability Limits
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real daily headcount derived from station rosters and ship/flight arrival manifests.
          </p>
        </div>

        {/* Station Selectors */}
        <div className="inline-flex items-center bg-slate-200/80 p-1 rounded-xl text-xs font-bold shadow-inner self-start sm:self-auto border border-slate-300/70">
          <button
            onClick={() => setSelectedStation('BHARATI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedStation === 'BHARATI'
                ? 'bg-sky-600 text-white shadow-sm font-extrabold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            Bharati (47 Beds)
          </button>
          <button
            onClick={() => setSelectedStation('MAITRI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              selectedStation === 'MAITRI'
                ? 'bg-emerald-600 text-white shadow-sm font-extrabold'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            Maitri (65 Beds)
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase">Certified Station Berths</span>
            <span className="text-slate-900 font-bold text-sm">{bedCapacity} Permanent Beds</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold ${
            hasOverbooking ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {hasOverbooking ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase">Peak Headcount Projection</span>
            <span className={`font-bold text-sm ${hasOverbooking ? 'text-rose-600' : 'text-slate-900'}`}>
              {maxHeadcount} Personnel ({hasOverbooking ? `+${maxHeadcount - bedCapacity} Overbooked` : 'Within limits'})
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <BedDouble className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-500 block text-[11px] uppercase">Overcapacity Window</span>
            <span className="text-slate-900 font-bold text-sm">
              {hasOverbooking
                ? `${overbookedDays[0]?.date} to ${overbookedDays[overbookedDays.length - 1]?.date}`
                : 'Zero overbooking detected'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 10, fill: '#64748b' }}
              interval={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              domain={[0, 60]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]?.payload;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs min-w-[200px] space-y-1.5 pointer-events-none z-50">
                      <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
                        <span>{selectedStation} Station</span>
                        <span>{item.fullDate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Headcount:</span>
                        <span className={`font-bold ${item.isOverbooked ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {item.headcount} Persons
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Certified Capacity:</span>
                        <span className="font-bold text-slate-200">{item.bedCapacity} Beds</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                        <span>Status:</span>
                        <span className={`font-bold ${item.isOverbooked ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {item.isOverbooked ? `Deficit: -${item.headcount - item.bedCapacity} Beds` : `Surplus: +${item.bedCapacity - item.headcount} Beds`}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <ReferenceLine
              y={bedCapacity}
              stroke="#e11d48"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{
                value: `Capacity Limit (${bedCapacity} Beds)`,
                fill: '#e11d48',
                fontSize: 11,
                fontWeight: 'bold',
                position: 'top'
              }}
            />

            <Bar dataKey="headcount" name="Headcount (Persons)" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isOverbooked ? '#e11d48' : '#0284c7'}
                />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
