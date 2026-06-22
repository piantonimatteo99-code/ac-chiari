'use client';

import Link from 'next/link';

import SidebarLinks from './sidebar-links';
import { AcChiariLogo } from './ac-logo';
import { useTenant } from '@/src/hooks/useTenant';

export default function Sidebar() {
  const { tenantConfig } = useTenant();

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col shadow-sidebar bg-sidebar-bg sm:flex">

      {/* Logo / Brand */}
      <div className="flex-shrink-0 px-4 py-5 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 hover:opacity-90"
        >
          <AcChiariLogo size={40} className="shrink-0" />
          <div>
            <p className="text-sm font-bold leading-tight text-sidebar-fg">{tenantConfig.name}</p>
            <p className="text-xs leading-tight text-sidebar-muted">Azione Cattolica</p>
          </div>
        </Link>
      </div>

      {/* Navigazione scorrevole */}
      <div className="flex-grow sidebar-scroll px-3 py-4">
        <nav className="flex flex-col gap-1">
          <SidebarLinks />
        </nav>
      </div>


    </aside>
  );
}
