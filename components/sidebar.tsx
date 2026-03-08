import Link from 'next/link';
import { Settings, Church } from 'lucide-react';
import SidebarLinks from './sidebar-links';

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
      {/* Header fisso */}
      <div className="flex-shrink-0 px-4 py-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 text-lg font-semibold text-foreground"
        >
          <Church className="h-8 w-8" />
          <span>AC Chiari</span>
        </Link>
      </div>

      {/* Area scorrevole per i link */}
      <div className="flex-grow overflow-y-auto px-4">
        <nav className="flex flex-col gap-6">
          <SidebarLinks />
        </nav>
      </div>
      
      {/* Footer fisso */}
      <div className="flex-shrink-0 mt-auto border-t">
        <nav className="flex flex-col items-center gap-4 px-2 py-5">
            <Link
            href="#"
            className="flex w-full items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground"
            >
            <Settings className="h-5 w-5" />
            Impostazioni
            </Link>
        </nav>
      </div>
    </aside>
  );
}
