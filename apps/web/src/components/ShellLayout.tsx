'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === '/' || pathname === '/landing';

  if (isLandingPage) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* Minimalist Left Navigation Sidebar */}
      <Sidebar />

      {/* Main Operational Canvas */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <TopHeader />
        <main className="flex-1 p-6 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
