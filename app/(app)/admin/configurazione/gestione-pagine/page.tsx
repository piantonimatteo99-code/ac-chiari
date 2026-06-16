'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { useUserData } from '@/src/hooks/use-user-data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, writeBatch, query, orderBy } from 'firebase/firestore';
import {
  Home, FlaskConical, PenSquare, Building, Calendar, Warehouse, Tent,
  Landmark, ShieldCheck, Users, Share2, Shield, GraduationCap, UserCog,
  FileCog, CircleHelp, ChevronRight, FolderOpen, Gavel, Trash2,
  AlertTriangle, CheckCircle2, Loader2, GripVertical, Save, ChevronDown,
} from 'lucide-react';
import type { Group } from '../../gestione-gruppi/tutti-i-gruppi/page';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { cn } from '@/lib/utils';


export interface PagePermission {
  id: string;
  path: string;
  label: string;
  visible: boolean;
  visibleToAllEducators: boolean;
  requiresEducatorRoleCheck: boolean;
  requiresGroupAssignmentCheck: boolean;
}

const ALL_PAGES: Omit<PagePermission, 'visible' | 'visibleToAllEducators' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck'>[] = [
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
  { label: 'Progetti', path: '/progetti', icon: FlaskConical, children: [{ label: '[nome-progetto]', path: '/progetti/[slug]', badge: 'dinamico' }, { label: 'Storico', path: '/progetti/storico' }] },
  { label: 'Iscrizioni', path: '/iscrizioni', icon: PenSquare },
  { label: 'Nucleo Familiare', path: '/nucleo-familiare', icon: Building },
  { label: 'Calendario', path: '/calendario', icon: Calendar },
  { label: 'Magazzino', path: '/magazzino', icon: Warehouse },
  { label: 'Campi', path: '/campi', icon: Tent, children: [{ label: 'Case', badge: 'tab' }, { label: 'Pullman', badge: 'tab' }, { label: 'Spesa', badge: 'tab' }, { label: 'Preventivo', badge: 'tab' }] },
  { label: 'Consiglio', path: '/consiglio', icon: Gavel, badge: 'solo educatori', children: [{ label: 'Ordine del Giorno', badge: 'tab' }, { label: 'Verbali', badge: 'tab' }] },
  { label: 'Contabilità', icon: Landmark, children: [{ label: 'Conto', path: '/contabilita/conto' }, { label: 'Raccolte attive', path: '/contabilita/raccolte' }, { label: 'Transazioni da Controllare', path: '/contabilita/transazioni-da-controllare' }, { label: 'Pagamenti Contanti', path: '/contabilita/pagamenti-contanti' }, { label: 'Spese', path: '/contabilita/spese' }, { label: 'Raccolte concluse', path: '/contabilita/storico' }] },
  { label: 'Tesseramento', icon: ShieldCheck, children: [{ label: 'Tariffe', path: '/tesserati/tariffe' }, { label: 'Nuovi Iscritti', path: '/tesserati/nuovi-iscritti' }, { label: 'Tesserati', path: '/tesserati/tesserati' }, { label: 'Famiglie', path: '/tesserati/famiglie' }, { label: 'Archivio', path: '/tesserati/archivio' }] },
  { label: 'I Miei Gruppi', path: '/miei-gruppi', icon: Users, children: [{ label: '[nome-gruppo]', path: '/miei-gruppi/[slug]', badge: 'dinamico' }] },
  { label: 'Social Media', path: '/social-media', icon: Share2, badge: 'solo educatori' },
  {
    label: 'Admin Panel', icon: Shield, badge: 'solo admin',
    children: [
      { label: 'Area Educatori', icon: GraduationCap, children: [{ label: 'Educatori', path: '/admin/area-educatori/educatori' }, { label: 'Ruoli Educatori', path: '/admin/area-educatori/ruoli-educatori' }] },
      { label: 'Gestione Gruppi', icon: Users, children: [{ label: 'Tutti i Gruppi', path: '/admin/gestione-gruppi/tutti-i-gruppi' }] },
      { label: 'Gestione Utenti', icon: UserCog, children: [{ label: 'Database Utenti', path: '/admin/gestione-utenti/users' }, { label: 'Permessi', path: '/admin/gestione-utenti/permessi' }] },
      { label: 'Configurazione', icon: FileCog, children: [{ label: 'Integrazione Drive', path: '/admin/configurazione/integrazione-drive' }, { label: 'Gestione Pagine', path: '/admin/configurazione/gestione-pagine' }, { label: 'Gestione Notifiche', path: '/admin/configurazione/gestione-notifiche' }] },
      { label: 'Segnalazioni', icon: CircleHelp, children: [{ label: 'Gestione Feedback / Problemi', path: '/admin/segnalazioni' }] },
    ],
  },
];

