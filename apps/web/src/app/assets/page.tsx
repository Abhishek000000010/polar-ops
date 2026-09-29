'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Share2
} from 'lucide-react';
import { api } from '../../lib/api';
import AssetHealthChart from '../../components/charts/AssetHealthChart';

export default function AssetsPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Maintenance modal
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [notes, setNotes] = useState('Scheduled polar winterization routine');
  const [nextDate, setNextDate] = useState('2027-02-15');
  const [hoursAdded, setHoursAdded] = useState(120);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [astRes, invRes] = await Promise.all([
        api.getAssets(),
        api.getInventory()
      ]);
      if (astRes?.data) setAssets(astRes.data);
      if (invRes?.data) setInventory(invRes.data);
    } catch (e) {
      console.error('Failed to load assets', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenMaintenance = (asset: any) => {
    setSelectedAsset(asset);
    setNotes(`Completed 250-hour oil/filter service and cold-start inspection on ${asset.name}`);
    setShowMaintModal(true);
  };

  const handlePerformMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setSubmitting(true);
    try {
      const payload = {
        serviceNotes: notes,
        nextDueDate: new Date(nextDate).toISOString(),
        hoursAdded: Number(hoursAdded)
      };
      const res = await api.performMaintenance(selectedAsset._id, payload);
      if (res?.data) {
        setShowMaintModal(false);
        await loadData();
      } else {
        alert(res?.error?.message || 'Failed to log maintenance');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getSpareNames = (spareIds?: string[]) => {
    if (!spareIds || spareIds.length === 0) return 'None linked';
    const found = inventory.filter(i => spareIds.includes(i._id));
    if (found.length === 0) return 'None';
    return found.map(f => `${f.itemCode} (Stock: ${f.quantity})`).join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2.5">
            <Wrench className="w-6 h-6 text-amber-600" />
            <span>Critical Assets & Maintenance Cycles</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Station diesel generators, PistenBully tracked snow vehicles, deep ice drill masts, and spare parts inventory linkage.
          </p>
        </div>
      </div>

      {/* Critical Machinery Runtime & Health Chart */}
      <AssetHealthChart assets={assets} />

      {/* Assets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map((asset) => {
          const isOverdue = new Date(asset.nextServiceDueDate) <= new Date('2026-11-15T08:00:00.000Z') || asset.status === 'MAINTENANCE_DUE';

          return (
            <div key={asset._id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                      {asset.assetCode}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{asset.name}</h3>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Station: <strong className="text-slate-800">{asset.location}</strong> · Category: {asset.category}
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  asset.status === 'OPERATIONAL' && !isOverdue ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {isOverdue ? 'SERVICE OVERDUE' : asset.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block font-medium">Runtime</span>
                  <span className="text-slate-900 font-bold text-sm">{asset.runtimeHours.toLocaleString()} hrs</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block font-medium">Last Service</span>
                  <span className="text-slate-600 text-xs">{asset.lastServiceDate.split('T')[0]}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase block font-medium">Next Due</span>
                  <span className={`text-xs font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                    {asset.nextServiceDueDate.split('T')[0]}
                  </span>
                </div>
              </div>

              {/* Linked Spares */}
              <div className="text-xs pt-1 border-t border-slate-100 space-y-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide block">
                  Linked Spare Parts in Inventory:
                </span>
                <span className="text-slate-700 text-xs block">
                  {getSpareNames(asset.requiredSpareItemIds)}
                </span>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleOpenMaintenance(asset)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-amber-900 border border-slate-200 rounded-md text-xs font-semibold transition"
                >
                  Log Service Routine
                </button>
                <Link
                  href={`/ripple?type=ASSET&id=${asset._id}`}
                  className="flex items-center space-x-1 text-sky-700 hover:text-sky-800 font-semibold text-xs"
                >
                  <Share2 className="w-3.5 h-3.5 mr-1" />
                  <span>Trace Dependencies</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Maintenance Modal */}
      {showMaintModal && selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handlePerformMaintenance} className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Log Maintenance Service</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedAsset.name} ({selectedAsset.assetCode})</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Additional Runtime Hours Logged</label>
                <input
                  type="number"
                  value={hoursAdded}
                  onChange={(e) => setHoursAdded(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Next Service Due Date</label>
                <input
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Service Notes / Tasks Executed</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMaintModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
              >
                {submitting ? 'Saving...' : 'Record Service & Set Operational'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
