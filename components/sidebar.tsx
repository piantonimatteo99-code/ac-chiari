'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import SidebarLinks from './sidebar-links';
import { AcChiariLogo } from './ac-logo';

export default function Sidebar() {
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
            <p className="text-sm font-bold leading-tight text-sidebar-fg">AC Chiari</p>
            <p className="text-xs leading-tight text-sidebar-muted">Azione Cattolica</p>
          </div>
        </Link>
      </div>

      {/* Navigazione scorrevole */}
      <div className="flex-grow overflow-y-auto px-3 py-4">
        <nav className="flex flex-col gap-1">
          <SidebarLinks />
        </nav>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        <div className="flex flex-col px-3 py-3">
          <Link
            href="/admin/configurazione/gestione-pagine"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-muted transition-all duration-200 hover:bg-sidebar-hover hover:text-sidebar-fg"
          >
            <Settings className="h-4 w-4" />
            <span>Impostazioni</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