// ─── Sottopagine statiche per ciascuna voce accordion ──────────────────────
const STATIC_SUB_ITEMS: Record<string, { id: string; label: string }[]> = {
  contabilita: [
    { id: 'contabilita-conto', label: 'Conto' },
    { id: 'contabilita-raccolte', label: 'Raccolte attive' },
    { id: 'contabilita-transazioni-da-controllare', label: 'Transazioni da Controllare' },
    { id: 'contabilita-pagamenti-contanti', label: 'Pagamenti Contanti' },
    { id: 'contabilita-spese', label: 'Spese' },
    { id: 'contabilita-storico', label: 'Raccolte concluse' },
  ],
  tesserati: [
    { id: 'tesserati-tariffe', label: 'Tariffe' },
    { id: 'tesserati-nuovi-iscritti', label: 'Nuovi Iscritti' },
    { id: 'tesserati-tesserati', label: 'Tesserati' },
    { id: 'tesserati-famiglie', label: 'Famiglie' },
    { id: 'tesserati-archivio', label: 'Archivio' },
  ],
  campi: [
    { id: 'campi-piatti', label: 'Piatti' },
    { id: 'campi-pullman', label: 'Pullman' },
    { id: 'campi-case', label: 'Case' },
  ],
  admin: [
    { id: 'admin-area-educatori', label: 'Area Educatori' },
    { id: 'admin-gestione-gruppi', label: 'Gestione Gruppi' },
    { id: 'admin-gestione-utenti', label: 'Gestione Utenti' },
    { id: 'admin-configurazione', label: 'Configurazione' },
    { id: 'admin-segnalazioni', label: 'Segnalazioni' },
  ],
};

const DEFAULT_SUB_ORDERS: Record<string, string[]> = {
  contabilita: ['contabilita-conto', 'contabilita-raccolte', 'contabilita-transazioni-da-controllare', 'contabilita-pagamenti-contanti', 'contabilita-spese', 'contabilita-storico'],
  tesserati: ['tesserati-tariffe', 'tesserati-nuovi-iscritti', 'tesserati-tesserati', 'tesserati-famiglie', 'tesserati-archivio'],
  campi: ['campi-piatti', 'campi-pullman', 'campi-case'],
  admin: ['admin-area-educatori', 'admin-gestione-gruppi', 'admin-gestione-utenti', 'admin-configurazione', 'admin-segnalazioni'],
};

const DEFAULT_NAV_ORDER: string[] = ['dashboard', 'progetti', 'iscrizioni', 'nucleo-familiare', 'calendario', 'magazzino', 'campi', 'consiglio', 'contabilita', 'tesserati', 'miei-gruppi', 'social-media', 'admin'];

const DEFAULT_GROUP_ORDER: string[] = ['Seconda elementare', 'Terza elementare', 'Quarta elementare', 'Quinta elementare', 'Prima media', 'Seconda media', 'Terza media', 'ACG', 'EDU', 'Adulti'];

