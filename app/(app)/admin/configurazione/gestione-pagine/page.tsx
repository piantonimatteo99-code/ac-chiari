'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/src/firebase';
import { collection, doc, setDoc, getDocs, writeBatch, collectionGroup, deleteField, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Home, FlaskConical, PenSquare, Building, Calendar, Warehouse, Tent, Landmark, ShieldCheck, Users, Share2, Shield, GraduationCap, UserCog, FileCog, CircleHelp, ChevronRight, FolderOpen } from 'lucide-react';
import type { Group } from '../../gestione-gruppi/tutti-i-gruppi/page';
import { ref, getMetadata } from "firebase/storage";


export interface PagePermission {
  id: string; 
  path: string;
  label: string;
  visible: boolean; // Global visibility switch
  requiresEducatorRoleCheck: boolean; // Check against specific educator roles
  requiresGroupAssignmentCheck: boolean; // Check if educator is assigned to any group
}

// All pages available for permission settings
const ALL_PAGES: Omit<PagePermission, 'visible' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck'>[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'progetti', label: 'Progetti', path: '/progetti' },
  { id: 'iscrizioni', label: 'Iscrizioni', path: '/iscrizioni' },
  { id: 'nucleo-familiare', label: 'Nucleo Familiare', path: '/nucleo-familiare' },
  { id: 'calendario', label: 'Calendario', path: '/calendario' },
  { id: 'magazzino', label: 'Magazzino', path: '/magazzino' },
  { id: 'campi', label: 'Campi', path: '/campi' },
  { id: 'social-media', label: 'Social Media', path: '/social-media' },
  { id: 'contabilita-conto', label: 'Contabilità / Conto', path: '/contabilita/conto' },
  { id: 'contabilita-transazioni-da-controllare', label: 'Contabilità / Transazioni da Controllare', path: '/contabilita/transazioni-da-controllare' },
  { id: 'contabilita-raccolte', label: 'Contabilità / Raccolte', path: '/contabilita/raccolte' },
  { id: 'contabilita-spese', label: 'Contabilità / Spese', path: '/contabilita/spese' },
  { id: 'contabilita-pagamenti-contanti', label: 'Contabilità / Pagamenti Contanti', path: '/contabilita/pagamenti-contanti'},
  { id: 'contabilita-storico', label: 'Contabilità / Storico', path: '/contabilita/storico' },
  { id: 'tesserati-tariffe', label: 'Tesserati / Tariffe', path: '/tesserati/tariffe' },
  { id: 'tesserati-nuovi-iscritti', label: 'Tesserati / Nuovi Iscritti', path: '/tesserati/nuovi-iscritti' },
  { id: 'tesserati-tesserati', label: 'Tesserati / Tesserati', path: '/tesserati/tesserati' },
  { id: 'tesserati-famiglie', label: 'Tesserati / Famiglie', path: '/tesserati/famiglie' },
  { id: 'tesserati-archivio', label: 'Tesserati / Archivio', path: '/tesserati/archivio' },
  { id: 'miei-gruppi', label: 'I Miei Gruppi', path: '/miei-gruppi' },
];

