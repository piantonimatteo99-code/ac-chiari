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
import { Terminal } from 'lucide-react';
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
