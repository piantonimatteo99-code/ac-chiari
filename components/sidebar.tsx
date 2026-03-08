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
          {/* Logo AC Chiari */}
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 shrink-0">
            <circle cx="20" cy="20" r="20" fill="hsl(218 58% 42%)" />
            <g stroke="hsl(218 40% 65%)" strokeWidth="0.5" opacity="0.55">
              <line x1="20" y1="2" x2="20" y2="38" />
              <line x1="2" y1="20" x2="38" y2="20" />
              <line x1="6" y1="6" x2="34" y2="34" />
              <line x1="34" y1="6" x2="6" y2="34" />
              <line x1="20" y1="2" x2="6" y2="34" />
              <line x1="20" y1="2" x2="34" y2="34" />
              <line x1="2" y1="20" x2="34" y2="6" />
              <line x1="38" y1="20" x2="6" y2="6" />
              <circle cx="20" cy="20" r="12" strokeDasharray="1.5 2" />
              <circle cx="20" cy="20" r="7" strokeDasharray="1 2" />
            </g>
            <rect x="16" y="7" width="8" height="26" rx="2" fill="hsl(44 92% 62%)" />
            <rect x="7" y="16" width="26" height="8" rx="2" fill="hsl(44 92% 62%)" />
          </svg>
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
