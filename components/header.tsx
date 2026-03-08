'use client';

import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/src/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { CircleUser, PanelLeft, LogOut, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import SidebarLinks from './sidebar-links';
import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const auth = useAuth();
  const { user } = useUser();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Errore durante il logout: ', error);
    }
  };

  const closeSheet = () => setIsSheetOpen(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {/* Bottone hamburger mobile */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden rounded-xl">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Apri menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar-bg border-sidebar-border">
          {/* Header del drawer mobile */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-9">
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
            </div>
            <Link href="/dashboard" onClick={closeSheet}>
              <p className="text-sm font-bold text-sidebar-fg">AC Chiari</p>
              <p className="text-xs text-sidebar-muted">Azione Cattolica</p>
            </Link>
          </div>
          {/* Link navigazione mobile */}
          <nav className="px-3 py-4">
            <SidebarLinks isMobile={true} onLinkClick={closeSheet} />
          </nav>
        </SheetContent>
      </Sheet>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Menu utente */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full shadow-sm">
            <CircleUser className="h-5 w-5" />
            <span className="sr-only">Menu utente</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-foreground">Il mio account</p>
              {user?.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" />
            Profilo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Esci
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

