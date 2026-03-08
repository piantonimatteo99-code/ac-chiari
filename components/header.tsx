'use client';

import { signOut } from 'firebase/auth';
import { useAuth } from '@/src/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { CircleUser, PanelLeft, Church } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import SidebarLinks from './sidebar-links';
import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const auth = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };


  const closeSheet = () => setIsSheetOpen(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button size="icon" variant="outline" className="sm:hidden">
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="sm:max-w-xs">
          <nav className="grid gap-6 text-lg font-medium">
            <Link
              href="/dashboard"
              onClick={closeSheet}
              className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Church className="h-8 w-8 text-primary-foreground" />
              <span className="sr-only">AC Chiari</span>
            </Link>
            <SidebarLinks isMobile={true} onLinkClick={closeSheet} />
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
            <DropdownMenuItem onSelect={handleLogout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
