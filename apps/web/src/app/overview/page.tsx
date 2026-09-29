'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Compass,
  Users,
  Box,
  Wrench,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Plane,
  Anchor,
  Flame,
  Radio,
  LayoutGrid,
  Maximize2,
  CloudSnow,
  Truck
} from 'lucide-react';
import { api } from '../../lib/api';
import FuelRunwayChart from '../../components/charts/FuelRunwayChart';
import CargoFlowChart from '../../components/charts/CargoFlowChart';
import BedCapacityChart from '../../components/charts/BedCapacityChart';
import WinterSupplyForecastChart from '../../components/charts/WinterSupplyForecastChart';
import PolarWeatherChart from '../../components/charts/PolarWeatherChart';
import TransportCapacityChart from '../../components/charts/TransportCapacityChart';
import { useAuth } from '../../lib/AuthContext';

export default function OverviewPage() {
  const [stats, setStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [crates, setCrates] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);
  const [simDate, setSimDate] = useState<string>('2026-11-15T08:00:00.000Z');
  const [viewMode, setViewMode] = useState<'GRID' | 'FOCUS'>('GRID');
  const [activeChartTab, setActiveChartTab] = useState<'FUEL' | 'CARGO' | 'BEDS' | 'WINTER' | 'WEATHER' | 'TRANSPORT'>('FUEL');
  const [loading, setLoading] = useState(true);
  const { role, name } = useAuth();

  const loadData = async () => {
    try {
      const [statsRes, alertsRes, eventsRes, missionsRes, cratesRes, invRes, peopleRes, transportRes, clockRes] = await Promise.all([
        api.getStats(),
        api.getAlerts(),
        api.getEvents(12),
        api.getMissions(),
        api.getCrates(),
        api.getInventory(),
        api.getPeople(),
        api.getTransport(),
        api.getClock()
      ]);
      if (statsRes?.data) setStats(statsRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      if (eventsRes?.data) setEvents(eventsRes.data);
      if (missionsRes?.data) setMissions(missionsRes.data);
      if (cratesRes?.data) setCrates(cratesRes.data);
      if (invRes?.data) setInventory(invRes.data);
      if (peopleRes?.data) setPeople(peopleRes.data);
      if (transportRes?.data) setTransports(transportRes.data);
      if (clockRes?.data?.simulatedDate) setSimDate(clockRes.data.simulatedDate);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm animate-pulse">
        Loading Polar Operations telemetry stream...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Mission Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-sky-700 uppercase tracking-wide mb-1">
            <span className="w-2 h-2 rounded-full bg-sky-600"></span>
            <span>Active Expedition: ISEA-47 (Season 2026–2027)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {role === 'ADMIN' ? 'Operations Command Center' : `Dashboard: ${name}`}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Status monitoring for Bharati, Maitri, Himadri, and Southern Ocean transit corridors.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/alerts"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-md bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition shadow-2xs"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{alerts.length} Active Bottlenecks</span>
            <ChevronRight className="w-3.5 h-3.5 text-rose-500 ml-0.5" />
          </Link>
          <Link
            href="/ripple"
            className="flex items-center space-x-2 px-3.5 py-2 rounded-md bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 text-xs font-semibold transition shadow-2xs"
          >
            <Activity className="w-4 h-4 text-sky-600" />
            <span>Ripple Graph</span>
          </Link>
        </div>
      </div>

      {/* 4 Core Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Missions */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Active Missions</span>
            <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{stats?.activeMissionsCount || 0}</span>
            <span className="text-xs text-slate-500">planned & ongoing</span>
          </div>
          <div className="mt-4 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
            <span>Expedition: ISEA-47</span>
            <Link href="/expeditions" className="text-sky-600 hover:text-sky-700 font-medium flex items-center">
              View <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: Personnel & Readiness */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Personnel Deployed</span>
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{stats?.personnelDeployed || 0}</span>
            <span className="text-xs text-slate-500">field team members</span>
          </div>
          <div className="mt-4 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className={stats?.personnelReadinessPending > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'}>
              {stats?.personnelReadinessPending || 0} pending clearances
            </span>
            <Link href="/people" className="text-sky-600 hover:text-sky-700 font-medium flex items-center">
              Roster <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 3: Cargo Lifeline */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Cargo In Transit</span>
            <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{stats?.cratesInTransit || 0}</span>
            <span className="text-xs text-slate-500">crates moving</span>
          </div>
          <div className="mt-4 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className={stats?.cratesCritical > 0 ? 'text-rose-700 font-medium' : 'text-slate-500'}>
              {stats?.cratesCritical || 0} deadline overdue
            </span>
            <Link href="/cargo" className="text-sky-600 hover:text-sky-700 font-medium flex items-center">
              Stages <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>

        {/* Card 4: Equipment & Spares */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-600">Operational Assets</span>
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-slate-900 tabular-nums">{stats?.assetsOperational || 0}</span>
            <span className="text-xs text-slate-500">machines online</span>
          </div>
          <div className="mt-4 text-xs text-slate-500 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className={stats?.assetsMaintenanceDue > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'}>
              {stats?.assetsMaintenanceDue || 0} service due
            </span>
            <Link href="/assets" className="text-sky-600 hover:text-sky-700 font-medium flex items-center">
              Spares <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Multi-Graph Analytics Section */}
      <div className="space-y-3">
        <div className="flex flex-col gap-4 border-b border-slate-200/90 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-sky-600"></span>
              <span>Predictive Operations & Visual Logistics</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Live simulation models for polar fuel depletion, cargo transit, station bunks, and winter stockouts.
            </p>
          </div>

          {/* Clean High-Contrast Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-full sm:w-fit">
            <button
              onClick={() => setActiveChartTab('FUEL')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'FUEL'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Fuel Runway</span>
            </button>

            <button
              onClick={() => setActiveChartTab('CARGO')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'CARGO'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-indigo-300" />
              <span>5-Leg Cargo Pipeline</span>
            </button>

            <button
              onClick={() => setActiveChartTab('BEDS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'BEDS'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-sky-300" />
              <span>Bed Capacity</span>
            </button>

            <button
              onClick={() => setActiveChartTab('WINTER')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'WINTER'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-rose-300" />
              <span>Winter Forecast</span>
            </button>

            <button
              onClick={() => setActiveChartTab('WEATHER')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeChartTab === 'WEATHER'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CloudSnow className="w-3.5 h-3.5 text-blue-300" />
              <span>Polar Weather</span>
            </button>
          </div>
        </div>

        {/* Selected Chart Display */}
        <div>
          {activeChartTab === 'FUEL' && (
            <FuelRunwayChart
              bharatiFuel={inventory.find(i => i.station === 'BHARATI' && i.category === 'FUEL')?.quantity || 18500}
              maitriFuel={inventory.find(i => i.station === 'MAITRI' && i.category === 'FUEL')?.quantity || 48000}
              simDate={simDate}
            />
          )}

          {activeChartTab === 'CARGO' && (
            <CargoFlowChart crates={crates} />
          )}

          {activeChartTab === 'BEDS' && (
            <BedCapacityChart people={people} simDate={simDate} />
          )}

          {activeChartTab === 'WINTER' && (
            <WinterSupplyForecastChart inventory={inventory} simDate={simDate} />
          )}

          {activeChartTab === 'WEATHER' && (
            <PolarWeatherChart simDate={simDate} />
          )}
        </div>
      </div>

      {/* Middle Section: Active Stations Overview & Key Scientific Missions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Stations Status Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
              Station Operational Status
            </h2>
            <span className="text-xs text-slate-500 font-medium">Antarctic Summer Window</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bharati Station */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">Bharati Station</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OPERATIONAL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">69°24'S, 76°11'E · Larsemann Hills</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span className="font-medium text-amber-700">AWS: -14°C</span>
                  <div className="text-rose-600 font-medium">Gale: 45 kts</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Fuel Stock</span>
                  <span className="text-rose-600 font-bold text-sm">18,500 L</span>
                  <span className="text-[10px] text-rose-500 block mt-0.5 font-medium">Below Min (25k)</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Runway</span>
                  <span className="text-amber-700 font-bold text-sm">~66 Days</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Burn: 280 L/d</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Crew On-Site</span>
                  <span className="text-slate-800 font-bold text-sm">22 Persons</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">47 Bunks Max</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Flagship ETA: 28 Nov 2026</span>
                <Link href="/inventory?station=BHARATI" className="text-sky-600 hover:text-sky-700 font-semibold">
                  Station Inventory →
                </Link>
              </div>
            </div>

            {/* Maitri Station */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">Maitri Station</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OPERATIONAL
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">70°45'S, 11°44'E · Schirmacher Oasis</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span className="font-medium text-slate-700">AWS: -18°C</span>
                  <div className="text-emerald-700 font-medium">Wind: 18 kts</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Fuel Stock</span>
                  <span className="text-emerald-700 font-bold text-sm">48,000 L</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">Sufficient</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Runway</span>
                  <span className="text-slate-800 font-bold text-sm">~155 Days</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Burn: 310 L/d</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Crew On-Site</span>
                  <span className="text-slate-800 font-bold text-sm">18 Persons</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">65 Bunks Max</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Vessel Stop: Dec 2026</span>
                <Link href="/inventory?station=MAITRI" className="text-sky-600 hover:text-sky-700 font-semibold">
                  Station Inventory →
                </Link>
              </div>
            </div>

            {/* Maritime Corridor: MV Vasily Golovnin */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">MV Vasily Golovnin</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                      EN ROUTE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">48°S, 32°E · Southern Ocean Corridor</p>
                </div>
                <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Anchor className="w-4 h-4" />
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cargo Stowed:</span>
                  <span className="font-semibold text-slate-800">1,850 MT (Hold 1-4)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Passengers:</span>
                  <span className="font-semibold text-slate-800">68 scientists & crew</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Next Waypoint:</span>
                  <span className="text-sky-700 font-semibold">Prydz Bay / Bharati (Nov 28)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Helicopters: 2 Kamov Ka-32 on deck</span>
                <Link href="/transport" className="text-sky-600 hover:text-sky-700 font-semibold">
                  Fleet Details →
                </Link>
              </div>
            </div>

            {/* Cape Town Antarctic Gateway Hub */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">Cape Town Gateway</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      CONSOLIDATION
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Berth 104, Cape Town Port (RSA)</p>
                </div>
                <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Plane className="w-4 h-4" />
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Staged Air Cargo:</span>
                  <span className="font-semibold text-slate-800">14 Crates (DROMLAN IL-76)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pre-staged Fuel:</span>
                  <span className="font-semibold text-slate-800">60,000 L drums</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customs Holds:</span>
                  <span className="text-rose-600 font-semibold">1 Crate (CRT-2026-118)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-rose-600 font-medium">SAMSA DG Clearance Pending</span>
                <Link href="/cargo" className="text-sky-600 hover:text-sky-700 font-semibold">
                  View Manifest →
                </Link>
              </div>
            </div>
          </div>

          {/* Active Missions Preview */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Key Scientific Missions (ISEA-47)
              </h3>
              <Link href="/expeditions" className="text-xs text-sky-600 hover:text-sky-700 font-semibold">
                All Missions →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {missions.slice(0, 3).map((m: any) => (
                <div key={m._id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sky-700 font-bold">{m.code}</span>
                      <span className="text-slate-900 font-semibold">{m.title}</span>
                      <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                        Priority {m.priority}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center space-x-4">
                      <span>Station: <strong>{m.station}</strong></span>
                      <span>Timeline: {m.startDate.split('T')[0]} to {m.endDate.split('T')[0]}</span>
                      {m.helicopterNeeded && (
                        <span className="text-amber-700 font-medium">Helicopter Required</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-emerald-700 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200">
                      {m.status}
                    </span>
                    <Link
                      href={`/ripple?type=MISSION&id=${m._id}`}
                      title="Inspect Ripple Dependencies"
                      className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-sky-600 transition"
                    >
                      <Activity className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Event Audit Stream (appendEvent() output) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase">
              Operational Event Stream
            </h2>
            <span className="text-xs text-slate-500 font-medium">Live Audit Log</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3 max-h-[660px] overflow-y-auto divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No events recorded yet.</div>
            ) : (
              events.map((ev: any) => (
                <div key={ev._id} className="pt-3 first:pt-0 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="text-sky-700 font-semibold">{ev.entityType}</span>
                    <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-slate-900 font-medium">
                    <span className="text-slate-700 font-bold">{ev.action}</span>
                    {ev.payload?.code && <span className="ml-1 text-slate-500">[{ev.payload.code}]</span>}
                    {ev.payload?.itemCode && <span className="ml-1 text-slate-500">[{ev.payload.itemCode}]</span>}
                  </p>
                  {ev.payload?.details && (
                    <p className="text-xs text-slate-500 mt-1">{ev.payload.details}</p>
                  )}
                  {ev.payload?.reason && (
                    <p className="text-xs text-slate-500 mt-1">Reason: {ev.payload.reason}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Actor: {ev.actor}</span>
                    <span>{new Date(ev.timestamp).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
