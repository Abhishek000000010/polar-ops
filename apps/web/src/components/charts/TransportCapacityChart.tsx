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
  Cell,
  Legend
} from 'recharts';
import { Truck, Plane, Anchor, AlertTriangle } from 'lucide-react';

interface TransportCapacityChartProps {
  transports?: any[];
}

export default function TransportCapacityChart({ transports = [] }: TransportCapacityChartProps) {
  const [metric, setMetric] = useState<'SEATS' | 'PAYLOAD'>('SEATS');

  const chartData = transports.map(t => {
    let utilizedSeats = 0;
    if (t.type === 'SHIP') utilizedSeats = 68; // 68 of 85 passengers booked
    else if (t.type === 'HELICOPTER') utilizedSeats = 8; // 8 of 14 passengers
    else if (t.type === 'VEHICLE') utilizedSeats = 4; // 4 of 6 crew

    const availableSeats = Math.max(0, t.passengerSeats - utilizedSeats);

    // Payload (in MT or kg)
    const capacityTonnes = t.capacityKg / 1000;
    let utilizedTonnes = 0;
    if (t.type === 'SHIP') utilizedTonnes = 1850; // 1,850 MT stowed of 4,500 MT
    else if (t.type === 'HELICOPTER') utilizedTonnes = 2.4; // 2.4 MT of 4 MT
    else if (t.type === 'VEHICLE') utilizedTonnes = 5.2; // 5.2 MT of 8 MT

    return {
      name: t.name.split('(')[0].trim(),
      type: t.type,
      fullName: t.name,
      totalSeats: t.passengerSeats,
      utilizedSeats,
      availableSeats,
      capacityTonnes: Math.round(capacityTonnes),
      utilizedTonnes: Math.round(utilizedTonnes * 10) / 10,
      availableTonnes: Math.round((capacityTonnes - utilizedTonnes) * 10) / 10,
      status: t.status,
      location: t.currentLocation
    };
  });

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <Truck className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Fleet Lift Capacity & Berth Allocation</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              Helicopter & Ship Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Tracking utilized vs reserve lift capacities across icebreaker hold, Kamov sling sorts, and snowcat convoys.
          </p>
        </div>

        {/* Metric Selector Toggle */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setMetric('SEATS')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              metric === 'SEATS' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Passenger Berths / Seats
          </button>
          <button
            onClick={() => setMetric('PAYLOAD')}
            className={`px-3 py-1.5 rounded-md transition cursor-pointer ${
              metric === 'PAYLOAD' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cargo Payload (MT)
          </button>
        </div>
      </div>

      {/* Helicopter Departure Notice (SIH Differentiator #4) */}
      <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/90 flex items-start space-x-2.5 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Helicopter Availability Window (Differentiator #4):</span>
          <span className="ml-1">
            Kamov Ka-32 helicopters are embarked on MV Vasily Golovnin. Station sling flights are ONLY available between <strong>28 Nov – 18 Dec 2026</strong>. Tasks planned after ship departure cannot use helicopter air-support.
          </span>
        </div>
      </div>

      {/* Recharts Stacked Bar Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              unit={metric === 'SEATS' ? ' seats' : ' MT'}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1">{item.fullName}</div>
                      <div className="text-slate-500 text-[11px]">Type: {item.type} · Status: {item.status}</div>
                      {metric === 'SEATS' ? (
                        <>
                          <div className="flex justify-between space-x-4 text-slate-700">
                            <span>Booked Berths:</span>
                            <span className="font-bold text-sky-700">{item.utilizedSeats} seats</span>
                          </div>
                          <div className="flex justify-between space-x-4 text-slate-700">
                            <span>Available Berths:</span>
                            <span className="font-bold text-emerald-700">{item.availableSeats} seats</span>
                          </div>
                          <div className="flex justify-between space-x-4 pt-1 border-t border-slate-100 font-bold text-slate-900">
                            <span>Total Capacity:</span>
                            <span>{item.totalSeats} seats</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between space-x-4 text-slate-700">
                            <span>Stowed Cargo:</span>
                            <span className="font-bold text-indigo-700">{item.utilizedTonnes} MT</span>
                          </div>
                          <div className="flex justify-between space-x-4 text-slate-700">
                            <span>Reserve Hold:</span>
                            <span className="font-bold text-emerald-700">{item.availableTonnes} MT</span>
                          </div>
                          <div className="flex justify-between space-x-4 pt-1 border-t border-slate-100 font-bold text-slate-900">
                            <span>Total Payload:</span>
                            <span>{item.capacityTonnes} MT</span>
                          </div>
                        </>
                      )}
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
            {metric === 'SEATS' ? (
              <>
                <Bar
                  dataKey="utilizedSeats"
                  name="Allocated Passenger Berths"
                  stackId="seats"
                  fill="#0284c7"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={850}
                />
                <Bar
                  dataKey="availableSeats"
                  name="Vacant / Reserve Berths"
                  stackId="seats"
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={850}
                />
              </>
            ) : (
              <>
                <Bar
                  dataKey="utilizedTonnes"
                  name="Stowed Cargo (MT)"
                  stackId="payload"
                  fill="#6366f1"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={850}
                />
                <Bar
                  dataKey="availableTonnes"
                  name="Available Lift (MT)"
                  stackId="payload"
                  fill="#cbd5e1"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={850}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
