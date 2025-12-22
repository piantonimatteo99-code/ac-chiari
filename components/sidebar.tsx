import Link from 'next/link';
import { Settings, Users } from 'lucide-react';
import SidebarLinks from './sidebar-links';

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col gap-6 px-4 py-6">
        <Link
          href="/dashboard"
          className="group flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground"
        >
          <Users className="h-6 w-6 transition-all group-hover:scale-110" />
          <span>AC Chiari</span>
        </Link>
        <SidebarLinks />
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="#"
          className="flex w-full items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          Impostazioni
        </Link>
      </nav>
    </aside>
  );
}
