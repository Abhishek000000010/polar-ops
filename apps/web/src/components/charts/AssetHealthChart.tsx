'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Wrench } from 'lucide-react';

interface AssetHealthChartProps {
  assets?: any[];
  simDate?: string;
}

export default function AssetHealthChart({
  assets = [],
  simDate = '2026-11-15T08:00:00.000Z'
}: AssetHealthChartProps) {
  const chartData = assets.map((a: any) => {
    // Derive effective status from API field or date comparison against simulation clock
    const effectiveStatus = a.effectiveStatus || (
      a.status === 'UNDER_REPAIR' || a.status === 'DECOMMISSIONED'
        ? a.status
        : (a.nextServiceDueDate && new Date(a.nextServiceDueDate) <= new Date(simDate))
          ? 'MAINTENANCE_DUE'
          : 'OPERATIONAL'
    );
    const isMaintenanceDue = effectiveStatus === 'MAINTENANCE_DUE';

    return {
      code: a.assetCode,
      name: a.name,
      runtimeHours: a.runtimeHours || 0,
      status: effectiveStatus,
      isMaintenanceDue,
      station: a.location,
      dueDate: a.nextServiceDueDate?.split('T')[0] || 'N/A'
    };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Wrench className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Critical Machinery Runtime & Service Status</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Logged engine hours and clock-derived maintenance status for diesel gensets and expedition equipment.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-semibold">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600">Operational</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="text-rose-700">Maintenance Overdue</span>
          </div>
        </div>
      </div>

      <div className="h-60 w-full pt-2">
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
              tickFormatter={(v) => `${v.toLocaleString()} hrs`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]?.payload;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl border border-slate-700 text-xs min-w-[220px] space-y-1.5 pointer-events-none z-50">
                      <div className="font-bold text-slate-100 border-b border-slate-700 pb-1 flex justify-between items-center">
                        <span className="truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({item.code})</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Runtime:</span>
                        <span className="font-bold text-slate-100">{item.runtimeHours.toLocaleString()} hrs</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Station:</span>
                        <span className="font-medium text-slate-200">{item.station}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                        <span>Effective Status:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          item.isMaintenanceDue ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-0.5">Next Service Due: {item.dueDate}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="runtimeHours" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isMaintenanceDue ? '#e11d48' : '#0284c7'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
