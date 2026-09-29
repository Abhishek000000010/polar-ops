'use client';

import React, { useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend
} from 'recharts';
import { CloudSnow, Wind, Thermometer, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PolarWeatherChartProps {
  simDate?: string;
}

export default function PolarWeatherChart({
  simDate = '2026-11-15T08:00:00.000Z'
}: PolarWeatherChartProps) {
  const [station, setStation] = useState<'BHARATI' | 'MAITRI'>('BHARATI');

  const stationData = {
    BHARATI: {
      name: 'Bharati Station (Larsemann Hills)',
      coords: "69°24'S, 76°11'E",
      currentTemp: -14,
      currentWind: 42,
      condition: 'Katabatic Gale Active',
      status: 'FLIGHT_RESTRICTED',
      data: [
        { day: 'Day 1', date: 'Nov 15', temp: -14, windKnots: 42, windChill: -28, flightClear: false },
        { day: 'Day 2', date: 'Nov 16', temp: -16, windKnots: 48, windChill: -32, flightClear: false },
        { day: 'Day 3', date: 'Nov 17', temp: -15, windKnots: 38, windChill: -29, flightClear: false },
        { day: 'Day 4', date: 'Nov 18', temp: -12, windKnots: 28, windChill: -22, flightClear: true },
        { day: 'Day 5', date: 'Nov 19', temp: -10, windKnots: 18, windChill: -18, flightClear: true },
        { day: 'Day 6', date: 'Nov 20', temp: -11, windKnots: 22, windChill: -19, flightClear: true },
        { day: 'Day 7', date: 'Nov 21', temp: -13, windKnots: 32, windChill: -24, flightClear: true },
        { day: 'Day 8', date: 'Nov 22', temp: -18, windKnots: 52, windChill: -36, flightClear: false },
        { day: 'Day 9', date: 'Nov 23', temp: -17, windKnots: 45, windChill: -33, flightClear: false },
        { day: 'Day 10', date: 'Nov 24', temp: -14, windKnots: 26, windChill: -23, flightClear: true },
        { day: 'Day 11', date: 'Nov 25', temp: -12, windKnots: 20, windChill: -19, flightClear: true },
        { day: 'Day 12', date: 'Nov 26', temp: -13, windKnots: 24, windChill: -21, flightClear: true },
        { day: 'Day 13', date: 'Nov 27', temp: -15, windKnots: 30, windChill: -25, flightClear: true },
        { day: 'Day 14', date: 'Nov 28 (Ship)', temp: -12, windKnots: 19, windChill: -19, flightClear: true }
      ]
    },
    MAITRI: {
      name: 'Maitri Station (Schirmacher Oasis)',
      coords: "70°45'S, 11°44'E",
      currentTemp: -18,
      currentWind: 18,
      condition: 'Clear Continental Polar',
      status: 'ALL_FLIGHTS_CLEAR',
      data: [
        { day: 'Day 1', date: 'Nov 15', temp: -18, windKnots: 18, windChill: -27, flightClear: true },
        { day: 'Day 2', date: 'Nov 16', temp: -19, windKnots: 16, windChill: -28, flightClear: true },
        { day: 'Day 3', date: 'Nov 17', temp: -21, windKnots: 22, windChill: -32, flightClear: true },
        { day: 'Day 4', date: 'Nov 18', temp: -20, windKnots: 25, windChill: -31, flightClear: true },
        { day: 'Day 5', date: 'Nov 19', temp: -17, windKnots: 19, windChill: -26, flightClear: true },
        { day: 'Day 6', date: 'Nov 20', temp: -16, windKnots: 15, windChill: -24, flightClear: true },
        { day: 'Day 7', date: 'Nov 21', temp: -18, windKnots: 20, windChill: -27, flightClear: true },
        { day: 'Day 8', date: 'Nov 22', temp: -22, windKnots: 34, windChill: -36, flightClear: true },
        { day: 'Day 9', date: 'Nov 23', temp: -24, windKnots: 40, windChill: -41, flightClear: false },
        { day: 'Day 10', date: 'Nov 24', temp: -20, windKnots: 28, windChill: -32, flightClear: true },
        { day: 'Day 11', date: 'Nov 25', temp: -18, windKnots: 18, windChill: -27, flightClear: true },
        { day: 'Day 12', date: 'Nov 26', temp: -17, windKnots: 15, windChill: -25, flightClear: true },
        { day: 'Day 13', date: 'Nov 27', temp: -19, windKnots: 21, windChill: -29, flightClear: true },
        { day: 'Day 14', date: 'Nov 28', temp: -20, windKnots: 22, windChill: -30, flightClear: true }
      ]
    }
  };

  const curr = stationData[station];

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
              <CloudSnow className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900">Polar Weather & Flight Window Forecast (AWS)</h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200">
              14-Day Horizon
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automatic Weather Station (AWS) katabatic wind tracking and Kamov Ka-32 flight clearance thresholds.
          </p>
        </div>

        {/* Station Toggle */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setStation('BHARATI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              station === 'BHARATI'
                ? 'bg-white text-sky-700 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bharati Station
          </button>
          <button
            onClick={() => setStation('MAITRI')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              station === 'MAITRI'
                ? 'bg-white text-sky-700 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Maitri Station
          </button>
        </div>
      </div>

      {/* Real-Time AWS Weather Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">AWS Surface Temp</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{curr.currentTemp}°C</div>
            <div className="text-[10px] text-slate-400">Wind chill down to -32°C</div>
          </div>
          <span className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Thermometer className="w-5 h-5" />
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Katabatic Wind Speed</div>
            <div className={`text-xl font-black mt-0.5 ${curr.currentWind >= 35 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {curr.currentWind} Knots
            </div>
            <div className="text-[10px] text-slate-400">Limit: 35 kts for flight sorties</div>
          </div>
          <span className="p-2 rounded-lg bg-amber-100 text-amber-700">
            <Wind className="w-5 h-5" />
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Helicopter Sortie Status</div>
            <div className="text-sm font-bold text-slate-900 mt-1 flex items-center space-x-1.5">
              {curr.currentWind >= 35 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-rose-600 font-extrabold">GROUNDED (Gale Force)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-extrabold">CLEAR FOR SORTIES</span>
                </>
              )}
            </div>
            <div className="text-[10px] text-slate-400">Safety ceiling maintained</div>
          </div>
        </div>
      </div>

      {/* Composed Chart: Wind Speed Bars + Temperature Curve */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={curr.data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <YAxis
              yAxisId="wind"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              unit=" kts"
              domain={[0, 60]}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#64748b' }}
              unit="°C"
              domain={[-30, 0]}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const pt = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs space-y-1">
                      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1 flex justify-between">
                        <span>{label}</span>
                        <span className={pt.flightClear ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'}>
                          {pt.flightClear ? 'Flight Window Open' : 'Flight Window Closed'}
                        </span>
                      </div>
                      <div className="flex justify-between space-x-4 text-slate-600">
                        <span>Wind Speed:</span>
                        <span className="font-bold text-slate-900">{pt.windKnots} knots</span>
                      </div>
                      <div className="flex justify-between space-x-4 text-slate-600">
                        <span>Surface Temp:</span>
                        <span className="font-bold text-sky-700">{pt.temp}°C</span>
                      </div>
                      <div className="flex justify-between space-x-4 text-slate-600">
                        <span>Wind Chill:</span>
                        <span className="font-bold text-rose-600">{pt.windChill}°C</span>
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

            {/* Reference Line for Max Flight Limit */}
            <ReferenceLine
              yAxisId="wind"
              y={35}
              stroke="#e11d48"
              strokeWidth={2}
              strokeDasharray="4 4"
              label={{
                value: 'Max Helo Limit (35 kts)',
                fill: '#e11d48',
                fontSize: 10,
                position: 'insideTopLeft'
              }}
            />

            <Bar
              yAxisId="wind"
              dataKey="windKnots"
              name="Wind Speed (Knots)"
              fill="#93c5fd"
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
            />

            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="Surface Temperature (°C)"
              stroke="#0284c7"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#0284c7' }}
              activeDot={{ r: 5 }}
              isAnimationActive={true}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
