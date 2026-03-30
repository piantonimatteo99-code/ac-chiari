'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Home, FlaskConical, PenSquare, Building, Calendar, Warehouse, Tent, Landmark, ShieldCheck, Users, Share2, Shield, GraduationCap, UserCog, FileCog, CircleHelp, ChevronRight, FolderOpen, Gavel } from 'lucide-react';
import type { Group } from '../../gestione-gruppi/tutti-i-gruppi/page';


export interface PagePermission {
  id: string;
  path: string;
  label: string;
  visible: boolean;
  requiresEducatorRoleCheck: boolean;
  requiresGroupAssignmentCheck: boolean;
}

const ALL_PAGES: Omit<PagePermission, 'visible' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck'>[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'progetti', label: 'Progetti', path: '/progetti' },
  { id: 'iscrizioni', label: 'Iscrizioni', path: '/iscrizioni' },
  { id: 'nucleo-familiare', label: 'Nucleo Familiare', path: '/nucleo-familiare' },
  { id: 'calendario', label: 'Calendario', path: '/calendario' },
  { id: 'magazzino', label: 'Magazzino', path: '/magazzino' },
  { id: 'campi', label: 'Campi', path: '/campi' },
  { id: 'consiglio', label: 'Consiglio', path: '/consiglio' },
  { id: 'social-media', label: 'Social Media', path: '/social-media' },
  { id: 'contabilita-conto', label: 'Contabilità / Conto', path: '/contabilita/conto' },
  { id: 'contabilita-transazioni-da-controllare', label: 'Contabilità / Transazioni da Controllare', path: '/contabilita/transazioni-da-controllare' },
  { id: 'contabilita-raccolte', label: 'Contabilità / Raccolte', path: '/contabilita/raccolte' },
  { id: 'contabilita-spese', label: 'Contabilità / Spese', path: '/contabilita/spese' },
  { id: 'contabilita-pagamenti-contanti', label: 'Contabilità / Pagamenti Contanti', path: '/contabilita/pagamenti-contanti' },
  { id: 'contabilita-storico', label: 'Contabilità / Storico', path: '/contabilita/storico' },
  { id: 'tesserati-tariffe', label: 'Tesserati / Tariffe', path: '/tesserati/tariffe' },
  { id: 'tesserati-nuovi-iscritti', label: 'Tesserati / Nuovi Iscritti', path: '/tesserati/nuovi-iscritti' },
  { id: 'tesserati-tesserati', label: 'Tesserati / Tesserati', path: '/tesserati/tesserati' },
  { id: 'tesserati-famiglie', label: 'Tesserati / Famiglie', path: '/tesserati/famiglie' },
  { id: 'tesserati-archivio', label: 'Tesserati / Archivio', path: '/tesserati/archivio' },
  { id: 'miei-gruppi', label: 'I Miei Gruppi', path: '/miei-gruppi' },
];

interface SiteMapNode {
  label: string;
  path?: string;
  icon?: React.ElementType;
  badge?: string;
  children?: SiteMapNode[];
}

