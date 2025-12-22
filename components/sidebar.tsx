import Link from 'next/link';
import { Settings } from 'lucide-react';
import SidebarLinks from './sidebar-links';

const CustomLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    {...props}
  >
    <circle cx="50" cy="50" r="50" fill="#003366" />
    <defs>
      <radialGradient id="sunburst" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" style={{ stopColor: '#FFFFFF' }} />
        <stop offset="100%" style={{ stopColor: '#FFD700' }} />
      </radialGradient>
      <linearGradient id="crossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style={{ stopColor: 'white' }} />
        <stop offset="50%" style={{ stopColor: '#FFD700' }} />
        <stop offset="100%" style={{ stopColor: 'white' }} />
      </linearGradient>
    </defs>
    {[...Array(16)].map((_, i) => (
      <path
        key={i}
        d={`M50 50 L ${50 + 50 * Math.cos((2 * Math.PI * i) / 16)} ${
          50 + 50 * Math.sin((2 * Math.PI * i) / 16)
        } L ${50 + 50 * Math.cos((2 * Math.PI * (i + 0.5)) / 16)} ${
          50 + 50 * Math.sin((2 * Math.PI * (i + 0.5)) / 16)
        } Z`}
        fill={i % 2 === 0 ? '#FFD700' : '#003366'}
      />
    ))}
    <path
      d="M45 10 H55 V45 H90 V55 H55 V90 H45 V55 H10 V45 H45 Z"
      fill="url(#crossGradient)"
    />
    <circle cx="50" cy="50" r="50" fill="transparent" stroke="#333333" strokeWidth="1" />
  </svg>
);


export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col gap-6 px-4 py-6">
        <Link
          href="/dashboard"
          className="group flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground"
        >
          <CustomLogo className="h-8 w-8 transition-all group-hover:scale-110" />
          <span className='text-white'>AC Chiari</span>
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
