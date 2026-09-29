'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, RotateCcw, MapPin, RefreshCw, Thermometer, Radio, Wifi, WifiOff, Globe2 } from 'lucide-react';
import { api } from '../lib/api';
import { pendingCount, isBrowserOnline, isSimulatedOffline, setSimulatedOffline, startAutoSync } from '../lib/offlineSync';

export default function TopHeader() {
  const [simDate, setSimDate] = useState<string>('2026-11-15T08:00:00.000Z');
  const [isResetting, setIsResetting] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [online, setOnline] = useState(true);
  const [simOffline, setSimOffline] = useState(false);
  const [browserOutboxCount, setBrowserOutboxCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const updateConnectivity = () => {
    setOnline(isBrowserOnline());
    setSimOffline(isSimulatedOffline());
    setBrowserOutboxCount(pendingCount());
  };

  useEffect(() => {
    updateConnectivity();
    const onSyncState = (e: Event) => setSyncing(!!(e as CustomEvent).detail?.syncing);
    const events = ['online', 'offline', 'polar:connectivity_change', 'polar:outbox_change'];
    events.forEach(ev => window.addEventListener(ev, updateConnectivity));
    window.addEventListener('polar:sync_state', onSyncState);
    const stopAutoSync = startAutoSync();
    return () => {
      events.forEach(ev => window.removeEventListener(ev, updateConnectivity));
      window.removeEventListener('polar:sync_state', onSyncState);
      stopAutoSync();
    };
  }, []);

  const toggleSimulatedOffline = () => {
    const nextVal = !simOffline;
    setSimulatedOffline(nextVal);
    setSimOffline(nextVal);
    setOnline(!nextVal);
  };

  const fetchClock = async () => {
    try {
      const res = await api.getClock();
      if (res?.data?.simulatedDate) setSimDate(res.data.simulatedDate);
    } catch (e) {
      console.warn('Clock fetch error', e);
    }
  };

  useEffect(() => {
    fetchClock();
    const interval = setInterval(fetchClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStepClock = async (days: number) => {
    setIsStepping(true);
    try {
      const res = await api.stepClock(days);
      if (res?.data?.simulatedDate) {
        setSimDate(res.data.simulatedDate);
        window.location.reload();
      }
    } finally {
      setIsStepping(false);
    }
  };

  const handleResetClock = async () => {
    setIsStepping(true);
    try {
      const res = await api.resetClock();
      if (res?.data?.simulatedDate) {
        setSimDate(res.data.simulatedDate);
        window.location.reload();
      }
    } finally {
      setIsStepping(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('Reset entire polar operations database to baseline Seed 47 data?')) return;
    setIsResetting(true);
    try {
      await api.resetDatabase();
      window.location.reload();
    } catch (err) {
      alert('Reset failed: ' + err);
    } finally {
      setIsResetting(false);
    }
  };

  const formattedDate = new Date(simDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="h-[68px] bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-40 select-none shadow-sm transition-colors">
      {/* Station Coordinates Indicator */}
      <div className="flex items-center space-x-4">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-slate-300" />
          Stations
        </span>
        <div className="flex items-center gap-2.5">
          <div className="group flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200/60 hover:border-slate-300 rounded-full text-xs transition-all cursor-default shadow-sm hover:shadow-md">
            <span className="font-semibold text-slate-700">Bharati</span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">69°S</span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 px-1.5 py-0.5 rounded-full">-14°C</span>
          </div>

          <div className="group flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200/60 hover:border-slate-300 rounded-full text-xs transition-all cursor-default shadow-sm hover:shadow-md">
            <span className="font-semibold text-slate-700">Maitri</span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">70°S</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded-full">-18°C</span>
          </div>

          <div className="group flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200/60 hover:border-slate-300 rounded-full text-xs transition-all cursor-default shadow-sm hover:shadow-md hidden sm:flex">
            <span className="font-semibold text-slate-700">Himadri</span>
            <span className="text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">78°N</span>
            <span className="text-[10px] font-bold text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded-full">-8°C</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* Connection Status */}
        <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-sm">
          <Link
            href="/sync"
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              online
                ? 'bg-white text-emerald-700 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-100'
                : 'bg-amber-50 text-amber-800 animate-pulse border border-amber-200/50'
            }`}
            title="Open Field Sync"
          >
            {syncing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            ) : online ? (
              <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : (
              <Radio className="w-4 h-4 text-amber-600" />
            )}
            <span className="hidden sm:inline">
              {syncing ? 'Syncing…' : online ? 'Connected' : 'Offline Mode'}
            </span>
            {browserOutboxCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                {browserOutboxCount}
              </span>
            )}
          </Link>

          <button
            onClick={toggleSimulatedOffline}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-1 cursor-pointer ${
              simOffline
                ? 'bg-amber-600 text-white shadow-md hover:bg-amber-500'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
            }`}
            title={simOffline ? 'Restore link' : 'Simulate offline mode'}
          >
            {simOffline ? 'Reconnect' : 'Disconnect'}
          </button>
        </div>

        <div className="w-px h-6 bg-slate-200/80 hidden md:block"></div>

        {/* Simulation Clock Controls */}
        <div className="hidden md:flex items-center space-x-3 bg-white border border-slate-200/80 rounded-xl px-2 py-1 shadow-sm">
          <div className="flex items-center space-x-2 px-2 py-1">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-800">{formattedDate}</span>
          </div>

          <div className="flex items-center space-x-1 bg-slate-50 rounded-lg p-0.5 border border-slate-100">
            <button
              onClick={() => handleStepClock(1)}
              disabled={isStepping}
              className="px-2 py-1 hover:bg-white hover:shadow-sm text-slate-600 rounded-md text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              +1d
            </button>
            <button
              onClick={() => handleStepClock(7)}
              disabled={isStepping}
              className="px-2 py-1 hover:bg-white hover:shadow-sm text-slate-600 rounded-md text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              +7d
            </button>
            <button
              onClick={() => handleStepClock(30)}
              disabled={isStepping}
              className="px-2 py-1 hover:bg-white hover:shadow-sm text-slate-600 rounded-md text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              +30d
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              onClick={handleResetClock}
              disabled={isStepping}
              title="Reset clock"
              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="w-px h-6 bg-slate-200/80 hidden lg:block"></div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleResetDatabase}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 text-rose-600 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden xl:inline">{isResetting ? 'Resetting...' : 'Reset DB'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
