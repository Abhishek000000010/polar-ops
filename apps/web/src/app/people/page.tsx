'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  RotateCw,
  Plus,
  ArrowRight,
  Shield,
  AlertTriangle,
  UserCheck,
  Share2,
  Search,
  CheckCircle2,
  XCircle,
  Heart,
  Mountain,
  FileCheck,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../../lib/api';
import ReadinessDonutChart from '../../components/charts/ReadinessDonutChart';

export default function PeoplePage() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTION' | 'CERTIFIED' | 'SPOF'>('ALL');
  const [selectedStation, setSelectedStation] = useState<string>('ALL');

  // Form states
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [currentLocation, setCurrentLocation] = useState('GOA_HQ');
  const [destinationLocation, setDestinationLocation] = useState('BHARATI');
  const [standbyPersonId, setStandbyPersonId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPeople = async () => {
    try {
      const res = await api.getPeople();
      if (res?.data) setPeople(res.data);
    } catch (e) {
      console.error('Failed to load people', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  const handleToggleReadiness = async (personId: string, currentReadiness: any, key: string) => {
    const updated = {
      ...currentReadiness,
      [key]: !currentReadiness[key]
    };
    await api.updateReadiness(personId, updated);
    await loadPeople();
  };

  const handleSwapStandby = async (personId: string, personName: string) => {
    if (!confirm(`Execute One-Click Replacement for ${personName}? This will swap this member with their designated standby across all active missions, transport berths, and field assignments.`)) {
      return;
    }
    setSwappingId(personId);
    try {
      const res = await api.swapStandby(personId, 'Medical Disqualification / Field Ineligibility');
      if (res?.data) {
        alert(`Standby swap executed successfully! ${res.data.affectedMissionsCount} mission(s) transferred to standby.`);
        await loadPeople();
      } else {
        alert(res?.error?.message || 'Failed to swap with standby');
      }
    } catch (err: any) {
      alert('Error during standby swap: ' + err.message);
    } finally {
      setSwappingId(null);
    }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !role) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        role,
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        currentLocation,
        destinationLocation,
        standbyPersonId: standbyPersonId || null,
        readiness: {
          medicalCleared: false,
          auliTrainingCompleted: false,
          passportValid: true,
          polarPermitIssued: false
        }
      };

      const res = await api.createPerson(payload);
      if (res?.data) {
        setShowAddPerson(false);
        setName('');
        setRole('');
        setSkills('');
        setStandbyPersonId('');
        await loadPeople();
      } else {
        alert(res?.error?.message || 'Failed to register person');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getPersonNameById = (id?: string) => {
    if (!id) return null;
    const found = people.find(p => p._id === id);
    return found ? found.name : 'Designated Standby';
  };

  // KPI Computations
  const totalCount = people.length;
  const certifiedCount = people.filter(p =>
    p.readiness.medicalCleared &&
    p.readiness.auliTrainingCompleted &&
    p.readiness.passportValid &&
    p.readiness.polarPermitIssued
  ).length;
  const pendingCount = totalCount - certifiedCount;
  const spofCount = people.filter(p => !p.standbyPersonId).length;

  // Filtered Crew
  const filteredPeople = people.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchRole = p.role.toLowerCase().includes(q);
      const matchSkill = p.skills?.some((s: string) => s.toLowerCase().includes(q));
      if (!matchName && !matchRole && !matchSkill) return false;
    }

    if (selectedStation !== 'ALL') {
      if (p.currentLocation !== selectedStation && p.destinationLocation !== selectedStation) {
        return false;
      }
    }

    const isFullyReady = p.readiness.medicalCleared &&
                         p.readiness.auliTrainingCompleted &&
                         p.readiness.passportValid &&
                         p.readiness.polarPermitIssued;

    if (filterTab === 'CERTIFIED' && !isFullyReady) return false;
    if (filterTab === 'ACTION' && isFullyReady) return false;
    if (filterTab === 'SPOF' && p.standbyPersonId) return false;

    return true;
  });

  const getInitials = (fullName: string) => {
    const parts = fullName.replace('Dr. ', '').split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (idx: number) => {
    const colors = [
      'bg-sky-100 text-sky-700 border-sky-200',
      'bg-emerald-100 text-emerald-700 border-emerald-200',
      'bg-indigo-100 text-indigo-700 border-indigo-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-purple-100 text-purple-700 border-purple-200',
      'bg-rose-100 text-rose-700 border-rose-200'
    ];
    return colors[idx % colors.length];
  };

  return (
    <div className="space-y-6 max-w-[1550px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200/80 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>ISEA-47 Polar Operations · Human Resources & Safety</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Users className="w-7 h-7 text-emerald-600" />
            <span>Personnel & Readiness Command</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor 4-tier mandatory polar clearances, track station crew deployment, and execute 1-click standby replacements.
          </p>
        </div>

        <button
          onClick={() => setShowAddPerson(!showAddPerson)}
          className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm shadow-emerald-600/20 active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddPerson ? 'Close Form' : 'Enroll Team Member'}</span>
        </button>
      </div>

      {/* 4 Sleek KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Crew */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expedition Crew</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{totalCount}</span>
            <span className="text-xs text-slate-500 font-medium">scientists & engineers</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Winter-over: <strong>4</strong></span>
            <span>Summer window: <strong>3</strong></span>
          </div>
        </div>

        {/* Metric 2: Fully Polar Certified */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fully Certified</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-700 tabular-nums">{certifiedCount}</span>
            <span className="text-xs text-slate-500 font-medium">of {totalCount} crew cleared</span>
          </div>
          {/* Visual Progress Bar */}
          <div className="mt-3">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${totalCount ? (certifiedCount / totalCount) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex justify-between">
              <span>{Math.round(totalCount ? (certifiedCount / totalCount) * 100 : 0)}% ready</span>
              <span>All 4 gates passed</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Pending Readiness */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Action Required</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-amber-700 tabular-nums">{pendingCount}</span>
            <span className="text-xs text-slate-500 font-medium">pending medical / permit</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>AIIMS Medical: <strong>1 pending</strong></span>
            <span>MoES Permit: <strong>1 awaited</strong></span>
          </div>
        </div>

        {/* Metric 4: Standby Redundancy & SPOF */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Standby Coverage</span>
            <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-700 tabular-nums">{spofCount}</span>
            <span className="text-xs text-slate-500 font-medium">SPOF risks without backup</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-rose-600 font-medium">5 roles lack reserve standby</span>
            <span className="text-emerald-700 font-semibold">{totalCount - spofCount} paired</span>
          </div>
        </div>
      </div>

      {/* Interactive 4-Tier Readiness Donut & Gate Compliance Analytics */}
      <ReadinessDonutChart people={people} />

      {/* Add Person Drawer / Form */}
      {showAddPerson && (
        <form onSubmit={handleCreatePerson} className="bg-white border-2 border-emerald-500/30 rounded-xl p-6 shadow-elevated space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Enroll Expedition Member</h3>
              <p className="text-xs text-slate-500">Add crew member to roster and link to designated reserve standby.</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              Mandatory Standby Protocol
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Dr. Rajeshwari Rao"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Role / Specialization</label>
              <input
                type="text"
                placeholder="e.g. Cryosphere Geophysicist"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Skills (comma separated)</label>
              <input
                type="text"
                placeholder="e.g. Ground Penetrating Radar, GPS, Ice Coring"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Current Location</label>
              <select
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
              >
                <option value="GOA_HQ">NCPOR Goa HQ</option>
                <option value="CAPE_TOWN">Cape Town Gateway</option>
                <option value="EN_ROUTE_VESSEL">At Sea (MV Vasily Golovnin)</option>
                <option value="BHARATI">Bharati Station</option>
                <option value="MAITRI">Maitri Station</option>
                <option value="HIMADRI">Himadri (Arctic)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Assigned Destination</label>
              <select
                value={destinationLocation}
                onChange={(e) => setDestinationLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
              >
                <option value="BHARATI">Bharati Station</option>
                <option value="MAITRI">Maitri Station</option>
                <option value="HIMADRI">Himadri (Arctic)</option>
                <option value="CAPE_TOWN">Cape Town (Logistics)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Link Standby Member</label>
              <select
                value={standbyPersonId}
                onChange={(e) => setStandbyPersonId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
              >
                <option value="">-- No Standby Designated (SPOF Risk) --</option>
                {people.map(p => (
                  <option key={p._id} value={p._id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAddPerson(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              {submitting ? 'Registering...' : 'Enroll Member & Link Standby'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-3 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Crew ({totalCount})
          </button>
          <button
            onClick={() => setFilterTab('ACTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterTab === 'ACTION'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            Action Required ({pendingCount})
          </button>
          <button
            onClick={() => setFilterTab('CERTIFIED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterTab === 'CERTIFIED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Fully Certified ({certifiedCount})
          </button>
          <button
            onClick={() => setFilterTab('SPOF')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
              filterTab === 'SPOF'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            SPOF Unprotected ({spofCount})
          </button>
        </div>

        {/* Search & Location Filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member, role, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium"
            />
          </div>

          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="bg-slate-50 border border-slate-200/90 text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Stations</option>
            <option value="BHARATI">Bharati</option>
            <option value="MAITRI">Maitri</option>
            <option value="CAPE_TOWN">Cape Town</option>
            <option value="GOA_HQ">Goa HQ</option>
          </select>
        </div>
      </div>

      {/* Clean Elevated Roster Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Expedition Roster & Clearance Register
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
              {filteredPeople.length}
            </span>
          </div>
          <span className="text-xs text-slate-500">Click any gate badge to toggle clearance certification</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Crew Member & Role</th>
                <th className="py-3.5 px-4">Deployment Sector</th>
                <th className="py-3.5 px-4">4-Tier Polar Clearance Gates</th>
                <th className="py-3.5 px-4">Designated Standby</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPeople.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No crew members match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPeople.map((p, idx) => {
                  const isFullyReady = p.readiness.medicalCleared &&
                                       p.readiness.auliTrainingCompleted &&
                                       p.readiness.passportValid &&
                                       p.readiness.polarPermitIssued;

                  const clearedGatesCount = [
                    p.readiness.medicalCleared,
                    p.readiness.auliTrainingCompleted,
                    p.readiness.passportValid,
                    p.readiness.polarPermitIssued
                  ].filter(Boolean).length;

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Member Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-start space-x-3">
                          <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${getAvatarColor(idx)}`}>
                            {getInitials(p.name)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm hover:text-sky-600 transition-colors">
                                {p.name}
                              </span>
                              {isFullyReady ? (
                                <span title="Polar Certified (All 4 gates passed)" className="inline-flex text-emerald-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                </span>
                              ) : (
                                <span title="Pending Polar Gates" className="inline-flex text-amber-600">
                                  <AlertTriangle className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 font-medium mt-0.5">{p.role}</div>
                            {p.skills?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {p.skills.map((s: string, sIdx: number) => (
                                  <span key={sIdx} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium border border-slate-200/60">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Location & Sector */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-1">
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200/90 rounded-md text-xs font-semibold text-slate-700">
                            <span>{p.currentLocation}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-sky-700 font-bold">{p.destinationLocation}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            Assigned to: {p.destinationLocation} Station
                          </div>
                        </div>
                      </td>

                      {/* 4-Tier Interactive Readiness Gates */}
                      <td className="py-4 px-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            {/* Medical Gate */}
                            <button
                              onClick={() => handleToggleReadiness(p._id, p.readiness, 'medicalCleared')}
                              title="AIIMS Medical Clearance (Click to toggle)"
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer ${
                                p.readiness.medicalCleared
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <Heart className="w-3 h-3" />
                              <span>{p.readiness.medicalCleared ? 'Medical OK' : 'Medical Due'}</span>
                            </button>

                            {/* Auli Training Gate */}
                            <button
                              onClick={() => handleToggleReadiness(p._id, p.readiness, 'auliTrainingCompleted')}
                              title="ITBP Auli Snow Acclimatization (Click to toggle)"
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer ${
                                p.readiness.auliTrainingCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <Mountain className="w-3 h-3" />
                              <span>{p.readiness.auliTrainingCompleted ? 'Auli Pass' : 'Auli Due'}</span>
                            </button>

                            {/* Passport Gate */}
                            <button
                              onClick={() => handleToggleReadiness(p._id, p.readiness, 'passportValid')}
                              title="Diplomatic / Official Passport Validity (Click to toggle)"
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer ${
                                p.readiness.passportValid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>{p.readiness.passportValid ? 'Passport OK' : 'Expired'}</span>
                            </button>

                            {/* MoES Permit Gate */}
                            <button
                              onClick={() => handleToggleReadiness(p._id, p.readiness, 'polarPermitIssued')}
                              title="MoES Antarctic Protected Area Permit (Click to toggle)"
                              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition shadow-2xs cursor-pointer ${
                                p.readiness.polarPermitIssued
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{p.readiness.polarPermitIssued ? 'MoES Permit' : 'Awaited'}</span>
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              clearedGatesCount === 4
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {clearedGatesCount}/4 Gates Cleared
                            </span>
                            {!isFullyReady && (
                              <span className="text-[11px] text-amber-700 font-medium">
                                Ineligible for departure until cleared
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Standby Member */}
                      <td className="py-4 px-4 align-top">
                        {p.standbyPersonId ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5 text-slate-800 font-semibold text-xs">
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                              <span>{getPersonNameById(p.standbyPersonId)}</span>
                            </div>
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              Redundant Pairing Verified
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mr-1" />
                              NO STANDBY (SPOF)
                            </span>
                            <div className="text-[11px] text-rose-600 font-medium">
                              Mission blocks if member fails
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right align-top">
                        <div className="flex items-center justify-end space-x-2">
                          {p.standbyPersonId && (
                            <button
                              onClick={() => handleSwapStandby(p._id, p.name)}
                              disabled={swappingId === p._id}
                              title="Execute One-Click Standby Swap across all missions & itineraries"
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${swappingId === p._id ? 'animate-spin' : ''}`} />
                              <span>1-Click Swap</span>
                            </button>
                          )}
                          <Link
                            href={`/ripple?type=PERSON&id=${p._id}`}
                            title="Inspect Mission Dependencies"
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-sky-600 transition-colors border border-transparent hover:border-slate-200"
                          >
                            <Share2 className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
