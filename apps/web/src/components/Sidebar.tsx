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
  Activity,
  Flame,
  Share2,
  SlidersHorizontal,
  Shield,
  Radio,
  Snowflake,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
export default function Sidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState<number>(0);
  const { email: selectedUser, setPersona: handleUserChange, demoUsers, role } = useAuth();

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [alertRes] = await Promise.all([
          api.getAlerts()
        ]);
        if (alertRes?.data) setAlertCount(alertRes.data.length);
      } catch (e) {
        console.warn('Sidebar meta poll error', e);
      }
    };
    fetchMeta();
    const interval = setInterval(fetchMeta, 8000);
    return () => clearInterval(interval);
  }, []);

  const navSections = [
    {
      title: 'OPERATIONS',
      links: [
        { label: 'Command Center', href: '/overview', icon: Activity, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER', 'SCIENTIST'] },
        { label: 'Expeditions & Missions', href: '/expeditions', icon: Compass, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER', 'SCIENTIST'] },
        { label: 'Personnel & Readiness', href: '/people', icon: Users, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER'] },
        { label: 'Cargo & Crates', href: '/cargo', icon: Box, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER', 'SCIENTIST'] },
        { label: 'Transport Fleet', href: '/transport', icon: Truck, roles: ['ADMIN', 'LOGISTICS_OFFICER'] },
      ]
    },
    {
      title: 'STATION ASSETS',
      links: [
        { label: 'Station Inventory', href: '/inventory', icon: Layers, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER'] },
        { label: 'Assets & Spares', href: '/assets', icon: Wrench, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER'] },
      ]
    },
    {
      title: 'INTELLIGENCE & RISK',
      links: [
        { label: 'Incidents & Log', href: '/incidents', icon: Flame, roles: ['ADMIN', 'STATION_LEADER'] },
        { label: 'Risk Bottlenecks', href: '/alerts', icon: AlertTriangle, badge: alertCount, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER'] },
        { label: 'What-If Simulator', href: '/simulator', icon: SlidersHorizontal, badgeText: 'Sandbox', roles: ['ADMIN'] },
        { label: 'Blast Radius Graph', href: '/ripple', icon: Share2, roles: ['ADMIN', 'LOGISTICS_OFFICER', 'STATION_LEADER'] },
        { label: 'Satellite Edge Sync', href: '/sync', icon: Radio, badgeText: 'Mesh', roles: ['ADMIN'] },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/90 flex flex-col justify-between h-screen sticky top-0 shrink-0 z-40 select-none shadow-[1px_0_3px_rgba(0,0,0,0.02)]">
      {/* Top Brand Header */}
      <div className="flex flex-col">
        <div className="p-5 border-b border-slate-100">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Snowflake className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                POLAR-OPS
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-700 font-semibold">v1.2</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                NCPOR · MoES India
              </div>
            </div>
          </Link>

          {/* Active Expedition Pill */}
          <div className="mt-3.5 bg-slate-50 rounded-lg p-2 border border-slate-200/70 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-semibold text-slate-800 text-[11px]">47th Antarctic Season</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">2026–27</span>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="p-3.5 space-y-5 overflow-y-auto max-h-[calc(100vh-235px)]">
          {navSections.map((sec) => {
            const visibleLinks = sec.links.filter(link => link.roles.includes(role));
            if (visibleLinks.length === 0) return null;
            return (
              <div key={sec.title}>
                <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {sec.title}
                </div>
                <div className="space-y-0.5">
                  {visibleLinks.map((item: any) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          active
                            ? 'bg-sky-50 text-sky-700 font-semibold border-l-[3px] border-sky-600 rounded-l-none'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <Icon className={`w-4 h-4 ${active ? 'text-sky-600' : 'text-slate-400'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            {item.badge}
                          </span>
                        )}
                        {item.badgeText && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                            {item.badgeText}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Persona & Connection Footer */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
        {/* User Persona Switcher */}
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Shield className="w-3 h-3 text-slate-400" />
            Active Role
          </label>
          <div className="relative">
            <select
              value={selectedUser}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200/90 text-slate-800 text-xs font-medium rounded-lg px-2.5 py-2 pr-7 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs cursor-pointer"
            >
              {demoUsers.map((u) => (
                <option key={u.email} value={u.email}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Station Telemetry Link */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
            <span>Starlink Polar Link</span>
          </div>
          <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
            42ms · Nominal
          </span>
        </div>
      </div>
    </aside>
  );
}
