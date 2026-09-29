'use client';

import React, { useEffect, useState } from 'react';
import {
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Snowflake
} from 'lucide-react';
import { api } from '../../lib/api';
import FuelRunwayChart from '../../components/charts/FuelRunwayChart';
import WinterSupplyForecastChart from '../../components/charts/WinterSupplyForecastChart';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeInvChartTab, setActiveInvChartTab] = useState<'FUEL' | 'WINTER'>('FUEL');
  const [loading, setLoading] = useState(true);

  // Transaction form states
  const [showTxModal, setShowTxModal] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [txType, setTxType] = useState<'USED' | 'RECEIVED' | 'TRANSFERRED'>('USED');
  const [txQty, setTxQty] = useState<number>(100);
  const [txReason, setTxReason] = useState<string>('');
  const [targetStation, setTargetStation] = useState<string>('MAITRI');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [invRes, txRes] = await Promise.all([
        api.getInventory(),
        api.getTransactions()
      ]);
      if (invRes?.data) setItems(invRes.data);
      if (txRes?.data) setTransactions(txRes.data);
    } catch (e) {
      console.error('Failed to load inventory', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = items.filter(item => {
    if (selectedStation !== 'ALL' && item.station !== selectedStation) return false;
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    return true;
  });

  const handleOpenTx = (item: any, type: 'USED' | 'RECEIVED' | 'TRANSFERRED') => {
    setActiveItem(item);
    setTxType(type);
    setTxQty(item.category === 'FUEL' ? 500 : 5);
    setTxReason(type === 'USED' ? 'Routine generator / station consumption' : 'Fresh consignment received from ship');
    setShowTxModal(true);
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    setSubmitting(true);
    try {
      const payload = {
        type: txType,
        quantity: Number(txQty),
        reason: txReason,
        targetStation: txType === 'TRANSFERRED' ? targetStation : undefined
      };
      const res = await api.recordTransaction(activeItem._id, payload);
      if (res?.data) {
        setShowTxModal(false);
        await loadData();
      } else {
        alert(res?.error?.message || 'Transaction failed');
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
            <Layers className="w-6 h-6 text-sky-600" />
            <span>Station Inventory & Survival Runway</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tracking polar diesel (Jet A-1), winter food rations, critical mechanical spares, and stockout burn rates.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-2.5">
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium"
          >
            <option value="ALL">All Stations</option>
            <option value="BHARATI">Bharati</option>
            <option value="MAITRI">Maitri</option>
            <option value="HIMADRI">Himadri</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs font-medium"
          >
            <option value="ALL">All Categories</option>
            <option value="FUEL">Fuel</option>
            <option value="FOOD">Food Rations</option>
            <option value="SPARES">Mechanical Spares</option>
            <option value="SCIENTIFIC">Scientific</option>
            <option value="MEDICAL">Medical</option>
          </select>
        </div>
      </div>

      {/* Interactive Visual Runway & Survival Projections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Inventory Depletion Visualizer
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              Live Seeded Stock
            </span>
          </div>
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveInvChartTab('FUEL')}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center space-x-1.5 ${
                activeInvChartTab === 'FUEL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Fuel Burn Curve</span>
            </button>
            <button
              onClick={() => setActiveInvChartTab('WINTER')}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center space-x-1.5 ${
                activeInvChartTab === 'WINTER' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Snowflake className="w-3.5 h-3.5 text-sky-500" />
              <span>Winter Supply Forecast</span>
            </button>
          </div>
        </div>

        {activeInvChartTab === 'FUEL' ? (
          <FuelRunwayChart
            bharatiFuel={items.find(i => i.station === 'BHARATI' && i.category === 'FUEL')?.quantity || 18500}
            maitriFuel={items.find(i => i.station === 'MAITRI' && i.category === 'FUEL')?.quantity || 48000}
          />
        ) : (
          <WinterSupplyForecastChart inventory={items} />
        )}
      </div>

      {/* Stock Items Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Station Inventory Stock Ledger ({filteredItems.length})
          </h2>
          <span className="text-xs text-slate-500">Runway projected from daily burn rate</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Code / Item Description</th>
                <th className="py-3 px-3">Station</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Available Stock</th>
                <th className="py-3 px-3 text-right">Min Buffer</th>
                <th className="py-3 px-3">Daily Burn</th>
                <th className="py-3 px-3">Survival Runway</th>
                <th className="py-3 px-3 text-right">Stock Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isDeficit = item.quantity <= item.minimumLevel;
                const daysRunway = item.dailyBurnRate > 0 ? Math.floor(item.quantity / item.dailyBurnRate) : null;

                return (
                  <tr key={item._id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4">
                      <span className="text-sky-700 font-bold text-xs block">{item.itemCode}</span>
                      <span className="font-semibold text-slate-900 text-xs">{item.name}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-slate-700 font-medium">{item.station}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-xs">
                      <span className={isDeficit ? 'text-rose-600' : 'text-slate-900'}>
                        {item.quantity.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 text-xs">
                      {item.minimumLevel.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-xs">
                      {item.dailyBurnRate > 0 ? `${item.dailyBurnRate} ${item.unit}/day` : 'On-Demand'}
                    </td>
                    <td className="py-3 px-3">
                      {daysRunway !== null ? (
                        <div className="flex items-center space-x-1.5 text-xs">
                          <span className={daysRunway <= 90 ? 'text-amber-800 font-bold' : 'text-emerald-700 font-semibold'}>
                            ~{daysRunway} days
                          </span>
                          {daysRunway <= 90 && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded border border-amber-200 font-medium">
                              Resupply Critical
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Stable Spare</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleOpenTx(item, 'USED')}
                          title="Record Stock Consumption"
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleOpenTx(item, 'RECEIVED')}
                          title="Record Stock Receipt"
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition"
                        >
                          Receive
                        </button>
                        <button
                          onClick={() => handleOpenTx(item, 'TRANSFERRED')}
                          title="Transfer Stock to another Station"
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-xs font-semibold transition"
                        >
                          Transfer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTxModal && activeItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleRecordTransaction} className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Stock {txType}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeItem.name} ({activeItem.station})</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                Available: {activeItem.quantity} {activeItem.unit}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Quantity ({activeItem.unit})</label>
                <input
                  type="number"
                  value={txQty}
                  onChange={(e) => setTxQty(Number(e.target.value))}
                  required
                  min={1}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {txType === 'TRANSFERRED' && (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Destination Station</label>
                  <select
                    value={targetStation}
                    onChange={(e) => setTargetStation(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="MAITRI">Maitri Station</option>
                    <option value="BHARATI">Bharati Station</option>
                    <option value="HIMADRI">Himadri (Arctic)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Operational Reason / Job Reference</label>
                <input
                  type="text"
                  value={txReason}
                  onChange={(e) => setTxReason(e.target.value)}
                  required
                  placeholder="e.g. Caterpillar 3406 generator run cycle #4"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-semibold transition shadow-xs"
              >
                {submitting ? 'Recording...' : `Confirm ${txType}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recent Inventory Transactions Log */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
          Recent Material Movements & Audit Log ({transactions.length})
        </h3>
        <div className="divide-y divide-slate-100 text-xs">
          {transactions.slice(0, 5).map((t) => (
            <div key={t._id} className="py-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    t.type === 'USED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    t.type === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    'bg-sky-50 text-sky-700 border border-sky-200'
                  }`}>
                    {t.type}
                  </span>
                  <span className="text-slate-900 font-bold">{t.quantity}</span>
                  <span className="text-slate-500">({t.itemCode})</span>
                  <span className="text-slate-600 font-medium">at {t.station}</span>
                </div>
                <div className="text-xs text-slate-500">{t.reason}</div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div>Actor: {t.actor}</div>
                <div>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