const SITE_MAP: SiteMapNode[] = [
  { label: 'Dashboard', path: '/dashboard', icon: Home },
  {
    label: 'Progetti', path: '/progetti', icon: FlaskConical,
    children: [
      { label: '[nome-progetto]', path: '/progetti/[slug]', badge: 'dinamico' },
      { label: 'Storico', path: '/progetti/storico' },
    ],
  },
  { label: 'Iscrizioni', path: '/iscrizioni', icon: PenSquare },
  { label: 'Nucleo Familiare', path: '/nucleo-familiare', icon: Building },
  { label: 'Calendario', path: '/calendario', icon: Calendar },
  { label: 'Magazzino', path: '/magazzino', icon: Warehouse },
  {
    label: 'Campi', path: '/campi', icon: Tent,
    children: [
      { label: 'Case', badge: 'tab' },
      { label: 'Pullman', badge: 'tab' },
      { label: 'Spesa', badge: 'tab' },
      { label: 'Preventivo', badge: 'tab' },
    ],
  },
  {
    label: 'Consiglio', path: '/consiglio', icon: Gavel, badge: 'solo educatori',
    children: [
      { label: 'Ordine del Giorno', badge: 'tab' },
      { label: 'Verbali', badge: 'tab' },
    ],
  },
  {
    label: 'Contabilità', icon: Landmark,
    children: [
      { label: 'Conto', path: '/contabilita/conto' },
      { label: 'Raccolte attive', path: '/contabilita/raccolte' },
      { label: 'Transazioni da Controllare', path: '/contabilita/transazioni-da-controllare' },
      { label: 'Pagamenti Contanti', path: '/contabilita/pagamenti-contanti' },
      { label: 'Spese', path: '/contabilita/spese' },
      { label: 'Raccolte concluse', path: '/contabilita/storico' },
    ],
  },
  {
    label: 'Tesseramento', icon: ShieldCheck,
    children: [
      { label: 'Tariffe', path: '/tesserati/tariffe' },
      { label: 'Nuovi Iscritti', path: '/tesserati/nuovi-iscritti' },
      { label: 'Tesserati', path: '/tesserati/tesserati' },
      { label: 'Famiglie', path: '/tesserati/famiglie' },
      { label: 'Archivio', path: '/tesserati/archivio' },
    ],
  },
  {
    label: 'I Miei Gruppi', path: '/miei-gruppi', icon: Users,
    children: [
      { label: '[nome-gruppo]', path: '/miei-gruppi/[slug]', badge: 'dinamico' },
    ],
  },
  { label: 'Social Media', path: '/social-media', icon: Share2, badge: 'solo educatori' },
  {
    label: 'Admin Panel', icon: Shield, badge: 'solo admin',
    children: [
      {
        label: 'Area Educatori', icon: GraduationCap,
        children: [
          { label: 'Educatori', path: '/admin/area-educatori/educatori' },
          { label: 'Ruoli Educatori', path: '/admin/area-educatori/ruoli-educatori' },
        ],
      },
      {
        label: 'Gestione Gruppi', icon: Users,
        children: [
          { label: 'Tutti i Gruppi', path: '/admin/gestione-gruppi/tutti-i-gruppi' },
        ],
      },
      {
        label: 'Gestione Utenti', icon: UserCog,
        children: [
          { label: 'Database Utenti', path: '/admin/gestione-utenti/users' },
          { label: 'Permessi', path: '/admin/gestione-utenti/permessi' },
        ],
      },
      {
        label: 'Configurazione', icon: FileCog,
        children: [
          { label: 'Integrazione Drive', path: '/admin/configurazione/integrazione-drive' },
          { label: 'Gestione Pagine', path: '/admin/configurazione/gestione-pagine' },
          { label: 'Gestione Notifiche', path: '/admin/configurazione/gestione-notifiche' },
        ],
      },
      {
        label: 'Segnalazioni', icon: CircleHelp,
        children: [
          { label: 'Gestione Feedback / Problemi', path: '/admin/segnalazioni' },
        ],
      },
    ],
  },
];

