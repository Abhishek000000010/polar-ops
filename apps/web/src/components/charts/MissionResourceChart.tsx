'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Compass, Plane, Users, Box, Wrench } from 'lucide-react';

interface MissionResourceChartProps {
  missions?: any[];
}

export default function MissionResourceChart({ missions = [] }: MissionResourceChartProps) {
  const [stationFilter, setStationFilter] = useState<'ALL' | 'BHARATI' | 'MAITRI'>('ALL');

  const filteredMissions = missions.filter(m =>
    stationFilter === 'ALL' ? true : m.station === stationFilter
  );

  const chartData = filteredMissions.map(m => {
    return {
      code: m.code,
      title: m.title,
      station: m.station,
      crewAssigned: m.peopleIds?.length || 0,
      cratesRequired: m.crateIds?.length || 0,
      assetsReserved: m.assetIds?.length || 0,
      priority: m.priority,
      helicopterNeeded: m.helicopterNeeded,
      status: m.status
    };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Compass className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Scientific Mission Resource Allocation</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              ISEA-47
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Comparative balance of allocated crew, cargo consignments, and heavy machinery per field expedition.
          </p>
        </div>

        {/* Station Filter Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setStationFilter('ALL')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              stationFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Stations
          </button>
          <button
            onClick={() => setStationFilter('BHARATI')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              stationFilter === 'BHARATI' ? 'bg-white text-sky-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bharati
          </button>
          <button
            onClick={() => setStationFilter('MAITRI')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              stationFilter === 'MAITRI' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Maitri
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="code"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const m = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1 max-w-xs">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex justify-between">
                        <span>{label}</span>
                        <span className="text-sky-700 font-semibold">{m.station}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] line-clamp-2">{m.title}</p>
                      <div className="pt-1.5 space-y-1">
                        <div className="flex justify-between text-slate-700">
                          <span>Crew Assigned:</span>
                          <span className="font-bold text-emerald-700">{m.crewAssigned}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Crates Required:</span>
                          <span className="font-bold text-indigo-700">{m.cratesRequired}</span>
                        </div>
                        <div className="flex justify-between text-slate-700">
                          <span>Machines Reserved:</span>
                          <span className="font-bold text-amber-700">{m.assetsReserved}</span>
                        </div>
                        {m.helicopterNeeded && (
                          <div className="text-amber-700 font-bold flex items-center space-x-1 pt-1 border-t border-slate-100">
                            <Plane className="w-3 h-3" />
                            <span>Helicopter Air-Support Required</span>
                          </div>
                        )}
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
              wrapperStyle={{ fontSize: 12, fontWeight: 600 }}
            />
            <Bar
              dataKey="crewAssigned"
              name="Field Scientists / Crew"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />
            <Bar
              dataKey="cratesRequired"
              name="Essential Crates"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />
            <Bar
              dataKey="assetsReserved"
              name="Machines / Spares"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
