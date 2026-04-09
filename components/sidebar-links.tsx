'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Landmark, Building, Shield, GraduationCap, UserCog, FileCog, Group as GroupIcon, ShieldCheck, PenSquare, FlaskConical, CircleHelp, Coins, Calendar, Warehouse, Share2, Tent, Gavel, Bus, CookingPot } from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import { useUserData } from '@/src/hooks/use-user-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/src/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PagePermission } from '@/app/(app)/admin/configurazione/gestione-pagine/page';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import type { EducatorRole } from '@/app/(app)/admin/area-educatori/ruoli-educatori/page';
import { useCallback, useMemo, memo, useState } from 'react';
import type { Progetto } from '@/app/(app)/progetti/page';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';
import { differenceInDays, parseISO } from 'date-fns';
import { useNotifications } from '@/src/hooks/use-notifications';


const GIORNI_ALLERTA_MAGAZZINO = 7;

const navConfig = [
  { id: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: Home, subItems: [] },
  { id: 'progetti', href: '/progetti', label: 'Progetti', icon: FlaskConical, subItems: [] },
  { id: 'iscrizioni', href: '/iscrizioni', label: 'Iscrizioni', icon: PenSquare, subItems: [] },
  { id: 'nucleo-familiare', href: '/nucleo-familiare', label: 'Nucleo Familiare', icon: Building, subItems: [] },
  { id: 'calendario', href: '/calendario', label: 'Calendario', icon: Calendar, subItems: [] },
  { id: 'magazzino', href: '/magazzino', label: 'Magazzino', icon: Warehouse, subItems: [] },
  { id: 'campi', href: '/campi', label: 'Campi', icon: Tent, subItems: [
    { id: 'campi-list', href: '/campi', label: 'Tutti i Campi' },
    { id: 'campi-pullman', href: '/campi/pullman', label: 'Pullman' },
    { id: 'campi-case', href: '/campi/case', label: 'Case' },
    { id: 'campi-piatti', href: '/campi/piatti', label: 'Piatti' },
  ] },
  { id: 'consiglio', href: '/consiglio', label: 'Consiglio', icon: Gavel, subItems: [] },
  { 
    id: 'contabilita',
    label: 'Contabilità',
    icon: Landmark,
    subItems: [
      { id: 'contabilita-conto', href: '/contabilita/conto', label: 'Conto' },
      { id: 'contabilita-raccolte', href: '/contabilita/raccolte', label: 'Raccolte attive' },
      { id: 'contabilita-transazioni-da-controllare', href: '/contabilita/transazioni-da-controllare', label: 'Transazioni da Controllare' },
      { id: 'contabilita-pagamenti-contanti', href: '/contabilita/pagamenti-contanti', label: 'Pagamenti Contanti' },
      { id: 'contabilita-spese', href: '/contabilita/spese', label: 'Spese' },
      { id: 'contabilita-storico', href: '/contabilita/storico', label: 'Raccolte concluse' },
    ]
  },
  { 
    id: 'tesserati',
    label: 'Tesseramento',
    icon: ShieldCheck,
    subItems: [
      { id: 'tesserati-tariffe', href: '/tesserati/tariffe', label: 'Tariffe' },
      { id: 'tesserati-nuovi-iscritti', href: '/tesserati/nuovi-iscritti', label: 'Nuovi Iscritti' },
      { id: 'tesserati-tesserati', href: '/tesserati/tesserati', label: 'Tesserati' },
      { id: 'tesserati-famiglie', href: '/tesserati/famiglie', label: 'Famiglie' },
      { id: 'tesserati-archivio', href: '/tesserati/archivio', label: 'Archivio' },
    ]
  },
  { id: 'miei-gruppi', label: 'I Miei Gruppi', icon: Users, subItems: [] },
  { id: 'social-media', href: '/social-media', label: 'Social Media', icon: Share2, subItems: [] },
];

