import type { Metadata } from 'next';
import './globals.css';
import Providers from '../components/Providers';
import ShellLayout from '../components/ShellLayout';

export const metadata: Metadata = {
  title: 'Polar-Ops · National Centre for Polar and Ocean Research',
  description: 'Integrated Polar Expedition Logistics, Asset & Readiness Management Platform (MoES / NCPOR)'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen font-sans antialiased">
        <Providers>
          <ShellLayout>
            {children}
          </ShellLayout>
        </Providers>
      </body>
    </html>
  );
}
