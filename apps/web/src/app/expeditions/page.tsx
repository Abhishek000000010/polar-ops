'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Plus,
  Activity,
  Users,
  Box,
  Wrench,
  Share2
} from 'lucide-react';
import { api } from '../../lib/api';
import MissionResourceChart from '../../components/charts/MissionResourceChart';

export default function ExpeditionsPage() {
  const [expeditions, setExpeditions] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [crates, setCrates] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddMission, setShowAddMission] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [station, setStation] = useState('BHARATI');
  const [startDate, setStartDate] = useState('2026-12-01');
  const [endDate, setEndDate] = useState('2027-01-15');
  const [priority, setPriority] = useState(2);
  const [helicopterNeeded, setHelicopterNeeded] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedCrates, setSelectedCrates] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [expRes, misRes, peoRes, crtRes, astRes] = await Promise.all([
        api.getExpeditions(),
        api.getMissions(),
        api.getPeople(),
        api.getCrates(),
        api.getAssets()
      ]);
      if (expRes?.data) setExpeditions(expRes.data);
      if (misRes?.data) setMissions(misRes.data);
      if (peoRes?.data) setPeople(peoRes.data);
      if (crtRes?.data) setCrates(crtRes.data);
      if (astRes?.data) setAssets(astRes.data);
    } catch (e) {
      console.error('Error fetching expeditions & missions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !code) return;
    setSubmitting(true);
    try {
      const activeExp = expeditions[0];
      const payload = {
        expeditionId: activeExp?._id || 'exp-01',
        code: code.toUpperCase(),
        title,
        station,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        priority: Number(priority),
        helicopterNeeded,
        peopleIds: selectedPeople,
        crateIds: selectedCrates,
        assetIds: selectedAssets,
        status: 'PLANNED'
      };

      const res = await api.createMission(payload);
      if (res?.data) {
        setShowAddMission(false);
        setTitle('');
        setCode('');
        setSelectedPeople([]);
        setSelectedCrates([]);
        setSelectedAssets([]);
        await loadData();
      } else {
        alert(res?.error?.message || 'Failed to create mission');
      }
    } catch (err: any) {
      alert('Error creating mission: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Compass className="w-6 h-6 text-sky-600" />
            <span>Expeditions & Scientific Missions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Season schedules, station deployments, priorities, and cross-cutting resource allocations.
          </p>
        </div>

        <button
          onClick={() => setShowAddMission(!showAddMission)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddMission ? 'Cancel' : 'Plan New Mission'}</span>
        </button>
      </div>

      {/* Active Expedition Card */}
      {expeditions.map((exp) => (
        <div key={exp._id} className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-xs px-2.5 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">
                  {exp.code}
                </span>
                <h2 className="text-lg font-bold text-slate-900">{exp.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {exp.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 max-w-3xl leading-relaxed">{exp.description}</p>
            </div>

            <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-md border border-slate-200 shrink-0">
              <div>Season: <strong className="text-slate-900">{exp.season}</strong></div>
              <div>Leader: <strong className="text-slate-900">{exp.leaderName}</strong></div>
              <div>Window: {exp.startDate.split('T')[0]} to {exp.endDate.split('T')[0]}</div>
            </div>
          </div>
        </div>
      ))}

      {/* Add Mission Form Drawer */}
      {showAddMission && (
        <form onSubmit={handleCreateMission} className="bg-white border border-sky-200 rounded-lg p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Plan New Scientific or Logistics Mission</h3>
            <span className="text-xs text-sky-700 font-medium">Automatic Graph Dependency Linking</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Mission Code</label>
              <input
                type="text"
                placeholder="e.g. MSN-GEOPHYS-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-semibold mb-1">Mission Title</label>
              <input
                type="text"
                placeholder="e.g. Sub-glacial lake acoustic radar sounding"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Station</label>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="BHARATI">Bharati (Larsemann Hills)</option>
                <option value="MAITRI">Maitri (Schirmacher Oasis)</option>
                <option value="HIMADRI">Himadri (Ny-Ålesund, Arctic)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value={1}>Priority 1 - Critical Science</option>
                <option value={2}>Priority 2 - High Objective</option>
                <option value={3}>Priority 3 - Routine Observation</option>
                <option value={4}>Priority 4 - Secondary</option>
                <option value={5}>Priority 5 - Opportunistic</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1 text-xs">
            <input
              type="checkbox"
              id="heloCheck"
              checked={helicopterNeeded}
              onChange={(e) => setHelicopterNeeded(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="heloCheck" className="text-slate-700 font-medium">
              Requires Ship-Borne Helicopter Support (Note: Ka-32 helicopters depart in March with vessel)
            </label>
          </div>

          {/* Allocation of People, Crates and Assets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Allocate Personnel ({selectedPeople.length} selected)</label>
              <select
                multiple
                value={selectedPeople}
                onChange={(e) => setSelectedPeople(Array.from(e.target.selectedOptions, o => o.value))}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 h-28 text-xs focus:ring-1 focus:ring-sky-500"
              >
                {people.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Required Crates ({selectedCrates.length} selected)</label>
              <select
                multiple
                value={selectedCrates}
                onChange={(e) => setSelectedCrates(Array.from(e.target.selectedOptions, o => o.value))}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 h-28 text-xs focus:ring-1 focus:ring-sky-500"
              >
                {crates.map(c => (
                  <option key={c._id} value={c._id}>{c.crateCode} - {c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Required Assets ({selectedAssets.length} selected)</label>
              <select
                multiple
                value={selectedAssets}
                onChange={(e) => setSelectedAssets(Array.from(e.target.selectedOptions, o => o.value))}
                className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-900 h-28 text-xs focus:ring-1 focus:ring-sky-500"
              >
                {assets.map(a => (
                  <option key={a._id} value={a._id}>{a.assetCode} ({a.name})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddMission(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
            >
              {submitting ? 'Saving...' : 'Create Mission & Link Graph'}
            </button>
          </div>
        </form>
      )}

      {/* Scientific Mission Resource Footprint Chart */}
      <MissionResourceChart missions={missions} />

      {/* Missions Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Registered Scientific & Logistics Missions ({missions.length})
          </h2>
          <span className="text-xs text-slate-500">Chronological schedule</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Code / Title</th>
                <th className="py-3 px-3">Station</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Window</th>
                <th className="py-3 px-3">Helo</th>
                <th className="py-3 px-3">Allocated Resources</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Ripple</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {missions.map((m) => (
                <tr key={m._id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <span className="text-sky-700 font-bold text-xs block">{m.code}</span>
                    <span className="font-semibold text-slate-900 text-xs">{m.title}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-slate-700 font-medium">{m.station}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      m.priority === 1 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      m.priority === 2 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      P{m.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-xs">
                    {m.startDate.split('T')[0]} → {m.endDate.split('T')[0]}
                  </td>
                  <td className="py-3 px-3">
                    {m.helicopterNeeded ? (
                      <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium text-xs">
                        Required
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">Ground</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-700">
                    <div className="flex items-center space-x-3">
                      <span title="People" className="flex items-center"><Users className="w-3.5 h-3.5 text-slate-400 mr-1" />{m.peopleIds?.length || 0}</span>
                      <span title="Crates" className="flex items-center"><Box className="w-3.5 h-3.5 text-slate-400 mr-1" />{m.crateIds?.length || 0}</span>
                      <span title="Assets" className="flex items-center"><Wrench className="w-3.5 h-3.5 text-slate-400 mr-1" />{m.assetIds?.length || 0}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/ripple?type=MISSION&id=${m._id}`}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-sky-700 border border-slate-200 rounded text-xs font-semibold transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Trace</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
