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
  Legend
} from 'recharts';
import { Box, Anchor, ArrowRight } from 'lucide-react';

interface CargoFlowChartProps {
  crates?: any[];
}

export default function CargoFlowChart({ crates = [] }: CargoFlowChartProps) {
  // Aggregate crates across standard route stages
  const stages = [
    { key: 'Goa Hub', label: 'Goa Hub', matchIndex: 0 },
    { key: 'Mumbai Port', label: 'Mumbai Port', matchIndex: 1 },
    { key: 'Cape Town Gateway', label: 'Cape Town Hub', matchIndex: 2 },
    { key: 'Polar Vessel', label: 'Polar Vessel', matchIndex: 3 },
    { key: 'Station Arrival', label: 'Station Port', matchIndex: 4 },
  ];

  const chartData = stages.map((stg) => {
    // Find crates currently at this stage index
    const matching = crates.filter((c: any) => c.currentStageIndex === stg.matchIndex);
    const totalWeightKg = matching.reduce((acc: number, c: any) => acc + (c.weightKg || 0), 0);
    const hazWeightKg = matching
      .filter((c: any) => c.hazardous)
      .reduce((acc: number, c: any) => acc + (c.weightKg || 0), 0);
    const standardWeightKg = totalWeightKg - hazWeightKg;

    return {
      stage: stg.label,
      standardWeight: Math.round(standardWeightKg),
      hazardousWeight: Math.round(hazWeightKg),
      cratesCount: matching.length,
      totalWeight: totalWeightKg
    };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Box className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Cargo Intermodal Pipeline (Weight Distribution)</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
              5 Transit Legs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tonnage tracking across the supply corridor from Goa Hub to Antarctic ice shelves.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
          <Anchor className="w-3.5 h-3.5 text-sky-600" />
          <span>Charter Vessel Hold: <strong>Hold 1-4 Active</strong></span>
        </div>
      </div>

      {/* Recharts Stacked Bar Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `${v} kg`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex justify-between gap-4">
                        <span>{label}</span>
                        <span className="text-sky-700">{dataPoint.cratesCount} crate(s)</span>
                      </div>
                      <div className="flex justify-between space-x-4 text-slate-600">
                        <span>General Cargo:</span>
                        <span className="font-bold text-slate-900">{dataPoint.standardWeight.toLocaleString()} kg</span>
                      </div>
                      {dataPoint.hazardousWeight > 0 && (
                        <div className="flex justify-between space-x-4 text-rose-600">
                          <span>Dangerous Goods:</span>
                          <span className="font-bold">{dataPoint.hazardousWeight.toLocaleString()} kg</span>
                        </div>
                      )}
                      <div className="flex justify-between space-x-4 pt-1 border-t border-slate-100 text-slate-900 font-bold">
                        <span>Total Weight:</span>
                        <span>{dataPoint.totalWeight.toLocaleString()} kg</span>
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
              dataKey="standardWeight"
              name="Standard Scientific Cargo"
              stackId="a"
              fill="#6366f1"
              radius={[0, 0, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />
            <Bar
              dataKey="hazardousWeight"
              name="Dangerous / Hazardous Goods"
              stackId="a"
              fill="#f43f5e"
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
