'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Snowflake, ArrowRight, Activity, Radio, Share2, Flame, Map, Globe2, Shield } from 'lucide-react';

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 lg:px-12 py-4 flex items-center justify-between transition-all duration-300">
        <div className="flex items-center space-x-3 group cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Snowflake className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-extrabold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">POLAR-OPS</span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-500">
          <a href="#features" className="hover:text-slate-900 transition-colors">Platform</a>
          <a href="#stations" className="hover:text-slate-900 transition-colors">Stations</a>
          <a href="#compliance" className="hover:text-slate-900 transition-colors">Compliance</a>
        </div>

        <div>
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200 transition-all active:scale-95"
          >
            Launch Command Center
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-32 pb-24 text-center w-full max-w-5xl mx-auto overflow-hidden">
        <div 
          className={`transition-all duration-1000 ease-out transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}
        >
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 mb-8 leading-[1.1] max-w-4xl mx-auto">
            Mission-critical logistics for <span className="text-blue-600">polar expeditions.</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-slate-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Automated fuel runway forecasting, causal failure modeling, and offline satellite synchronization for Bharati, Maitri, and the Southern Ocean fleet.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
            <Link
              href="/overview"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-full hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-95"
            >
              Enter Command Center
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/simulator"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 text-base font-semibold rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm transition-all active:scale-95"
            >
              <Activity className="w-4 h-4 text-slate-400" />
              Try the Sandbox
            </Link>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50 border-t border-slate-100 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Core Capabilities</h2>
            <p className="text-slate-500 mt-3 text-lg">Designed specifically for extreme, disconnected environments.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">14-Day Fuel Runway</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Trend-aware winter fuel forecasting that detects heavy burn rates during blizzards long before standard averages would alert you.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Blast Radius Graph</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Trace causality cascades across crates, assets, and missions up to 5 levels deep. One missing pump won't catch you off guard.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Satellite Edge-Mesh</h3>
              <p className="text-slate-500 leading-relaxed text-sm">
                Offline CRDT replication with 97% payload compression. Continues working through satellite blackouts and syncs in bursts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 lg:px-12 bg-white text-center">
        <div className="max-w-3xl mx-auto space-y-8 bg-slate-900 rounded-[3rem] p-12 sm:p-20 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent pointer-events-none" />
          <Globe2 className="w-12 h-12 text-blue-400 mx-auto" />
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to see it in action?</h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Experience the real-time telemetry and disruption simulation engines inside the Polar-Ops portal.
          </p>
          <Link
            href="/overview"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 text-base font-bold rounded-full hover:bg-slate-100 hover:scale-105 transition-all active:scale-95 shadow-lg"
          >
            Launch Command Center
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-6 lg:px-12 py-8 bg-slate-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-slate-500 gap-4">
          <div className="flex items-center space-x-2 font-medium">
            <Snowflake className="w-4 h-4 text-blue-600" />
            <span className="text-slate-700">National Centre for Polar & Ocean Research</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5" />
              Antarctic Treaty Certified
            </div>
            <div className="font-mono bg-slate-200/50 px-2 py-1 rounded text-xs text-slate-600">
              v1.2
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
