'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Home, Users, Landmark, Building, Cog, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/miei-gruppi', icon: Users, label: 'I Miei Gruppi' },
  { href: '/contabilita', icon: Landmark, label: 'Contabilità' },
  { href: '/nucleo-familiare', icon: Building, label: 'Nucleo Familiare' },
];

const adminItems = [
    { href: '/admin', icon: Shield, label: 'Admin Panel' }
]

export default function SidebarLinks({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();

  const renderLink = (item: typeof navItems[0], isActive: boolean) => {
    if (isMobile) {
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground',
            {
              'bg-accent text-foreground': isActive,
            }
          )}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      );
    }
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
              {
                'bg-accent text-accent-foreground': isActive,
              }
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="sr-only">{item.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center gap-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return renderLink(item, isActive);
        })}
      </div>
      <div className="mt-auto flex flex-col items-center gap-4">
         {adminItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return renderLink(item, isActive);
        })}
      </div>
    </TooltipProvider>
  );
}