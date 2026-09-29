'use client';

import React, { useEffect, useState } from 'react';
import {
  Flame,
  Plus,
  Send
} from 'lucide-react';
import { api } from '../../lib/api';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New incident state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Bharati Station Environs');
  const [severity, setSeverity] = useState('HIGH');
  const [submitting, setSubmitting] = useState(false);

  // Action log state
  const [actionInputs, setActionInputs] = useState<Record<string, string>>({});

  const loadData = async () => {
    try {
      const res = await api.getIncidents();
      if (res?.data) setIncidents(res.data);
    } catch (e) {
      console.error('Failed to load incidents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    try {
      const payload = {
        incidentCode: `INC-2026-0${incidents.length + 1}`,
        title,
        description,
        location,
        severity,
        actionsTaken: [`[Logged] Initial report logged to Polar Operations Centre`],
        status: 'OPEN'
      };
      const res = await api.createIncident(payload);
      if (res?.data) {
        setShowAddModal(false);
        setTitle('');
        setDescription('');
        await loadData();
      }
    } catch (err: any) {
      alert('Error logging incident: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAction = async (id: string) => {
    const text = actionInputs[id];
    if (!text) return;
    try {
      await api.addIncidentAction(id, text);
      setActionInputs(prev => ({ ...prev, [id]: '' }));
      await loadData();
    } catch (err: any) {
      alert('Failed to append action: ' + err.message);
    }
  };

  const handleCloseIncident = async (id: string, code: string) => {
    const summary = prompt(`Enter resolution summary to close incident ${code}:`, 'Issue investigated, safety protocol completed and resolved.');
    if (!summary) return;
    try {
      await api.closeIncident(id, summary);
      await loadData();
    } catch (err: any) {
      alert('Failed to close incident: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Flame className="w-6 h-6 text-rose-600" />
            <span>Emergency & Incident Management Command</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracking severe blizzard whiteout warnings, customs holds, crevasse hazards, and mitigation log.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Log New Incident</span>
        </button>
      </div>

      {/* Incidents Feed */}
      <div className="space-y-4">
        {incidents.map((inc) => {
          const isOpen = inc.status === 'OPEN' || inc.status === 'INVESTIGATING';

          return (
            <div key={inc._id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    inc.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    inc.severity === 'HIGH' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {inc.severity}
                  </span>
                  <span className="text-xs text-sky-700 font-bold">{inc.incidentCode}</span>
                  <h3 className="text-base font-bold text-slate-900">{inc.title}</h3>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                    isOpen ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {inc.status}
                  </span>
                  {isOpen && (
                    <button
                      onClick={() => handleCloseIncident(inc._id, inc.incidentCode)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-md text-xs font-semibold transition shadow-2xs"
                    >
                      Resolve & Close
                    </button>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <p>{inc.description}</p>
                <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 pt-1">
                  <span>Location: <strong className="text-slate-800">{inc.location}</strong></span>
                  <span>Reported by: <strong className="text-slate-800">{inc.reportedBy}</strong></span>
                  <span>Opened: {new Date(inc.openedAt).toLocaleDateString('en-GB')}</span>
                  {inc.closedAt && <span className="text-emerald-700 font-medium">Closed: {new Date(inc.closedAt).toLocaleDateString('en-GB')}</span>}
                </div>
              </div>

              {/* Action Log entries */}
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-2.5">
                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide block">
                  Action Trail ({inc.actionsTaken?.length || 0})
                </span>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {inc.actionsTaken?.map((action: string, idx: number) => (
                    <div key={idx} className="flex items-start space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600 mt-1.5 shrink-0"></span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>

                {/* Add Action Input */}
                {isOpen && (
                  <div className="pt-2 flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Append operational response action..."
                      value={actionInputs[inc._id] || ''}
                      onChange={(e) => setActionInputs({ ...actionInputs, [inc._id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddAction(inc._id); }}
                      className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      onClick={() => handleAddAction(inc._id)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Incident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateIncident} className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Log New Operational Incident</h3>
              <p className="text-xs text-slate-500 mt-0.5">Records to real-time operations event stream</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Incident Headline</label>
                <input
                  type="text"
                  placeholder="e.g. Whiteout Blizzard Condition at Camp Delta"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="CRITICAL">Critical (Life/Station Threat)</option>
                    <option value="HIGH">High (Mission / Safety Risk)</option>
                    <option value="MEDIUM">Medium (Logistics Delay)</option>
                    <option value="LOW">Low (Observation)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Location Coordinates / Sector</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Detailed Description & Assessment</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="State the observed conditions, affected teams, and immediate safety measures taken."
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
              >
                {submitting ? 'Logging...' : 'Broadcast Incident'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
