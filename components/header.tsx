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
import { AcChiariLogo } from './ac-logo';

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
            <AcChiariLogo size={36} />
            <Link href="/dashboard" onClick={closeSheet}>
              <p className="text-sm font-bold text-sidebar-fg">AC Chiari</p>
              <p className="text-xs text-sidebar-muted">Azione Cattolica</p>
            </Link>
          </div>
          <nav className="sidebar-scroll px-3 py-4 flex-1 overflow-y-auto">
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