// Site map data structure for the visual map section
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
  const storage = useStorage();
  const [memberMigrationStatus, setMemberMigrationStatus] = useState('');
  const [isMigratingMembers, setIsMigratingMembers] = useState(false);
  const [raccolteStructureMigrationStatus, setRaccolteStructureMigrationStatus] = useState('');
  const [isMigratingRaccolteStructure, setIsMigratingRaccolteStructure] = useState(false);
  const [cleanGenerateStatus, setCleanGenerateStatus] = useState('');
  const [isCleaningGenerate, setIsCleaningGenerate] = useState(false);
  const [receiptSyncStatus, setReceiptSyncStatus] = useState('');
  const [isSyncingReceipts, setIsSyncingReceipts] = useState(false);

  const permissionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'page-settings');
  }, [firestore]);

  const { data: permissionsData, isLoading } = useCollection<PagePermission>(permissionsQuery);

  // Initialize permissions on first load if they don't exist
  useEffect(() => {
    if (!isLoading && firestore && permissionsData) {
      const existingIds = new Set(permissionsData.map(p => p.id));
      const batch = writeBatch(firestore);
      let writes = 0;

      ALL_PAGES.forEach(page => {
        if (!existingIds.has(page.id)) {
          let requiresEducatorRoleCheck = false;
          // Set default check for tesserati pages
          if (['tesserati-nuovi-iscritti', 'tesserati-tesserati', 'tesserati-famiglie', 'contabilita-conto', 'contabilita-raccolte', 'contabilita-spese', 'contabilita-pagamenti-contanti', 'contabilita-storico', 'tesserati-archivio', 'contabilita-transazioni-da-controllare'].includes(page.id)) {
            requiresEducatorRoleCheck = true;
          }

          const newPermission: PagePermission = {
            ...page,
            visible: true,
            requiresEducatorRoleCheck: requiresEducatorRoleCheck,
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

  const handlePermissionChange = async (pageId: string, field: 'visible' | 'requiresEducatorRoleCheck' | 'requiresGroupAssignmentCheck', value: boolean) => {
    if (!firestore) return;

    const currentPermissions = permissionsMap.get(pageId);
    if (!currentPermissions) return;

    const updatedPermissions: PagePermission = { ...currentPermissions, [field]: value };
    
    const pageDocRef = doc(firestore, 'page-settings', pageId);
    await setDoc(pageDocRef, updatedPermissions, { merge: true });
  };
  
  const handleMemberDataMigration = async () => {
    if (!firestore) {
      setMemberMigrationStatus('Errore: database non disponibile.');
      return;
    }
    setIsMigratingMembers(true);
    setMemberMigrationStatus('Avvio della migrazione... (potrebbe richiedere qualche istante)');

    try {
        const batch = writeBatch(firestore);

        // 1. Get all groups and create a map from memberId to group info
        const groupsSnapshot = await getDocs(collection(firestore, 'gruppi'));
        const memberToGroupMap = new Map<string, { groupId: string; groupName: string }>();
        groupsSnapshot.forEach(groupDoc => {
            const groupData = groupDoc.data() as Group;
            if (groupData.memberIds) {
                groupData.memberIds.forEach(memberId => {
                    memberToGroupMap.set(memberId, { groupId: groupDoc.id, groupName: groupData.name });
                });
            }
        });

        // 2. Get all members from the collection group
        const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
        let membersUpdated = 0;
        let inconsistenciesFixed = 0;

        membersSnapshot.forEach(memberDoc => {
            const memberData = memberDoc.data();
            const memberId = memberDoc.id;
            let needsUpdate = false;
            const updates: { [key: string]: any } = {};

            // 2a. Check and fix 'archived' field
            if (memberData.archived === undefined) {
                updates.archived = false;
                needsUpdate = true;
            }

            // 2b. Check and fix group assignment fields
            const groupInfo = memberToGroupMap.get(memberId);
            if (groupInfo) {
                // Member SHOULD be in a group
                if (memberData.groupId !== groupInfo.groupId || memberData.groupName !== groupInfo.groupName) {
                    updates.groupId = groupInfo.groupId;
                    updates.groupName = groupInfo.groupName;
                    needsUpdate = true;
                    inconsistenciesFixed++;
                }
            } else {
                // Member SHOULD NOT be in a group
                if (memberData.groupId || memberData.groupName) {
                    updates.groupId = deleteField();
                    updates.groupName = deleteField();
                    needsUpdate = true;
                    inconsistenciesFixed++;
                }
            }

            if (needsUpdate) {
                batch.update(memberDoc.ref, updates);
                membersUpdated++;
            }
        });

        if (membersUpdated > 0) {
            await batch.commit();
            setMemberMigrationStatus(`Migrazione completata! ${membersUpdated} membri sono stati analizzati. Trovate e corrette ${inconsistenciesFixed} inconsistenze di gruppo. Tutti i membri ora hanno il campo 'archived'.`);
        } else {
            setMemberMigrationStatus('Nessun membro da aggiornare. I dati sono già corretti e allineati!');
        }

    } catch (error) {
        console.error('Errore durante la migrazione dati membri:', error);
        setMemberMigrationStatus(`Si è verificato un errore: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsMigratingMembers(false);
    }
  };

   const handleRaccolteStructureMigration = async () => {
    if (!firestore) {
      setRaccolteStructureMigrationStatus('Errore: database non disponibile.');
      return;
    }
    setIsMigratingRaccolteStructure(true);
    setRaccolteStructureMigrationStatus('Avvio allineamento struttura raccolte...');

    try {
        const batch = writeBatch(firestore);
        const raccolteSnapshot = await getDocs(collection(firestore, 'raccolte'));
        let updatedCount = 0;

        raccolteSnapshot.forEach(doc => {
            const data = doc.data();
            const updates: { [key: string]: any } = {};
            let needsUpdate = false;

            if ('partecipanti' in data) {
                updates.partecipanti = deleteField();
                needsUpdate = true;
            }

            if (data.confermatiIds === undefined) {
                updates.confermatiIds = [];
                needsUpdate = true;
            }
             if (data.caparraPaidIds === undefined) {
                updates.caparraPaidIds = [];
                needsUpdate = true;
            }
             if (data.saldoPaidIds === undefined) {
                updates.saldoPaidIds = [];
                needsUpdate = true;
            }

            if (needsUpdate) {
                batch.update(doc.ref, updates);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            setRaccolteStructureMigrationStatus(`Allineamento completato! ${updatedCount} raccolte sono state aggiornate alla nuova struttura dati (confermatiIds, caparraPaidIds, saldoPaidIds).`);
        } else {
            setRaccolteStructureMigrationStatus('Tutte le raccolte hanno già la struttura dati corretta. Nessuna modifica necessaria.');
        }
    } catch (error) {
        console.error('Errore during l\'allineamento della struttura delle raccolte:', error);
        setRaccolteStructureMigrationStatus(`Si è verificato un errore: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        setIsMigratingRaccolteStructure(false);
    }
  };
  
    const handleCleanGenerateCollection = async () => {
        if (!firestore) {
            setCleanGenerateStatus('Errore: database non disponibile.');
            return;
        }
        setIsCleaningGenerate(true);
        setCleanGenerateStatus('Pulizia della coda di analisi AI in corso...');

        try {
            const batch = writeBatch(firestore);
            const generateSnapshot = await getDocs(collection(firestore, 'generate'));
            const count = generateSnapshot.size;
            
            if(count === 0) {
                 setCleanGenerateStatus('La coda di analisi è già vuota. Nessuna operazione eseguita.');
                 setIsCleaningGenerate(false);
                 return;
            }
            
            generateSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            setCleanGenerateStatus(`Pulizia completata! ${count} richieste di analisi sono state rimosse dalla coda.`);
        } catch (error) {
            console.error('Errore during la pulizia della collezione "generate":', error);
            setCleanGenerateStatus(`Si è verificato un errore durante la pulizia: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsCleaningGenerate(false);
        }
    };
    
    const handleReceiptLinkSync = async () => {
        if (!firestore || !storage) {
            setReceiptSyncStatus('Errore: database o storage non disponibile.');
            return;
        }
        setIsSyncingReceipts(true);
        setReceiptSyncStatus('Avvio sincronizzazione link ricevute...');

        try {
            const batch = writeBatch(firestore);
            const raccolteSnapshot = await getDocs(collection(firestore, 'raccolte'));
            let checkedLinks = 0;
            let brokenLinksFixed = 0;

            for (const raccoltaDoc of raccolteSnapshot.docs) {
                const raccolta = raccoltaDoc.data();
                const updates: { [key: string]: any } = {};

                const checkPhase = async (phase: 'caparra' | 'saldo') => {
                    if (raccolta.paymentDetails?.[phase]) {
                        for (const memberId in raccolta.paymentDetails[phase]) {
                            const payment = raccolta.paymentDetails[phase][memberId];
                            if (payment.receiptUrl) {
                                checkedLinks++;
                                try {
                                    const storageRef = ref(storage, payment.receiptUrl);
                                    await getMetadata(storageRef);
                                } catch (error: any) {
                                    if (error.code === 'storage/object-not-found') {
                                        brokenLinksFixed++;
                                        const fieldPath = `paymentDetails.${phase}.${memberId}.receiptUrl`;
                                        updates[fieldPath] = deleteField();
                                    }
                                }
                            }
                        }
                    }
                };

                await checkPhase('caparra');
                await checkPhase('saldo');

                if (Object.keys(updates).length > 0) {
                    batch.update(raccoltaDoc.ref, updates);
                }
            }

            if (brokenLinksFixed > 0) {
                await batch.commit();
            }

            setReceiptSyncStatus(`Sincronizzazione completata! Controllati ${checkedLinks} link. Trovati e rimossi ${brokenLinksFixed} link non più validi.`);

        } catch (error) {
            console.error('Errore during la sincronizzazione dei link delle ricevute:', error);
            setReceiptSyncStatus(`Si è verificato un errore: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsSyncingReceipts(false);
        }
    };


  const isSpecialPage = (id: string) => id === 'miei-gruppi';
  
  const renderSiteMapNode = (node: SiteMapNode, depth = 0) => {
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
                )
              })
            )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CardDescription className="p-1 text-sm">
        <b>Visibile solo a Educatori con Ruolo Specifico:</b> Se spuntata, la pagina è visibile agli educatori solo se un loro ruolo specifico (gestito in "Ruoli Educatori") ne concede l'accesso.
        <br/>
        <b>Visibile solo a Educatori assegnati a un Gruppo:</b> Se spuntata, la pagina è visibile agli educatori solo se sono assegnati ad almeno un gruppo (gestito in "Tutti i Gruppi").
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

      <Card>
        <CardHeader>
            <CardTitle>Manutenzione Dati</CardTitle>
            <CardDescription>
                Usa questi strumenti per correggere e allineare i dati dell'applicazione. Esegui queste operazioni se riscontri problemi o inconsistenze.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className='flex items-center gap-4'>
                <Button onClick={handleMemberDataMigration} disabled={isMigratingMembers}>
                    {isMigratingMembers ? 'Allineamento in corso...' : "Allinea Dati Membri"}
                </Button>
                <p className='text-sm text-muted-foreground'>
                    Aggiunge `archived: false` e sincronizza `groupId` e `groupName` per tutti i membri.
                </p>
            </div>
             {memberMigrationStatus && (
                <Alert className='mt-4'>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Stato Correzione Membri</AlertTitle>
                    <AlertDescription>
                        {memberMigrationStatus}
                    </AlertDescription>
                </Alert>
            )}
            
            <div className='flex items-center gap-4 pt-6 border-t'>
                <Button onClick={handleRaccolteStructureMigration} disabled={isMigratingRaccolteStructure}>
                    {isMigratingRaccolteStructure ? 'Allineamento in corso...' : "Allinea Struttura Raccolte"}
                </Button>
                <p className='text-sm text-muted-foreground'>
                    Rimuove il vecchio campo `partecipanti` e aggiunge i nuovi array (`confermatiIds`, `caparraPaidIds`, `saldoPaidIds`).
                </p>
            </div>
             {raccolteStructureMigrationStatus && (
                <Alert className='mt-4'>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Stato Allineamento Struttura Raccolte</AlertTitle>
                    <AlertDescription>
                        {raccolteStructureMigrationStatus}
                    </AlertDescription>
                </Alert>
            )}
            
             <div className='flex items-center gap-4 pt-6 border-t'>
                <Button onClick={handleReceiptLinkSync} disabled={isSyncingReceipts}>
                    {isSyncingReceipts ? 'Sincronizzazione in corso...' : "Sincronizza Link Ricevute"}
                </Button>
                <p className='text-sm text-muted-foreground'>
                    Verifica i link alle ricevute e rimuove quelli non più validi (file eliminati).
                </p>
            </div>
             {receiptSyncStatus && (
                <Alert className='mt-4'>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Stato Sincronizzazione Ricevute</AlertTitle>
                    <AlertDescription>
                        {receiptSyncStatus}
                    </AlertDescription>
                </Alert>
            )}

            <div className='flex items-center gap-4 pt-6 border-t'>
                <Button onClick={handleCleanGenerateCollection} disabled={isCleaningGenerate} variant="destructive">
                    {isCleaningGenerate ? 'Pulizia in corso...' : "Pulisci Coda Analisi AI"}
                </Button>
                <p className='text-sm text-muted-foreground'>
                    Forza la rimozione di tutte le richieste di analisi di ricevute bloccate o in errore.
                </p>
            </div>
             {cleanGenerateStatus && (
                <Alert className='mt-4'>
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Stato Pulizia Coda Analisi</AlertTitle>
                    <AlertDescription>
                        {cleanGenerateStatus}
                    </AlertDescription>
                </Alert>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
