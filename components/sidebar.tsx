import Link from 'next/link';
import { Settings, User } from 'lucide-react';
import SidebarLinks from './sidebar-links';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

const CustomLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);


export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col gap-6 px-4 py-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-lg font-semibold text-primary-foreground"
        >
          <CustomLogo className="h-6 w-6 text-primary-foreground" />
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
