'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Users,
  Box,
  Truck,
  Layers,
  Wrench,
  AlertTriangle,
  RotateCcw,
  Clock,
  ChevronRight,
  Shield,
  Activity,
  Flame,
  Radio,
  Share2
} from 'lucide-react';
import { api, setToken } from '../lib/api';

export default function Navigation() {
  const pathname = usePathname();
  const [simDate, setSimDate] = useState<string>('2026-11-15T08:00:00.000Z');
  const [alertCount, setAlertCount] = useState<number>(0);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('operations@ncpor.res.in');
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  // Fetch clock, alerts, and demo personas on mount
  const refreshStatus = async () => {
    try {
      const [clockRes, alertRes, usersRes] = await Promise.all([
        api.getClock(),
        api.getAlerts(),
        api.getDemoUsers()
      ]);
      if (clockRes?.data?.simulatedDate) setSimDate(clockRes.data.simulatedDate);
      if (alertRes?.data) setAlertCount(alertRes.data.length);
      if (usersRes?.data) setDemoUsers(usersRes.data);
    } catch (e) {
      console.warn('Status poll warning', e);
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleStepClock = async (days: number) => {
    const res = await api.stepClock(days);
    if (res?.data?.simulatedDate) {
      setSimDate(res.data.simulatedDate);
      refreshStatus();
    }
  };

  const handleResetClock = async () => {
    const res = await api.resetClock();
    if (res?.data?.simulatedDate) {
      setSimDate(res.data.simulatedDate);
      refreshStatus();
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('Reset entire polar operations database to baseline Seed 47 world?')) return;
    setIsResetting(true);
    try {
      await api.resetDatabase();
      await refreshStatus();
      window.location.reload();
    } catch (err) {
      alert('Reset failed: ' + err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleUserChange = async (email: string) => {
    setSelectedUser(email);
    const loginRes = await api.login(email);
    if (loginRes?.data?.token) {
      setToken(loginRes.data.token);
    }
  };

  const navLinks = [
    { label: 'Overview', href: '/', icon: Activity },
    { label: 'Expeditions', href: '/expeditions', icon: Compass },
    { label: 'People & Readiness', href: '/people', icon: Users },
    { label: 'Cargo & Crates', href: '/cargo', icon: Box },
    { label: 'Transport', href: '/transport', icon: Truck },
    { label: 'Station Inventory', href: '/inventory', icon: Layers },
    { label: 'Assets', href: '/assets', icon: Wrench },
    { label: 'Incidents', href: '/incidents', icon: Flame },
    { label: 'Alerts', href: '/alerts', icon: AlertTriangle, badge: alertCount },
    { label: 'Ripple Effect', href: '/ripple', icon: Share2 }
  ];

  const formattedDate = new Date(simDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <header className="sticky top-0 z-50 bg-[#080d1a]/95 backdrop-blur-md border-b border-slate-800/80">
      {/* Top Operational Status Bar */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between border-b border-slate-900/60 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-slate-200 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>MoES / NCPOR OPERATIONAL CONSOLE</span>
          </div>
          <span className="text-slate-700">|</span>
          <span className="hidden sm:inline-flex items-center text-slate-400">
            Stations: <strong className="ml-1 text-slate-200">Bharati</strong> (69°S), <strong className="ml-1 text-slate-200">Maitri</strong> (70°S), <strong className="ml-1 text-slate-200">Himadri</strong> (79°N)
          </span>
        </div>

        {/* Simulation Clock Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Sim Date:</span>
            <span className="text-sky-300 font-semibold">{formattedDate}</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleStepClock(1)}
              title="Step forward +1 day"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
            >
              +1d
            </button>
            <button
              onClick={() => handleStepClock(7)}
              title="Step forward +7 days"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
            >
              +7d
            </button>
            <button
              onClick={() => handleStepClock(30)}
              title="Step forward +30 days"
              className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition"
            >
              +30d
            </button>
            <button
              onClick={handleResetClock}
              title="Reset date to 15 Nov 2026"
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 rounded transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <span className="text-slate-700">|</span>

          {/* User Persona Switcher */}
          <div className="flex items-center space-x-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedUser}
              onChange={(e) => handleUserChange(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-slate-700"
            >
              {demoUsers.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Baseline Seed */}
          <button
            onClick={handleResetDatabase}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-2.5 py-1 bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/50 text-rose-200 rounded text-[11px] font-medium transition"
          >
            <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Resetting...' : 'Reset World'}</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2.5 text-slate-100 hover:text-white font-semibold tracking-tight">
            <div className="w-7 h-7 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-wider leading-none text-slate-100">POLAR-OPS</span>
              <span className="text-[10px] text-slate-400 font-mono tracking-tight leading-tight mt-0.5">NCPOR ISEA-47</span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    active
                      ? 'bg-slate-800/90 text-sky-400 shadow-sm border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded">
            <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
            <span className="text-[11px] font-mono text-slate-300">STARLINK POLAR // NOMINAL</span>
          </div>
        </div>
      </div>
    </header>
  );
}