export default function GestionePaginePage() {
  const firestore = useFirestore();

  const permissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'page-settings');
  }, [firestore]);

  const { data: permissionsData, isLoading } = useCollection<PagePermission>(permissionsQuery);

  useEffect(() => {
    if (!isLoading && firestore && permissionsData) {
      const existingIds = new Set(permissionsData.map(p => p.id));
      const batch = writeBatch(firestore);
      let writes = 0;

      ALL_PAGES.forEach(page => {
        if (!existingIds.has(page.id)) {
          let requiresEducatorRoleCheck = false;
          if (['tesserati-nuovi-iscritti', 'tesserati-tesserati', 'tesserati-famiglie', 'contabilita-conto', 'contabilita-raccolte', 'contabilita-spese', 'contabilita-pagamenti-contanti', 'contabilita-storico', 'tesserati-archivio', 'contabilita-transazioni-da-controllare'].includes(page.id)) {
            requiresEducatorRoleCheck = true;
          }
          const newPermission: PagePermission = {
            ...page,
            visible: true,
            requiresEducatorRoleCheck,
            requiresGroupAssignmentCheck: page.id === 'miei-gruppi',
          };
          const pageDocRef = doc(firestore, 'page-settings', page.id);
          batch.set(pageDocRef, newPermission);
          writes++;
        }
      });
      if (writes > 0) {
        batch.commit().catch(console.error);
      }
    }
  }, [isLoading, permissionsData, firestore]);

  const permissionsMap = useMemo(() => {
    if (!permissionsData) return new Map<string, PagePermission>();
    return new Map(permissionsData.map(p => [p.id, p]));
  }, [permissionsData]);

  const handlePermissionChange = async (
    pageId: string,
    field: 'visible' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck',
    value: boolean,
  ) => {
    if (!firestore) return;
    const currentPermissions = permissionsMap.get(pageId);
    if (!currentPermissions) return;
    const updatedPermissions: PagePermission = { ...currentPermissions, [field]: value };
    const pageDocRef = doc(firestore, 'page-settings', pageId);
    await setDoc(pageDocRef, updatedPermissions, { merge: true });
  };

  const isSpecialPage = (id: string) => id === 'miei-gruppi';

  const renderSiteMapNode = (node: SiteMapNode, depth = 0): React.ReactNode => {
    const Icon = node.icon;
    const hasChildren = node.children && node.children.length > 0;
    const isGroup = !node.path && hasChildren;

    const badgeColors: Record<string, string> = {
      'dinamico': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      'tab': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      'solo admin': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
      'solo educatori': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    };

    return (
      <div key={node.label} className={depth > 0 ? 'ml-5 border-l border-border pl-4 mt-1' : ''}>
        <div className={`flex items-center gap-2 py-1.5 rounded-md ${
          depth === 0 ? 'font-semibold text-foreground text-sm' :
          depth === 1 && isGroup ? 'font-medium text-foreground/80 text-sm' :
          'text-muted-foreground text-sm'
        }`}>
          {Icon && depth === 0 && <Icon className="h-4 w-4 text-primary shrink-0" />}
          {!Icon && depth === 0 && <FolderOpen className="h-4 w-4 text-primary shrink-0" />}
          {depth > 0 && !isGroup && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
          {depth > 0 && isGroup && Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {depth > 0 && isGroup && !Icon && <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span>{node.label}</span>
          {node.path && (
            <span className="text-[10px] text-muted-foreground/60 font-mono hidden md:inline">{node.path}</span>
          )}
          {node.badge && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColors[node.badge] ?? 'bg-muted text-muted-foreground'}`}>
              {node.badge}
            </span>
          )}
        </div>
        {hasChildren && (
          <div>
            {node.children!.map(child => renderSiteMapNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Gestione Pagine e Visibilità</CardTitle>
          <CardDescription>
            Definisci la visibilità globale di ogni pagina e i controlli di permesso da applicare.
            Gli amministratori vedono sempre tutte le pagine visibili.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagina</TableHead>
                <TableHead className="text-center w-[120px]">Visibile</TableHead>
                <TableHead className="text-center w-[250px]">Visibile solo a Educatori con Ruolo Specifico</TableHead>
                <TableHead className="text-center w-[250px]">Visibile solo a Educatori assegnati a un Gruppo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Caricamento...</TableCell></TableRow>
              ) : (
                ALL_PAGES.map((page) => {
                  const pagePermissions = permissionsMap.get(page.id);
                  const isSpecial = isSpecialPage(page.id);
                  return (
                    <TableRow key={page.id} className={isSpecial ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">
                        {page.label}
                        {isSpecial && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Logica speciale: visibile solo agli educatori assegnati ad almeno un gruppo.
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={pagePermissions?.visible ?? true}
                          onCheckedChange={(isChecked) => handlePermissionChange(page.id, 'visible', isChecked)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={pagePermissions?.requiresEducatorRoleCheck || false}
                          onCheckedChange={(isChecked) => handlePermissionChange(page.id, 'requiresEducatorRoleCheck', !!isChecked)}
                          disabled={!pagePermissions?.visible || isSpecial}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {isSpecial ? (
                          <span className='text-sm text-muted-foreground'>Logica Speciale</span>
                        ) : (
                          <Checkbox
                            checked={pagePermissions?.requiresGroupAssignmentCheck || false}
                            onCheckedChange={(isChecked) => handlePermissionChange(page.id, 'requiresGroupAssignmentCheck', !!isChecked)}
                            disabled={!pagePermissions?.visible}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CardDescription className="p-1 text-sm">
        <b>Visibile solo a Educatori con Ruolo Specifico:</b> Se spuntata, la pagina è visibile agli educatori solo se un loro ruolo specifico (gestito in &quot;Ruoli Educatori&quot;) ne concede l&apos;accesso.
        <br />
        <b>Visibile solo a Educatori assegnati a un Gruppo:</b> Se spuntata, la pagina è visibile agli educatori solo se sono assegnati ad almeno un gruppo (gestito in &quot;Tutti i Gruppi&quot;).
      </CardDescription>

      {/* Site Map Section */}
      <Card>
        <CardHeader>
          <CardTitle>Mappa del Sito</CardTitle>
          <CardDescription>
            Struttura completa e gerarchica di tutte le pagine e sottopagine dell&apos;applicazione. Le pagine admin sono accessibili solo agli amministratori.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            {SITE_MAP.map(node => renderSiteMapNode(node, 0))}
          </div>
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400"></span> dinamico = URL generato dai dati
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400"></span> tab = sezione interna della pagina
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400"></span> solo admin = visibile solo agli amministratori
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span> solo educatori = visibile solo agli educatori
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