const NAV_ITEM_META: Record<string, { label: string; icon?: React.ElementType }> = {
  dashboard: { label: 'Dashboard', icon: Home },
  progetti: { label: 'Progetti', icon: FlaskConical },
  iscrizioni: { label: 'Iscrizioni', icon: PenSquare },
  'nucleo-familiare': { label: 'Nucleo Familiare', icon: Building },
  calendario: { label: 'Calendario', icon: Calendar },
  magazzino: { label: 'Magazzino', icon: Warehouse },
  campi: { label: 'Campi', icon: Tent },
  consiglio: { label: 'Consiglio', icon: Gavel },
  contabilita: { label: 'Contabilità', icon: Landmark },
  tesserati: { label: 'Tesseramento', icon: ShieldCheck },
  'miei-gruppi': { label: 'I Miei Gruppi', icon: Users },
  'social-media': { label: 'Social Media', icon: Share2 },
  admin: { label: 'Admin Panel', icon: Shield },
};

// ─── Simple sortable row (sub-items) ───────────────────────────────────────
function SortableRow({ id, label, icon: Icon }: { id: string; label: string; icon?: React.ElementType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.8 : 1 };
  return (
    <div ref={setNodeRef} style={style} className={cn('flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm select-none', isDragging ? 'shadow-lg border-primary/40 bg-primary/5' : 'border-border')}>
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0" aria-label="Trascina per riordinare">
        <GripVertical className="h-4 w-4" />
      </button>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      <span className="flex-1 font-medium">{label}</span>
    </div>
  );
}

