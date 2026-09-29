'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Shield, Heart, Mountain, FileCheck } from 'lucide-react';

interface ReadinessDonutChartProps {
  people?: any[];
}

export default function ReadinessDonutChart({ people = [] }: ReadinessDonutChartProps) {
  const total = people.length || 1;

  const medicalCleared = people.filter(p => p.readiness?.medicalCleared).length;
  const auliCompleted = people.filter(p => p.readiness?.auliTrainingCompleted).length;
  const passportValid = people.filter(p => p.readiness?.passportValid).length;
  const permitIssued = people.filter(p => p.readiness?.polarPermitIssued).length;

  const fullyCertified = people.filter(p =>
    p.readiness?.medicalCleared &&
    p.readiness?.auliTrainingCompleted &&
    p.readiness?.passportValid &&
    p.readiness?.polarPermitIssued
  ).length;

  const pendingPersonnel = total - fullyCertified;

  const pieData = [
    { name: 'Fully Certified Crew', value: fullyCertified, color: '#10b981' },
    { name: 'Pending Polar Gates', value: pendingPersonnel, color: '#f59e0b' }
  ];

  const overallPercent = Math.round((fullyCertified / total) * 100);

  const gates = [
    { label: 'AIIMS Medical', passed: medicalCleared, icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Auli Snow Training', passed: auliCompleted, icon: Mountain, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Passport Validity', passed: passportValid, icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'MoES Polar Permit', passed: permitIssued, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' }
  ];

  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Shield className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-bold text-slate-900">4-Tier Polar Readiness Certification</h3>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
          {overallPercent}% Operational
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Donut Chart with Percentage Center */}
        <div className="relative h-48 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                offset={15}
                wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const entry = payload[0];
                    const pct = Math.round((Number(entry.value) / total) * 100);
                    return (
                      <div className="bg-slate-900/95 backdrop-blur-sm text-white border border-slate-700/80 rounded-xl px-3 py-2 shadow-2xl text-xs space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: entry.payload.color }}
                          />
                          <span className="font-bold text-slate-100">{entry.name}</span>
                        </div>
                        <div className="flex items-center justify-between space-x-3 text-[11px] text-slate-300 pt-0.5">
                          <span>Count: <strong className="text-white">{entry.value}</strong> of {total}</span>
                          <span className="font-extrabold text-emerald-400">{pct}%</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                isAnimationActive={true}
                animationDuration={600}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-all duration-200 cursor-pointer hover:opacity-90"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isHovered ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <span className="text-2xl font-extrabold text-slate-900 leading-none">{overallPercent}%</span>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">Deployment Ready</span>
          </div>
        </div>

        {/* 4 Gate Performance Cards */}
        <div className="space-y-2">
          {gates.map((g, idx) => {
            const Icon = g.icon;
            const pct = Math.round((g.passed / total) * 100);

            return (
              <div key={idx} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className={`p-1 rounded-md ${g.bg} ${g.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <div className="font-semibold text-slate-800">{g.label}</div>
                    <div className="text-[10px] text-slate-500">{g.passed} of {total} crew cleared</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold ${pct === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
