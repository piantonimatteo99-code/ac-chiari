import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { CircleUser, PanelLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import SidebarLinks from "./sidebar-links";

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

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="#"
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <CustomLogo className="h-8 w-8 transition-all group-hover:scale-110" />
              <span className="sr-only">AC Chiari</span>
            </Link>
            <SidebarLinks isMobile={true} />
          </nav>
        </SheetContent>
      </Sheet>
      <div className="relative ml-auto flex-1 md:grow-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full">
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