// ─── Expandable sortable row (top-level nav items with optional sub-items) ──
interface ExpandableNavRowProps {
  id: string;
  label: string;
  icon?: React.ElementType;
  subItems: { id: string; label: string }[];      // items to show in the nested list
  currentSubOrder: string[];                        // IDs in current order
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSubDragEnd: (event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
  subLabel?: string;                                // custom label for the expand button
}

function ExpandableNavRow({ id, label, icon: Icon, subItems, currentSubOrder, isExpanded, onToggleExpand, onSubDragEnd, sensors, subLabel }: ExpandableNavRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, opacity: isDragging ? 0.8 : 1 };
  const hasSubItems = subItems.length > 0;
  const count = subItems.length;

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div className={cn('flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm select-none', isDragging ? 'shadow-lg border-primary/40 bg-primary/5' : 'border-border')}>
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0" aria-label="Trascina per riordinare">
          <GripVertical className="h-4 w-4" />
        </button>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="flex-1 font-medium">{label}</span>
        {hasSubItems && !isDragging && (
          <button onClick={onToggleExpand} className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
            <span>{subLabel ?? `${count} sottopagine`}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isExpanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {isExpanded && hasSubItems && !isDragging && (
        <div className="ml-8 mt-1.5 mb-1">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={currentSubOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1">
                {currentSubOrder.map(subId => {
                  const subMeta = subItems.find(s => s.id === subId);
                  if (!subMeta) return null;
                  return <SortableRow key={subId} id={subId} label={subMeta.label} />;
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function GestionePaginePage() {
  const firestore = useFirestore();
  const { userData, isLoading: isUserLoading } = useUserData();
  const isAdmin = userData?.roles?.includes('admin') ?? false;

  // ── Reset test data ──────────────────────────────────────────────────────
  const [showResetConfirm1, setShowResetConfirm1] = useState(false);
  const [showResetConfirm2, setShowResetConfirm2] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; deleted?: Record<string, number>; error?: string } | null>(null);

  const handleReset = async () => {
    setShowResetConfirm2(false);
    setIsResetting(true);
    setResetResult(null);
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Utente non autenticato');
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/reset-test-data', { method: 'POST', headers: { 'x-admin-token': idToken } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore sconosciuto');
      setResetResult({ success: true, deleted: data.deleted });
    } catch (e: any) {
      setResetResult({ success: false, error: e.message });
    } finally {
      setIsResetting(false);
    }
  };

  // ── Page permissions ──────────────────────────────────────────────────────
  const permissionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'page-settings') : null, [firestore]);
  const { data: permissionsData, isLoading } = useCollection<PagePermission>(permissionsQuery);

  // ── Nav order document ────────────────────────────────────────────────────
  const navOrderRef = useMemoFirebase(() => firestore ? doc(firestore, 'settings', 'nav-order') : null, [firestore]);
  const { data: navOrderDoc, isLoading: isLoadingNavOrder } = useDoc<{ order: string[]; subOrder?: Record<string, string[]> }>(navOrderRef);

  // ── Groups (for I Miei Gruppi sub-items) ─────────────────────────────────
  const groupsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'gruppi') : null, [firestore]);
  const { data: groups, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);

  // ── Local state: nav + sub order (unified) ───────────────────────────────
  const [navOrder, setNavOrder] = useState<string[]>(DEFAULT_NAV_ORDER);
  const [subOrder, setSubOrder] = useState<Record<string, string[]>>(DEFAULT_SUB_ORDERS);
  const [groupOrder, setGroupOrder] = useState<Group[]>([]);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize nav order from Firestore
  useEffect(() => {
    if (!isLoadingNavOrder) {
      if (navOrderDoc?.order && navOrderDoc.order.length > 0) {
        const saved = navOrderDoc.order;
        const missing = DEFAULT_NAV_ORDER.filter(id => !saved.includes(id));
        setNavOrder([...saved, ...missing]);
      } else {
        setNavOrder(DEFAULT_NAV_ORDER);
      }
      const savedSub = navOrderDoc?.subOrder ?? {};
      const merged: Record<string, string[]> = { ...DEFAULT_SUB_ORDERS };
      Object.keys(STATIC_SUB_ITEMS).forEach(parentId => {
        const saved = savedSub[parentId];
        if (saved && saved.length > 0) {
          const defaults = DEFAULT_SUB_ORDERS[parentId] ?? [];
          const missing = defaults.filter(id => !saved.includes(id));
          merged[parentId] = [...saved, ...missing];
        }
      });
      setSubOrder(merged);
      setIsDirty(false);
    }
  }, [isLoadingNavOrder, navOrderDoc]);

  // Initialize group order from Firestore
  useEffect(() => {
    if (!isLoadingGroups && groups) {
      const sorted = [...groups].sort((a, b) => {
        const hasSortOrderA = a.sortOrder !== undefined && a.sortOrder !== null;
        const hasSortOrderB = b.sortOrder !== undefined && b.sortOrder !== null;
        if (hasSortOrderA && hasSortOrderB) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (hasSortOrderA) return -1;
        if (hasSortOrderB) return 1;
        const ia = DEFAULT_GROUP_ORDER.indexOf(a.name);
        const ib = DEFAULT_GROUP_ORDER.indexOf(b.name);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
      setGroupOrder(sorted);
    }
  }, [isLoadingGroups, groups]);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNavDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setNavOrder(prev => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
      setIsDirty(true);
    }
  }, []);

  const handleSubDragEnd = useCallback((parentId: string, event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSubOrder(prev => {
        const items = prev[parentId] ?? DEFAULT_SUB_ORDERS[parentId] ?? [];
        return { ...prev, [parentId]: arrayMove(items, items.indexOf(String(active.id)), items.indexOf(String(over.id))) };
      });
      setIsDirty(true);
    }
  }, []);

  // Special handler for groups (sub-items of 'miei-gruppi')
  const handleGroupSubDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGroupOrder(prev => {
        const oldIdx = prev.findIndex(g => g.id === String(active.id));
        const newIdx = prev.findIndex(g => g.id === String(over.id));
        return arrayMove(prev, oldIdx, newIdx);
      });
      setIsDirty(true);
    }
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Unified save: nav order + sub order + group sort order
  const handleSave = async () => {
    if (!firestore || !navOrderRef) return;
    setIsSaving(true);
    try {
      // 1. Save nav + subOrder document
      await setDoc(navOrderRef, { order: navOrder, subOrder }, { merge: true });

      // 2. Save group sortOrder if groups are loaded
      if (groupOrder.length > 0) {
        const batch = writeBatch(firestore);
        groupOrder.forEach((group, idx) => {
          batch.update(doc(firestore, 'gruppi', group.id), { sortOrder: idx });
        });
        await batch.commit();
      }

      setIsDirty(false);
    } catch (e) {
      console.error('Errore salvataggio ordine:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Auto-initialize page-settings ────────────────────────────────────────
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
          const newPermission: PagePermission = { ...page, visible: true, visibleToAllEducators: false, requiresEducatorRoleCheck, requiresGroupAssignmentCheck: page.id === 'miei-gruppi' };
          batch.set(doc(firestore, 'page-settings', page.id), newPermission);
          writes++;
        }
      });
      if (writes > 0) batch.commit().catch(console.error);
    }
  }, [isLoading, permissionsData, firestore]);

  const permissionsMap = useMemo(() => {
    if (!permissionsData) return new Map<string, PagePermission>();
    return new Map(permissionsData.map(p => [p.id, p]));
  }, [permissionsData]);

  const handlePermissionChange = async (
    pageId: string,
    field: 'visible' | 'visibleToAllEducators' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck',
    value: boolean,
  ) => {
    if (!firestore) return;
    const current = permissionsMap.get(pageId);
    if (!current) return;
    await setDoc(doc(firestore, 'page-settings', pageId), { ...current, [field]: value }, { merge: true });
  };

  const isSpecialPage = (id: string) => id === 'miei-gruppi';

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isUserLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Accesso negato</h2>
        <p className="text-muted-foreground">Questa pagina è riservata agli amministratori.</p>
      </div>
    );
  }

  // ── Site map renderer ─────────────────────────────────────────────────────
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
        <div className={`flex items-center gap-2 py-1.5 rounded-md ${depth === 0 ? 'font-semibold text-foreground text-sm' : depth === 1 && isGroup ? 'font-medium text-foreground/80 text-sm' : 'text-muted-foreground text-sm'}`}>
          {Icon && depth === 0 && <Icon className="h-4 w-4 text-primary shrink-0" />}
          {!Icon && depth === 0 && <FolderOpen className="h-4 w-4 text-primary shrink-0" />}
          {depth > 0 && !isGroup && <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
          {depth > 0 && isGroup && Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {depth > 0 && isGroup && !Icon && <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span>{node.label}</span>
          {node.path && <span className="text-[10px] text-muted-foreground/60 font-mono hidden md:inline">{node.path}</span>}
          {node.badge && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeColors[node.badge] ?? 'bg-muted text-muted-foreground'}`}>{node.badge}</span>}
        </div>
        {hasChildren && <div>{node.children!.map(child => renderSiteMapNode(child, depth + 1))}</div>}
      </div>
    );
  };

  const isPageLoading = isLoadingNavOrder || isLoadingGroups;

  return (
    <div className="flex flex-col gap-8">

      {/* ── Gestione Visibilità Pagine ──────────────────────────────────────── */}
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
                <TableHead className="text-center w-[200px]">Visibile Educatori</TableHead>
                <TableHead className="text-center w-[200px]">Solo Educatori con Ruolo Specifico</TableHead>
                <TableHead className="text-center w-[200px]">Solo Educatori assegnati a Gruppo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Caricamento...</TableCell></TableRow>
              ) : (
                ALL_PAGES.map((page) => {
                  const pagePermissions = permissionsMap.get(page.id);
                  const isSpecial = isSpecialPage(page.id);
                  return (
                    <TableRow key={page.id} className={isSpecial ? 'bg-muted/30' : ''}>
                      <TableCell className="font-medium">
                        {page.label}
                        {isSpecial && <p className="text-xs text-muted-foreground mt-1">Logica speciale: visibile solo agli educatori assegnati ad almeno un gruppo.</p>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={pagePermissions?.visible ?? true} onCheckedChange={(v) => handlePermissionChange(page.id, 'visible', v)} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={pagePermissions?.visibleToAllEducators || false} onCheckedChange={(v) => handlePermissionChange(page.id, 'visibleToAllEducators', !!v)} disabled={!pagePermissions?.visible} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={pagePermissions?.requiresEducatorRoleCheck || false} onCheckedChange={(v) => handlePermissionChange(page.id, 'requiresEducatorRoleCheck', !!v)} disabled={!pagePermissions?.visible || isSpecial} />
                      </TableCell>
                      <TableCell className="text-center">
                        {isSpecial ? (
                          <span className="text-sm text-muted-foreground">Logica Speciale</span>
                        ) : (
                          <Checkbox checked={pagePermissions?.requiresGroupAssignmentCheck || false} onCheckedChange={(v) => handlePermissionChange(page.id, 'requiresGroupAssignmentCheck', !!v)} disabled={!pagePermissions?.visible} />
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
        <b>Visibile Educatori:</b> Pagina visibile a tutti gli utenti con il ruolo educatore.<br />
        <b>Solo Educatori con Ruolo Specifico:</b> Visibile agli educatori solo se un loro ruolo specifico ne concede l&apos;accesso.<br />
        <b>Solo Educatori assegnati a Gruppo:</b> Visibile agli educatori solo se assegnati ad almeno un gruppo.
      </CardDescription>

      {/* ── Ordine Sidebar (voci + sottopagine + gruppi unificati) ─────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Ordine Sidebar — Voci e Sottopagine</CardTitle>
              <CardDescription className="mt-1">
                Trascina le voci per cambiare l&apos;ordine nella barra laterale. Clicca il pulsante{' '}
                <strong>«▼»</strong> per espandere e riordinare anche le sottopagine interne.
                I gruppi di <strong>I Miei Gruppi</strong> sono anch&apos;essi riordinabili espandendo la voce.
              </CardDescription>
            </div>
            <Button onClick={handleSave} disabled={!isDirty || isSaving || isPageLoading} size="sm" className="shrink-0">
              {isSaving ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Salvataggio...</> : <><Save className="mr-2 h-3.5 w-3.5" />Salva Ordine</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isPageLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Caricamento...
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd} modifiers={[restrictToVerticalAxis]}>
              <SortableContext items={navOrder} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  {navOrder.map(id => {
                    const meta = NAV_ITEM_META[id];
                    if (!meta) return null;

                    // ── Special case: I Miei Gruppi → show dynamic groups as sub-items
                    if (id === 'miei-gruppi') {
                      const groupSubItems = groupOrder.map(g => ({ id: g.id, label: g.name }));
                      const groupSubOrder = groupOrder.map(g => g.id);
                      const subLabel = groupOrder.length > 0 ? `${groupOrder.length} gruppi` : 'nessun gruppo';
                      return (
                        <ExpandableNavRow
                          key={id}
                          id={id}
                          label={meta.label}
                          icon={meta.icon}
                          subItems={groupSubItems}
                          currentSubOrder={groupSubOrder}
                          isExpanded={expandedParents.has(id)}
                          onToggleExpand={() => toggleExpanded(id)}
                          onSubDragEnd={handleGroupSubDragEnd}
                          sensors={sensors}
                          subLabel={subLabel}
                        />
                      );
                    }

                    // ── Static sub-items (Contabilità, Tesseramento, Campi)
                    const staticSub = STATIC_SUB_ITEMS[id] ?? [];
                    const currentSub = subOrder[id] ?? DEFAULT_SUB_ORDERS[id] ?? [];
                    return (
                      <ExpandableNavRow
                        key={id}
                        id={id}
                        label={meta.label}
                        icon={meta.icon}
                        subItems={staticSub}
                        currentSubOrder={currentSub}
                        isExpanded={expandedParents.has(id)}
                        onToggleExpand={() => toggleExpanded(id)}
                        onSubDragEnd={(e) => handleSubDragEnd(id, e)}
                        sensors={sensors}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {isDirty && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Hai modifiche non salvate. Clicca «Salva Ordine» per applicarle.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Mappa del Sito ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Mappa del Sito</CardTitle>
          <CardDescription>Struttura completa di tutte le pagine dell&apos;applicazione.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            {SITE_MAP.map(node => renderSiteMapNode(node, 0))}
          </div>
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400"></span> dinamico = URL generato dai dati</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400"></span> tab = sezione interna della pagina</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400"></span> solo admin = visibile solo agli amministratori</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span> solo educatori = visibile solo agli educatori</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Zona di Pericolo ─────────────────────────────────────────────── */}
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Zona di Pericolo — Reset Dati di Test</CardTitle>
          </div>
          <CardDescription>
            Elimina <strong>tutti i dati inseriti</strong> durante i test: gruppi, eventi, raccolte, spese, notifiche, magazzino, presenze, movimenti contanti, campi, ecc.<br />
            Vengono eliminati anche <strong>tutti gli utenti registrati</strong> (Firebase Auth + profili) e i loro <strong>nuclei familiari</strong> — incluso il nucleo dell&apos;account admin
            (<code className="text-xs bg-muted px-1 py-0.5 rounded">piantonimatteo.99@gmail.com</code>).<br />
            La <strong>configurazione</strong> del sistema viene conservata. Questa operazione è <strong className="text-destructive">irreversibile</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {resetResult && (
            <div className={`rounded-lg border p-4 text-sm ${resetResult.success ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' : 'bg-destructive/10 border-destructive/30 text-destructive'}`}>
              {resetResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Reset completato!</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs font-mono mt-2">
                    {Object.entries(resetResult.deleted ?? {}).map(([col, count]) => <span key={col} className="truncate"><span className="font-semibold">{col}:</span> {count < 0 ? 'errore' : `${count} doc`}</span>)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Errore: {resetResult.error}</div>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button variant="destructive" disabled={isResetting} onClick={() => { setShowResetConfirm1(true); setResetResult(null); }}>
              {isResetting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reset in corso...</> : <><Trash2 className="mr-2 h-4 w-4" />Resetta tutti i dati di test</>}
            </Button>
            <span className="text-xs text-muted-foreground">Tutti gli utenti e i nuclei familiari verranno eliminati. Viene conservato solo l&apos;account admin e la configurazione.</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showResetConfirm1} onOpenChange={setShowResetConfirm1}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Sei sicuro di voler resettare?</DialogTitle>
            <DialogDescription className="pt-2">
              Stai per eliminare <strong>tutti i dati di test</strong>: gruppi, eventi, raccolte, spese, pagamenti, notifiche, presenze, magazzino, campi.<br /><br />
              Verranno eliminati anche <strong>tutti gli account utente</strong> e i loro nuclei familiari (incluso il nucleo dell&apos;admin). La configurazione verrà conservata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetConfirm1(false)}>Annulla</Button>
            <Button variant="destructive" onClick={() => { setShowResetConfirm1(false); setShowResetConfirm2(true); }}>Sì, continua</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirm2} onOpenChange={setShowResetConfirm2}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Ultima conferma — operazione irreversibile</DialogTitle>
            <DialogDescription className="pt-2">
              Cliccando <strong>«Elimina tutto»</strong> tutti i dati di test verranno cancellati definitivamente. Non è possibile annullare.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetConfirm2(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleReset}><Trash2 className="mr-2 h-4 w-4" />Elimina tutto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
