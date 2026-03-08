'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import SidebarLinks from './sidebar-links';

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col shadow-sidebar bg-sidebar-bg sm:flex">

      {/* Logo / Brand */}
      <div className="flex-shrink-0 px-4 py-5 border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 hover:opacity-90"
        >
          {/* Icona Brand — Croce AC Chiari */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400/90">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7">
              <circle cx="16" cy="16" r="15" fill="hsl(218 62% 35%)" />
              <g opacity="0.3" stroke="hsl(44 90% 75%)" strokeWidth="0.8">
                <line x1="16" y1="1" x2="16" y2="31" />
                <line x1="1" y1="16" x2="31" y2="16" />
                <line x1="4.7" y1="4.7" x2="27.3" y2="27.3" />
                <line x1="27.3" y1="4.7" x2="4.7" y2="27.3" />
                <line x1="16" y1="1" x2="4.7" y2="27.3" />
                <line x1="16" y1="1" x2="27.3" y2="27.3" />
                <line x1="1" y1="16" x2="27.3" y2="4.7" />
                <line x1="31" y1="16" x2="4.7" y2="4.7" />
              </g>
              <rect x="14" y="5" width="4" height="22" rx="1.5" fill="hsl(44 90% 72%)" />
              <rect x="5" y="13" width="22" height="4" rx="1.5" fill="hsl(44 90% 72%)" />
            </svg>
          </div>
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