const adminGroups = [
  {
    title: 'Area Educatori',
    icon: GraduationCap,
    links: [
      { href: '/admin/area-educatori/educatori', label: 'Educatori' },
      { href: '/admin/area-educatori/ruoli-educatori', label: 'Ruoli Educatori' },
    ],
  },
  {
    title: 'Gestione Gruppi',
    icon: GroupIcon,
    links: [
      { href: '/admin/gestione-gruppi/tutti-i-gruppi', label: 'Tutti i Gruppi' },
    ],
  },
  {
    title: 'Gestione Utenti',
    icon: UserCog,
    links: [
      { href: '/admin/gestione-utenti/users', label: 'Database' },
      { href: '/admin/gestione-utenti/permessi', label: 'Permessi' },
      { href: '/admin/gestione-utenti/utenti-registrati', label: 'Utenti Registrati' },
    ],
  },
   {
    title: 'Configurazione',
    icon: FileCog,
    links: [
      { href: '/admin/configurazione/integrazione-drive', label: 'Integrazione Drive' },
      { href: '/admin/configurazione/gestione-pagine', label: 'Gestione Pagine' },
      { href: '/admin/configurazione/gestione-notifiche', label: 'Gestione Notifiche' },
    ],
  },
  {
    title: 'Segnalazioni',
    icon: CircleHelp,
    links: [
      { href: '/admin/segnalazioni', label: 'Gestione Feedback / Problemi' },
      { href: '/admin/test-notifiche', label: '🧪 Test Notifiche' },
    ],
  },
];


interface ProdottoAlimentoMin { id: string; dataScadenza: string; }

