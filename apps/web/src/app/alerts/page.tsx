'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Box,
  Layers,
  Users,
  Wrench,
  Clock,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const loadAlerts = async () => {
    try {
      const res = await api.getAlerts();
      if (res?.data) setAlerts(res.data);
    } catch (e) {
      console.error('Failed to load alerts', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filtered = alerts.filter(a => {
    if (filterCategory !== 'ALL' && a.category !== filterCategory) return false;
    return true;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'CARGO': return Box;
      case 'INVENTORY': return Layers;
      case 'PERSONNEL': return Users;
      case 'ASSET': return Wrench;
      case 'SCHEDULE': return Clock;
      default: return AlertTriangle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            <span>Operational Risk & Bottleneck Auditor</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Evaluations flagging deadline violations, station fuel stockouts, unready crew allocations, and single points of failure.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-2xs font-medium"
          >
            <option value="ALL">All Categories ({alerts.length})</option>
            <option value="CARGO">Cargo Deadlines</option>
            <option value="INVENTORY">Inventory Stockouts</option>
            <option value="PERSONNEL">Personnel Readiness</option>
            <option value="SCHEDULE">Seasonal / Helicopter Cutoffs</option>
            <option value="ASSET">Maintenance Overdue</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-2 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">No Operational Bottlenecks Detected</h3>
          <p className="text-xs text-slate-500">All consignments, inventories, crew certifications, and schedules are nominal.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((alt) => {
            const Icon = getCategoryIcon(alt.category);

            return (
              <div
                key={alt.id}
                className={`bg-white border rounded-lg p-5 space-y-3 shadow-xs transition ${
                  alt.severity === 'CRITICAL'
                    ? 'border-l-4 border-l-rose-600 border-slate-200'
                    : 'border-l-4 border-l-amber-500 border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      alt.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {alt.severity}
                    </span>
                    <span className="text-xs text-slate-500 uppercase tracking-wider flex items-center font-medium">
                      <Icon className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {alt.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{alt.title}</h3>
                  </div>

                  <Link
                    href={`/ripple?type=${alt.affectedEntityType}&id=${alt.affectedEntityId}`}
                    className="flex items-center space-x-1 text-xs text-sky-700 hover:text-sky-800 font-semibold self-start sm:self-center"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-0.5" />
                    <span>View Ripple Effect</span>
                  </Link>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{alt.description}</p>

                {/* Suggested Action Box */}
                <div className="bg-slate-50 p-3 rounded-md border border-slate-200 flex items-start space-x-2.5 text-xs">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide shrink-0 mt-0.5">
                    Recommended Action:
                  </span>
                  <span className="text-slate-700">{alt.suggestedAction}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
