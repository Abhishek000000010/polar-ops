'use client';

import React, { useEffect, useState } from 'react';
import {
  Truck,
  Anchor,
  Plane,
  AlertTriangle,
  Clock,
  ChevronRight,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import TransportCapacityChart from '../../components/charts/TransportCapacityChart';

export default function TransportPage() {
  const [transports, setTransports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Delay Modal State
  const [delayModal, setDelayModal] = useState<{
    isOpen: boolean;
    transportId: string;
    transportName: string;
    stopNumber: number;
    stopName: string;
  }>({
    isOpen: false,
    transportId: '',
    transportName: '',
    stopNumber: 1,
    stopName: ''
  });

  const [delayDays, setDelayDays] = useState<number>(5);
  const [delayReason, setDelayReason] = useState<string>('Pack ice in Prydz Bay');
  const [submittingDelay, setSubmittingDelay] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await api.getTransport();
      if (res?.data) setTransports(res.data);
    } catch (e) {
      console.error('Failed to load transport fleet', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'SHIP': return Anchor;
      case 'HELICOPTER': return Plane;
      case 'FLIGHT': return Plane;
      default: return Truck;
    }
  };

  const handleOpenDelayModal = (transport: any, stop: any) => {
    setDelayModal({
      isOpen: true,
      transportId: transport._id,
      transportName: transport.name,
      stopNumber: stop.stopNumber,
      stopName: stop.portOrStation
    });
    setDelayDays(5);
    setDelayReason('Pack ice in Prydz Bay');
  };

  const handleSubmitDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModal.transportId) return;

    setSubmittingDelay(true);
    try {
      const res = await api.delayTransport(
        delayModal.transportId,
        delayModal.stopNumber,
        delayDays,
        delayReason
      );

      if (res?.data) {
        setStatusMessage(`Successfully applied +${delayDays}d delay to ${delayModal.transportName}. Schedule updated.`);
        setDelayModal(prev => ({ ...prev, isOpen: false }));
        await loadData();
        setTimeout(() => setStatusMessage(null), 5000);
      } else {
        alert(res?.error?.message || 'Failed to submit transport delay');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmittingDelay(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Truck className="w-6 h-6 text-sky-600" />
            <span>Transport Fleet & Polar Transit Logistics</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Chartered polar icebreaker schedule, ship-borne Kamov helicopters, intercontinental air links, and snowcat convoys.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Transport Fleet Capacity & Payload Distribution Chart */}
      <TransportCapacityChart transports={transports} />

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {transports.map((t) => {
          const Icon = getTypeIcon(t.type);

          return (
            <div key={t._id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t.name}</h3>
                    <span className="text-xs text-sky-700 font-semibold uppercase tracking-wider">{t.type}</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {t.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-md border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block">Cargo Capacity</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {t.capacityKg >= 1000 ? `${(t.capacityKg / 1000).toLocaleString()} MT` : `${t.capacityKg} kg`}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block">Passenger Berths</span>
                  <span className="font-bold text-slate-900 text-sm">{t.passengerSeats} Seats</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase block">Current Position / Sector</span>
                  <span className="text-slate-800 font-medium text-xs">{t.currentLocation}</span>
                </div>
              </div>

              {/* Schedule of stops */}
              {t.schedule?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                    Port / Station Stops Schedule
                  </span>
                  <div className="space-y-2">
                    {t.schedule.map((stop: any) => {
                      const effArr = stop.actualArrival || stop.estimatedArrival || stop.scheduledArrival;
                      const effDep = stop.actualDeparture || stop.estimatedDeparture || stop.scheduledDeparture;
                      const isDelayed = stop.estimatedArrival && stop.estimatedArrival !== stop.scheduledArrival;

                      return (
                        <div key={stop.stopNumber} className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-200 font-bold text-slate-700">#{stop.stopNumber}</span>
                              <span>{stop.portOrStation}</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              {stop.status !== 'DEPARTED' && (
                                <button
                                  onClick={() => handleOpenDelayModal(t, stop)}
                                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[11px] font-semibold transition flex items-center space-x-1 cursor-pointer"
                                  title="Report transit delay from this stop onward"
                                >
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  <span>Report Delay</span>
                                </button>
                              )}
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                                stop.status === 'DEPARTED' ? 'bg-slate-200 text-slate-700' :
                                stop.status === 'ARRIVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}>
                                {stop.status}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3">
                            <span>
                              Arrival: <strong className={isDelayed ? 'text-amber-800' : 'text-slate-700'}>
                                {effArr ? effArr.split('T')[0] : 'TBD'}
                              </strong>
                              {isDelayed && (
                                <span className="ml-1 text-[10px] px-1 rounded bg-amber-100 text-amber-800 font-bold">
                                  Delayed
                                </span>
                              )}
                            </span>
                            <span>
                              Depart: <strong className={isDelayed ? 'text-amber-800' : 'text-slate-700'}>
                                {effDep ? effDep.split('T')[0] : 'TBD'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delay Modal */}
      {delayModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-base">Report Transport Delay</h3>
              </div>
              <button
                onClick={() => setDelayModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Reporting a delay will propagate through stop #{delayModal.stopNumber} ({delayModal.stopName}) and all subsequent stops for <strong className="text-slate-900">{delayModal.transportName}</strong>. Downstream crate ETAs, bed occupancies, and fuel margins will recompute dynamically.
            </p>

            <form onSubmit={handleSubmitDelay} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Delay Duration (Days)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 5, 8].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDelayDays(d)}
                      className={`py-1.5 px-3 rounded-md font-bold text-center border transition ${
                        delayDays === d
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={delayDays}
                  onChange={e => setDelayDays(Number(e.target.value))}
                  required
                  className="mt-2 w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reason / Environmental Trigger</label>
                <div className="space-y-1.5 mb-2">
                  {[
                    'Pack ice in Prydz Bay',
                    'Katabatic gale warning (Force 11)',
                    'Heavy fast-ice belt encountered',
                    'Technical hold & mechanical inspection'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDelayReason(preset)}
                      className={`w-full text-left text-[11px] p-2 rounded border transition ${
                        delayReason === preset
                          ? 'bg-amber-50 border-amber-300 text-amber-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      • {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={delayReason}
                  onChange={e => setDelayReason(e.target.value)}
                  placeholder="Or enter custom reason"
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDelayModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelay}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold transition shadow-xs cursor-pointer"
                >
                  {submittingDelay ? 'Updating Schedule...' : `Confirm +${delayDays}d Delay`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