export const SidebarLinksInner = ({ isMobile = false, onLinkClick }: { isMobile?: boolean, onLinkClick?: () => void }) => {
  const pathname = usePathname();
  const { user } = useUser();
  const { userData, isLoading: isUserLoading } = useUserData();
  const firestore = useFirestore();

  // Track which accordion sections are open (to hide badge on header when open)
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const init = new Set<string>();
    navConfig.forEach(item => {
      if (item.subItems.length > 0 && pathname.startsWith(`/${item.id}`)) init.add(item.id);
    });
    if (pathname.startsWith('/campi')) init.add('campi');
    if (pathname.startsWith('/admin')) init.add('admin-panel');
    adminGroups.forEach(g => {
      if (g.links.some(l => pathname.startsWith(l.href))) init.add(g.title);
    });
    return init;
  });

  const toggleSection = useCallback((id: string, isOpen: boolean) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (isOpen) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const isAdmin = useMemo(() => userData?.roles?.includes('admin') ?? false, [userData]);

  const pageSettingsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'page-settings') : null, [firestore]);
  const { data: pageSettings, isLoading: isLoadingPageSettings } = useCollection<PagePermission>(pageSettingsQuery);

  const myGroupsQuery = useMemoFirebase(() =>
    (user && userData?.roles?.includes('educatore'))
      ? query(collection(firestore, 'gruppi'), where('educatorIds', 'array-contains', user.uid))
      : null,
    [firestore, user, userData]);
  const { data: myGroups, isLoading: isLoadingGroups } = useCollection<Group>(myGroupsQuery);

  const educatorRolesQuery = useMemoFirebase(() =>
    (user && userData?.roles?.includes('educatore'))
      ? query(collection(firestore, 'ruoli-educatori'), where('assignedEducators', 'array-contains', user.uid))
      : null,
    [firestore, user, userData]);
  const { data: mySpecificRoles, isLoading: isLoadingEducatorRoles } = useCollection<EducatorRole>(educatorRolesQuery);

  const allGroupsQuery = useMemoFirebase(() => isAdmin ? collection(firestore, 'gruppi') : null, [firestore, isAdmin]);
  const { data: allGroups, isLoading: isLoadingAllGroups } = useCollection<Group>(allGroupsQuery);
  
  const allProjectsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'progetti'), orderBy('createdAt', 'desc')) : null, [firestore]);
  const { data: allProjects, isLoading: isLoadingAllProjects } = useCollection<Progetto>(allProjectsQuery);
  
  const membriQuery = useMemoFirebase(() => {
      if (!firestore || !user || !userData?.roles?.includes('genitore')) return null;
      return collection(firestore, 'famiglie', user.uid, 'membri');
  }, [firestore, user, userData]);
  const { data: membri, isLoading: isLoadingMembri } = useCollection<Membro>(membriQuery);

  // Magazzino: prodotti alimenti in scadenza
  const alimentiQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'magazzino-alimenti') : null,
    [firestore]);
  const { data: alimentiScadenza } = useCollection<ProdottoAlimentoMin>(alimentiQuery);
  const prodottiInScadenzaCount = useMemo(() => {
    if (!alimentiScadenza) return 0;
    return alimentiScadenza.filter(p => {
      if (!p.dataScadenza) return false;
      try {
        const g = differenceInDays(parseISO(p.dataScadenza), new Date());
        return g >= 0 && g <= GIORNI_ALLERTA_MAGAZZINO;
      } catch { return false; }
    }).length;
  }, [alimentiScadenza]);

  // Notifiche non lette (badge sulla dashboard)
  const { notifiche, unreadCount: notificheNonLette } = useNotifications();

  // ── Centralized badge system ──────────────────────────────────────────────
  // Maps each unread notification's href to its count
  const hrefBadgeMap = useMemo(() => {
    const map = new Map<string, number>();
    notifiche.forEach((n: any) => {
      if (!n.letta && n.href) {
        map.set(n.href, (map.get(n.href) ?? 0) + 1);
      }
    });
    return map;
  }, [notifiche]);

  // Returns unread count for a single href
  const getBadge = useCallback((href: string) => hrefBadgeMap.get(href) ?? 0, [hrefBadgeMap]);

  // Returns total unread count for a list of hrefs
  const getSectionBadge = useCallback((hrefs: string[]) =>
    hrefs.reduce((sum, h) => sum + (hrefBadgeMap.get(h) ?? 0), 0)
  , [hrefBadgeMap]);

  // Pre-computed section totals used for accordion headers
  const adminAllHrefs = useMemo(() => adminGroups.flatMap(g => g.links.map(l => l.href)), []);
  const adminTotalBadge = useMemo(() => getSectionBadge(adminAllHrefs), [getSectionBadge, adminAllHrefs]);
  
  const userAndFamilyMembers = useMemo((): (typeof userData | Membro)[] => {
      if (!userData && !membri) return [];
      const allFamilyMembers = [];
      if (userData) allFamilyMembers.push(userData);
      if (membri) allFamilyMembers.push(...membri);
      return allFamilyMembers;
  }, [userData, membri]);

  const projectsToRender = useMemo(() => {
    if (!allProjects || !userData) return [];
    
    // Always exclude archived projects from the sidebar
    const activeProjects = allProjects.filter(p => p.status !== 'archiviato');
    
    if (isAdmin) {
        return activeProjects;
    }

    if (userData.roles?.includes('educatore')) {
        if (!myGroups) return [];
        const educatorGroupIds = new Set(myGroups.map(g => g.id));
        return activeProjects.filter(progetto => 
            progetto.groupIds.some(groupId => educatorGroupIds.has(groupId))
        );
    }
    
    if (userData.roles?.includes('genitore')) {
        if (userAndFamilyMembers.length === 0) return [];
        const familyGroupIds = new Set(userAndFamilyMembers.map(m => (m as any).groupId).filter(Boolean));
        if (familyGroupIds.size === 0) return [];
        return activeProjects.filter(progetto => 
            progetto.groupIds.some(groupId => familyGroupIds.has(groupId))
        );
    }

    return [];
  }, [allProjects, isAdmin, userData, myGroups, userAndFamilyMembers]);
  
  const isLoading = isUserLoading || isLoadingPageSettings || isLoadingGroups || isLoadingEducatorRoles || isLoadingAllGroups || isLoadingAllProjects || isLoadingMembri;

  const getPageVisibility = useCallback((page: { id: string; href?: string; label: string; }): { visible: boolean; reason: string } => {
    if (!userData || !user) {
        return { visible: false, reason: 'Dati utente non ancora caricati' };
    } 

    // These pages are ALWAYS visible to every authenticated user
    const alwaysVisible = ['dashboard', 'nucleo-familiare'];
    if (alwaysVisible.includes(page.id)) {
        return { visible: true, reason: 'Pagina sempre visibile' };
    }
    
    const setting = pageSettings?.find(p => p.id === page.id || p.path === page.href);
    if (!setting) {
        // page-settings not configured yet (admin hasn't visited Gestione Pagine)
        // Default: visible for all authenticated users
        return { visible: true, reason: 'Nessuna configurazione trovata — visibile di default' };
    } 
    
    if (!setting.visible) {
        return { visible: false, reason: 'Disabilitata in Gestione Pagine' };
    } 
    
    if (isAdmin) {
        return { visible: true, reason: 'Accesso garantito come Amministratore' };
    } 
    
    const userIsEducator = userData.roles?.includes('educatore');
    const userIsGenitore = userData.roles?.includes('genitore');
    const userIsUtente = !userIsEducator && !isAdmin; // 'utente' semplice

    if (setting.requiresGroupAssignmentCheck) {
        if (userIsEducator && myGroups && myGroups.length > 0) {
            return { visible: true, reason: 'Visibile: Educatore assegnato a un gruppo' };
        } else {
            return { visible: false, reason: 'Nascosto: Richiede assegnazione a un gruppo' };
        }
    } 
    
    if (setting.requiresEducatorRoleCheck && page.href) {
        if (userIsEducator && mySpecificRoles?.some(role => role.accessiblePages.includes(page.href!))) {
            return { visible: true, reason: 'Visibile: Permesso garantito da un ruolo specifico' };
        } else {
            return { visible: false, reason: 'Nascosto: Richiede un ruolo educatore specifico' };
        }
    } 
    
    return { visible: true, reason: 'Nessun permesso speciale richiesto' };
    
  }, [pageSettings, userData, user, isAdmin, myGroups, mySpecificRoles]);


  if (isLoading) {
    return <div className="px-3 py-2 text-muted-foreground">Caricamento...</div>;
  }
  
  const renderBadge = (count: number, color = 'bg-primary text-primary-foreground') =>
    count > 0 ? (
      <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${color}`}>
        {count > 9 ? '9+' : count}
      </span>
    ) : null;

  const renderLink = (item: { href: string; icon?: React.ElementType; label: string }, isSubItem = false) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    const isMagazzino = item.href === '/magazzino';
    const isDashboard = item.href === '/dashboard';
    // Dashboard: use total unread. Magazzino: product expiry. Others: per-href badge.
    const notifBadge = isDashboard ? 0 : getBadge(item.href);
    const showMagazzinoBadge = isMagazzino && prodottiInScadenzaCount > 0;
    const showDashboard = isDashboard && notificheNonLette > 0;
    return (
      <Link
        href={item.href}
        onClick={onLinkClick}
        className={cn(
          'flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left text-muted-foreground transition-colors hover:text-foreground',
          { 'bg-accent text-accent-foreground': isActive },
          isMobile && 'text-lg',
          isSubItem && 'text-sm font-medium pl-3'
        )}
      >
        {Icon && <Icon className="h-5 w-5" />}
        <span className="flex-1">{item.label}</span>
        {showMagazzinoBadge && renderBadge(prodottiInScadenzaCount, 'bg-destructive text-destructive-foreground')}
        {showDashboard && renderBadge(notificheNonLette)}
        {!isDashboard && !isMagazzino && renderBadge(notifBadge)}
      </Link>
    );
  };

  const renderAccordion = (item: { id: string, label: string, icon: React.ElementType, subItems: any[] }) => {
    const visibleSubItems = item.subItems.filter(sub => getPageVisibility(sub).visible);
    if (visibleSubItems.length === 0) return null;
    const isOpen = openSections.has(item.id);
    const Icon = item.icon;
    const sectionBadge = getSectionBadge(visibleSubItems.map((s: any) => s.href));
    return (
      <Accordion
        type="single" collapsible
        value={isOpen ? `${item.id}-panel` : ''}
        onValueChange={val => toggleSection(item.id, !!val)}
        className="w-full"
      >
        <AccordionItem value={`${item.id}-panel`} className="border-b-0">
          <AccordionTrigger
            className={cn("flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground",
              {'bg-accent text-accent-foreground': pathname.startsWith(`/${item.id}`)})}>
            <div className="flex items-center gap-4 pointer-events-none flex-1 min-w-0">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {sectionBadge > 0 && !isOpen && renderBadge(sectionBadge)}
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pl-3 space-y-1">
            {visibleSubItems.map((sub: any) => {
              const subBadge = getBadge(sub.href);
              return (
                <Link key={sub.id} href={sub.href} onClick={onLinkClick}
                  className={cn("flex w-full text-left items-center justify-between rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary",
                    pathname === sub.href ? "text-primary" : "text-muted-foreground")}>
                  <span>{sub.label}</span>
                  {renderBadge(subBadge)}
                </Link>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  const renderMieiGruppi = () => {
    const pageConfig = navConfig.find(p => p.id === 'miei-gruppi')!;
    const isVisible = getPageVisibility(pageConfig).visible;
    
    if (!isVisible) return null;

    const groups = isAdmin ? allGroups : myGroups;
    if (!groups || groups.length === 0) {
      return renderLink({ href: '/miei-gruppi', ...pageConfig });
    }

    const isInside = pathname.startsWith('/miei-gruppi');
    const Icon = pageConfig.icon;
    return (
      <Accordion type="single" collapsible defaultValue={isInside ? 'miei-gruppi-panel' : ''} className="w-full">
        <AccordionItem value="miei-gruppi-panel" className="border-b-0">
          <AccordionTrigger
            className={cn("flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground", {'bg-accent text-accent-foreground': isInside})}>
            <div className="flex items-center gap-4 pointer-events-none">
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{pageConfig.label}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pl-3 space-y-1">
            <Link href="/miei-gruppi" onClick={onLinkClick} className={cn("flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary", pathname === '/miei-gruppi' ? "text-primary" : "text-muted-foreground")}>
                Panoramica Gruppi
            </Link>
            {groups.map(group => {
              const href = `/miei-gruppi/${slugify(group.name)}`;
              return (
                <Link key={group.id} href={href} onClick={onLinkClick} className={cn("flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary", pathname === href ? "text-primary" : "text-muted-foreground")}>
                  {group.name}
                </Link>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  const renderProgetti = () => {
    const pageConfig = navConfig.find(p => p.id === 'progetti')!;
    const isVisible = getPageVisibility(pageConfig).visible;
    
    if (!isVisible) return null;

    if (!projectsToRender || projectsToRender.length === 0) {
      return renderLink({ href: '/progetti', ...pageConfig });
    }

    const isInside = pathname.startsWith('/progetti');
    const Icon = pageConfig.icon;
    return (
      <Accordion type="single" collapsible defaultValue={isInside ? 'progetti-panel' : ''} className="w-full">
        <AccordionItem value="progetti-panel" className="border-b-0">
          <AccordionTrigger
            className={cn("flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground", {'bg-accent text-accent-foreground': isInside})}>
            <div className="flex items-center gap-4 pointer-events-none">
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{pageConfig.label}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pl-3 space-y-1">
            <Link href="/progetti" onClick={onLinkClick} className={cn("flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary", pathname === '/progetti' ? "text-primary" : "text-muted-foreground")}>
                Tutti i progetti
            </Link>
            {projectsToRender.map(progetto => {
              const href = `/progetti/${progetto.slug}`;
              return (
                <Link key={progetto.id} href={href} onClick={onLinkClick} className={cn("flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary", pathname === href ? "text-primary" : "text-muted-foreground")}>
                  {progetto.name.charAt(0).toUpperCase() + progetto.name.slice(1)}
                </Link>
              );
            })}
            <Link href="/progetti/storico" onClick={onLinkClick} className={cn("flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary border-t border-border mt-1 pt-2", pathname === '/progetti/storico' ? "text-primary" : "text-muted-foreground")}>
              Storico
            </Link>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  const renderCampi = () => {
    const pageConfig = navConfig.find(p => p.id === 'campi')!;
    const isVisible = getPageVisibility({ id: 'campi', href: '/campi', label: 'Campi' }).visible;
    if (!isVisible) return null;

    const isInside = pathname.startsWith('/campi');
    const Icon = pageConfig.icon;
    const subIcons: Record<string, React.ElementType> = {
      '/campi': Tent,
      '/campi/pullman': Bus,
      '/campi/case': Home,
      '/campi/piatti': CookingPot,
    };

    return (
      <Accordion type="single" collapsible
        value={openSections.has('campi') ? 'campi-panel' : ''}
        onValueChange={val => toggleSection('campi', !!val)}
        className="w-full"
      >
        <AccordionItem value="campi-panel" className="border-b-0">
          <AccordionTrigger
            className={cn("flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground",
              { 'bg-accent text-accent-foreground': isInside })}
          >
            <div className="flex items-center gap-4 pointer-events-none flex-1 min-w-0">
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{pageConfig.label}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pl-3 space-y-1">
            {pageConfig.subItems.map((sub: any) => {
              const SubIcon = subIcons[sub.href];
              const isActive = pathname === sub.href;
              return (
                <Link key={sub.id} href={sub.href} onClick={onLinkClick}
                  className={cn(
                    "flex w-full text-left items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {SubIcon && <SubIcon className="h-4 w-4 shrink-0" />}
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  const getActiveAdminGroups = () => {
    return adminGroups.filter(group => group.links.some(link => pathname.startsWith(link.href))).map(g => g.title);
  };

  const renderAdminSubLink = (href: string, label: string) => {
    const isActive = pathname.startsWith(href);
    const badge = getBadge(href);
    return (
      <Link href={href} onClick={onLinkClick}
        className={cn("flex w-full text-left items-center justify-between rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors hover:text-primary",
          isActive ? "text-primary bg-primary/5" : "text-muted-foreground")}>
        <span className="flex items-center gap-3">{label}</span>
        {renderBadge(badge)}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {navConfig.map(item => {
        if (item.id === 'progetti') {
             return <div key={item.id}>{renderProgetti()}</div>;
        }
        if (item.id === 'campi') {
          return <div key={item.id}>{renderCampi()}</div>;
        }
        if (item.id === 'miei-gruppi') {
          return <div key={item.id}>{renderMieiGruppi()}</div>;
        }
        if (item.id === 'social-media') {
          // Only show to educatori and admin
          if (!userData?.roles?.includes('educatore') && !userData?.roles?.includes('admin')) return null;
          return <div key={item.id}>{renderLink(item as { href: string; icon: React.ElementType; label: string })}</div>;
        }
        if (item.id === 'consiglio') {
          // Only show to educatori and admin
          if (!userData?.roles?.includes('educatore') && !userData?.roles?.includes('admin')) return null;
          return <div key={item.id}>{renderLink(item as { href: string; icon: React.ElementType; label: string })}</div>;
        }
        if (item.subItems.length > 0) {
            return <div key={item.id}>{renderAccordion(item)}</div>;
        }
        if (getPageVisibility(item).visible) {
          return <div key={item.id}>{renderLink(item as { href: string; icon: React.ElementType; label: string })}</div>;
        }
        return null;
      })}

      {isAdmin && (
        <Accordion
          type="single" collapsible
          value={openSections.has('admin-panel') ? 'admin-panel' : ''}
          onValueChange={val => toggleSection('admin-panel', !!val)}
          className="w-full"
        >
            <AccordionItem value="admin-panel" className="border-b-0">
                <AccordionTrigger
                  className={cn("flex items-center gap-4 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:no-underline hover:text-foreground", {'bg-accent text-accent-foreground': pathname.startsWith('/admin')})}
                >
                    <div className="flex items-center gap-4 pointer-events-none flex-1 min-w-0">
                        <Shield className="h-5 w-5 shrink-0" />
                        <span className="flex-1 text-left">Admin Panel</span>
                        {adminTotalBadge > 0 && !openSections.has('admin-panel') && renderBadge(adminTotalBadge)}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0">
                    <Accordion
                      type="multiple"
                      value={Array.from(openSections).filter(s => adminGroups.some(g => g.title === s))}
                      onValueChange={vals => {
                        setOpenSections(prev => {
                          const next = new Set(prev);
                          adminGroups.forEach(g => next.delete(g.title));
                          vals.forEach(v => next.add(v));
                          return next;
                        });
                      }}
                      className="w-full space-y-1"
                    >
                        {adminGroups.map((group) => {
                            const groupBadge = getSectionBadge(group.links.map(l => l.href));
                            const isGroupOpen = openSections.has(group.title);
                            const isGroupActive = group.links.some(l => pathname.startsWith(l.href));
                            return (
                            <AccordionItem value={group.title} key={group.title} className="border-b-0">
                                <AccordionTrigger
                                  className={cn(
                                    "w-full py-2 pl-3 pr-3 hover:no-underline text-left",
                                    isGroupActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                    <div className="flex items-center gap-3 text-sm font-medium flex-1 min-w-0">
                                        <group.icon className="h-4 w-4 shrink-0" />
                                        <span className="flex-1 text-left">{group.title}</span>
                                        {groupBadge > 0 && !isGroupOpen && renderBadge(groupBadge)}
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-1 pl-4 space-y-1">
                                    {group.links.map(link => <div key={link.href}>{renderAdminSubLink(link.href, link.label)}</div>)}
                                </AccordionContent>
                            </AccordionItem>
                            );
                        })}
                    </Accordion>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      )}

    </div>
  );
}

export default memo(SidebarLinksInner);
