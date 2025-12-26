'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Landmark, Building, Shield, GraduationCap, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Dashboard' },
  { href: '/miei-gruppi', icon: Users, label: 'I Miei Gruppi' },
  { href: '/contabilita', icon: Landmark, label: 'Contabilità' },
  { href: '/nucleo-familiare', icon: Building, label: 'Nucleo Familiare' },
];

const adminGroups = [
  {
    title: 'Area Educatori',
    icon: GraduationCap,
    href: '/admin/area-educatori',
    links: [
      { href: '/admin/educatori', label: 'Educatori' },
      { href: '/admin/ruoli-educatori', label: 'Ruoli Educatori' },
    ],
  },
  {
    title: 'Gestione Utenti',
    icon: UserCog,
    href: '/admin/users',
    links: [
      { href: '/admin/users', label: 'Utenti' },
      { href: '/admin/roles', label: 'Ruoli' },
      { href: '/admin/permissions', label: 'Permessi' },
    ],
  },
];


export default function SidebarLinks({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();
  const { userData } = useUserData();

  const isAdmin = userData?.roles?.includes('admin');

  const getActiveAdminGroup = () => {
    return adminGroups.find(group => group.links.some(link => pathname.startsWith(link.href)))?.title;
  };

  const renderLink = (item: { href: string; icon: React.ElementType; label: string; }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:text-foreground',
          {
            'bg-accent text-accent-foreground': isActive,
          },
          isMobile && 'text-lg'
        )}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  };
  
  const renderSubLink = (href: string, label: string) => {
    const isActive = pathname.startsWith(href);
    return (
       <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-3 rounded-lg py-2 pl-11 pr-3 text-sm font-medium transition-colors hover:text-primary",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {navItems.map(renderLink)}
      {isAdmin && (
         <Accordion type="single" collapsible defaultValue="admin-panel" className="w-full">
            <AccordionItem value="admin-panel" className="border-b-0">
                <AccordionTrigger className={cn(
                    "flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground",
                    {'bg-accent text-accent-foreground': pathname.startsWith('/admin')}
                )}>
                    <Shield className="h-5 w-5" />
                    <span className="flex-1 text-left">Admin Panel</span>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pl-4">
                    <Accordion type="single" collapsible defaultValue={getActiveAdminGroup()} className="w-full space-y-1">
                        {adminGroups.map((group) => (
                             <AccordionItem value={group.title} key={group.title} className="border-b-0">
                                <AccordionTrigger className="py-2 hover:no-underline [&[data-state=open]>svg]:-rotate-90">
                                    <div className={cn(
                                        "flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
                                        group.links.some(l => pathname.startsWith(l.href)) && "text-primary"
                                    )}>
                                        <group.icon className="h-4 w-4" />
                                        {group.title}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 space-y-1">
                                    {group.links.map(link => renderSubLink(link.href, link.label))}
                                </AccordionContent>
                             </AccordionItem>
                        ))}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
         </Accordion>
      )}
    </div>
  );
}
