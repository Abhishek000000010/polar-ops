'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Box,
  Plus,
  Flame,
  Share2,
  FastForward,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import CargoFlowChart from '../../components/charts/CargoFlowChart';

export default function CargoPage() {
  const [crates, setCrates] = useState<any[]>([]);
  const [transports, setTransports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCrate, setShowAddCrate] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // Form states
  const [crateCode, setCrateCode] = useState('');
  const [title, setTitle] = useState('');
  const [weightKg, setWeightKg] = useState(150);
  const [destinationStation, setDestinationStation] = useState('BHARATI');
  const [requiredByDate, setRequiredByDate] = useState('2026-12-05');
  const [hazardous, setHazardous] = useState(false);
  const [hazardClass, setHazardClass] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reassign Modal State
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean;
    crateId: string;
    crateCode: string;
    crateTitle: string;
    carrierTransportId: string;
    carrierLoadStop: number;
    carrierUnloadStop: number;
  }>({
    isOpen: false,
    crateId: '',
    crateCode: '',
    crateTitle: '',
    carrierTransportId: '',
    carrierLoadStop: 1,
    carrierUnloadStop: 2
  });
  const [submittingReassign, setSubmittingReassign] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [crtRes, trnRes] = await Promise.all([
        api.getCrates(),
        api.getTransport()
      ]);
      if (crtRes?.data) setCrates(crtRes.data);
      if (trnRes?.data) setTransports(trnRes.data);
    } catch (e) {
      console.error('Failed to load cargo data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdvanceStage = async (id: string, code: string) => {
    setAdvancingId(id);
    try {
      const res = await api.advanceCrate(id);
      if (res?.data) {
        await loadData();
      } else {
        alert(res?.error?.message || 'Failed to advance crate stage');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setAdvancingId(null);
    }
  };

  const handleOpenReassignModal = (crate: any) => {
    setReassignModal({
      isOpen: true,
      crateId: crate._id,
      crateCode: crate.crateCode,
      crateTitle: crate.title,
      carrierTransportId: crate.carrierTransportId || (transports[0]?._id || ''),
      carrierLoadStop: crate.carrierLoadStop || 1,
      carrierUnloadStop: crate.carrierUnloadStop || 2
    });
  };

  const handleSubmitReassignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal.crateId || !reassignModal.carrierTransportId) return;

    setSubmittingReassign(true);
    try {
      const res = await api.updateCrate(reassignModal.crateId, {
        carrierTransportId: reassignModal.carrierTransportId,
        carrierLoadStop: Number(reassignModal.carrierLoadStop),
        carrierUnloadStop: Number(reassignModal.carrierUnloadStop)
      });

      if (res?.data) {
        const trn = transports.find(t => t._id === reassignModal.carrierTransportId);
        setToastMessage(`Reassigned ${reassignModal.crateCode} to ${trn?.name || 'new transport carrier'}. Dependency link updated.`);
        setReassignModal(prev => ({ ...prev, isOpen: false }));
        await loadData();
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        alert(res?.error?.message || 'Failed to reassign carrier');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingReassign(false);
    }
  };

  const handleCreateCrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crateCode || !title) return;
    setSubmitting(true);
    try {
      const payload = {
        crateCode: crateCode.toUpperCase(),
        title,
        weightKg: Number(weightKg),
        dimensionsCm: { length: 120, width: 80, height: 80 },
        hazardous,
        hazardClass: hazardous ? (hazardClass || 'Class 9 Miscellaneous') : undefined,
        destinationStation,
        requiredByDate: new Date(requiredByDate).toISOString()
      };

      const res = await api.createCrate(payload);
      if (res?.data) {
        setShowAddCrate(false);
        setCrateCode('');
        setTitle('');
        setHazardous(false);
        setHazardClass('');
        await loadData();
      } else {
        alert(res?.error?.message || 'Failed to create crate');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
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
            <Box className="w-6 h-6 text-indigo-600" />
            <span>Cargo & Multi-Leg Crate Lifeline</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracking intermodal transit: Goa Hub → Mumbai Port → Cape Town Consolidation → Polar Vessel → Antarctic Stations.
          </p>
        </div>

        <button
          onClick={() => setShowAddCrate(!showAddCrate)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddCrate ? 'Cancel' : 'Manifest New Crate'}</span>
        </button>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Crate Drawer */}
      {showAddCrate && (
        <form onSubmit={handleCreateCrate} className="bg-white border border-indigo-200 rounded-lg p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Manifest Consignment Crate</h3>
            <span className="text-xs text-indigo-700 font-medium">Automatic Multi-Stage Route Generation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Crate Code</label>
              <input
                type="text"
                placeholder="e.g. CRT-2026-055"
                value={crateCode}
                onChange={(e) => setCrateCode(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-semibold mb-1">Crate Description / Equipment Name</label>
              <input
                type="text"
                placeholder="e.g. Seismic Geophone Array Pre-Amplifiers"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Gross Weight (kg)</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                required
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Destination Station</label>
              <select
                value={destinationStation}
                onChange={(e) => setDestinationStation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="BHARATI">Bharati Station</option>
                <option value="MAITRI">Maitri Station</option>
                <option value="HIMADRI">Himadri (Arctic)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Required By Date</label>
              <input
                type="date"
                value={requiredByDate}
                onChange={(e) => setRequiredByDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Dangerous Goods</label>
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="hazCheck"
                  checked={hazardous}
                  onChange={(e) => setHazardous(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="hazCheck" className="text-slate-700 font-medium">
                  IMO Dangerous Goods
                </label>
              </div>
            </div>
          </div>

          {hazardous && (
            <div className="text-xs">
              <label className="block text-rose-700 font-semibold mb-1">DG Hazard Classification & UN Number</label>
              <input
                type="text"
                placeholder="e.g. Class 3 Flammable Liquid UN1863 or Class 9 Lithium UN3480"
                value={hazardClass}
                onChange={(e) => setHazardClass(e.target.value)}
                className="w-full bg-white border border-rose-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={() => setShowAddCrate(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              {submitting ? 'Manifesting...' : 'Register Crate'}
            </button>
          </div>
        </form>
      )}

      {/* Intermodal Cargo Flow Pipeline Chart */}
      <CargoFlowChart crates={crates} />

      {/* Crates Cards / Multi-Leg Visualizer */}
      <div className="space-y-4">
        {crates.map((crate) => {
          const currentStage = crate.route[crate.currentStageIndex];
          const carrier = transports.find(t => t._id === crate.carrierTransportId);
          const reqTime = new Date(crate.requiredByDate).getTime();
          const etaTime = crate.eta ? new Date(crate.eta).getTime() : null;
          const isLate = etaTime && etaTime > reqTime;
          const bufferDays = etaTime ? (reqTime - etaTime) / 86400000 : null;

          return (
            <div key={crate._id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              {/* Crate Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                      {crate.crateCode}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{crate.title}</h3>

                    {crate.hazardous && (
                      <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{crate.hazardClass || 'HAZARDOUS'}</span>
                      </span>
                    )}

                    {crate.missedConnection && (
                      <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-600 text-white animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>MISSED CONNECTION</span>
                      </span>
                    )}

                    {isLate && !crate.missedConnection && (
                      <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>LATE (Deadline Breached)</span>
                      </span>
                    )}

                    {bufferDays !== null && bufferDays >= 0 && bufferDays < 3 && !crate.missedConnection && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                        Tight Buffer ({Math.round(bufferDays * 10) / 10}d)
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Weight: <strong className="text-slate-800">{crate.weightKg} kg</strong></span>
                    <span>Destination: <strong className="text-sky-700 font-semibold">{crate.destinationStation}</strong></span>
                    <span>Required By: <strong className="text-amber-800 font-semibold">{crate.requiredByDate.split('T')[0]}</strong></span>
                    {crate.eta && (
                      <span>
                        Projected ETA: <strong className={isLate ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                          {crate.eta.split('T')[0]}
                        </strong>
                      </span>
                    )}
                    {carrier && (
                      <span>Carrier: <strong className="text-slate-800">{carrier.name}</strong></span>
                    )}
                    {crate.storageConditions && <span>Storage: {crate.storageConditions}</span>}
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
                  {crate.status !== 'RECEIVED_STATION' && (
                    <button
                      onClick={() => handleAdvanceStage(crate._id, crate.crateCode)}
                      disabled={advancingId === crate._id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-sky-700 border border-slate-200 rounded-md text-xs font-semibold transition shadow-2xs cursor-pointer"
                    >
                      <FastForward className={`w-3.5 h-3.5 ${advancingId === crate._id ? 'animate-spin' : ''}`} />
                      <span>Advance Stage</span>
                    </button>
                  )}

                  {crate.status !== 'RECEIVED_STATION' && (
                    <button
                      onClick={() => handleOpenReassignModal(crate)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold transition cursor-pointer"
                      title="Reassign transport carrier and flight/ship connection"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Reassign Carrier</span>
                    </button>
                  )}

                  <Link
                    href={`/ripple?type=CARGO&id=${crate._id}`}
                    title="Inspect Mission Dependencies"
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Ripple</span>
                  </Link>
                </div>
              </div>

              {/* Multi-Leg Stage Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Current Leg: <strong className="text-slate-800 font-semibold">{currentStage?.stage}</strong> ({currentStage?.locationName})</span>
                  <span className="uppercase text-sky-700 font-bold text-xs">{crate.status.replace('_', ' ')}</span>
                </div>

                <div className="grid grid-cols-5 gap-2.5 pt-2">
                  {crate.route.map((leg: any, idx: number) => {
                    const isDone = leg.status === 'COMPLETED';
                    const isCurrent = leg.status === 'IN_PROGRESS' || idx === crate.currentStageIndex;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-md border text-xs space-y-1 transition ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : isCurrent
                            ? 'bg-sky-50 border-sky-300 text-sky-900 ring-1 ring-sky-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px]">0{idx + 1}</span>
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : isCurrent ? (
                            <Clock className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          )}
                        </div>
                        <div className="font-semibold truncate">{leg.stage}</div>
                        <div className="text-[10px] truncate opacity-80">{leg.locationName}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* History Trail Accordion / Preview */}
              {crate.history?.length > 0 && (
                <div className="border-t border-slate-100 pt-2.5 text-xs text-slate-500 flex items-center justify-between">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-slate-400 font-medium">Latest Event:</span>
                    <span className="text-slate-800 font-medium">
                      [{crate.history[crate.history.length - 1].action}] at {crate.history[crate.history.length - 1].location}
                    </span>
                    <span className="text-slate-400">
                      ({new Date(crate.history[crate.history.length - 1].timestamp).toLocaleDateString('en-GB')})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{crate.history.length} logged checkpoints</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reassign Carrier Modal */}
      {reassignModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <ArrowRightLeft className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Reassign Transport Carrier</h3>
              </div>
              <button
                onClick={() => setReassignModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reassign <strong className="text-slate-900">{reassignModal.crateCode}</strong> ({reassignModal.crateTitle}) to an alternative vessel or air corridor. Updating carrier will recompute ETA, connection status, and resolve missed connection alerts.
            </p>

            <form onSubmit={handleSubmitReassignment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Replacement Carrier</label>
                <select
                  value={reassignModal.carrierTransportId}
                  onChange={e => setReassignModal(prev => ({ ...prev, carrierTransportId: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Choose Transport --</option>
                  {transports.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.type} • {t.capacityKg >= 1000 ? `${(t.capacityKg/1000).toLocaleString()} MT` : `${t.capacityKg} kg`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Carrier Load Stop</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={reassignModal.carrierLoadStop}
                    onChange={e => setReassignModal(prev => ({ ...prev, carrierLoadStop: Number(e.target.value) }))}
                    required
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Stop number where cargo loads</span>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Carrier Unload Stop</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={reassignModal.carrierUnloadStop}
                    onChange={e => setReassignModal(prev => ({ ...prev, carrierUnloadStop: Number(e.target.value) }))}
                    required
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Stop number where cargo offloads</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReassignModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReassign}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingReassign ? 'Reassigning...' : 'Confirm Reassignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
