'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Landmark, Building, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/miei-gruppi', icon: Users, label: 'I Miei Gruppi' },
  { href: '/contabilita', icon: Landmark, label: 'Contabilità' },
  { href: '/nucleo-familiare', icon: Building, label: 'Nucleo Familiare' },
];

const adminItems = [{ href: '/admin', icon: Shield, label: 'Admin Panel' }];

export default function SidebarLinks({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { userData } = useUserData();

  const isAdmin = userData?.roles?.includes('admin');

  const renderLink = (item: typeof navItems[0]) => {
    const isActive = pathname.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground',
          {
            'bg-accent text-accent-foreground': isActive,
          }
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {navItems.map(renderLink)}
      {isAdmin && (
        <div className="mt-auto pt-4">
          {adminItems.map(renderLink)}
        </div>
      )}
    </div>
  );
}
