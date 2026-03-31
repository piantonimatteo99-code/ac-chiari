'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, writeBatch, getDocs, collectionGroup, getDoc, query, where } from 'firebase/firestore';
import type { Membro } from '../../nucleo-familiare/page';
import type { Group } from '../../admin/gestione-gruppi/tutti-i-gruppi/page';
import type { ImportedMember } from '../../admin/gestione-utenti/utenti-registrati/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, ArchiveRestore, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { UserData, useUserData } from '@/src/hooks/use-user-data';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UnifiedMember extends Partial<Membro>, Partial<UserData> {
  id: string;
  nome?: string;
  cognome?: string;
  dataNascita?: string;
  archived?: boolean;
  groupId?: string;
  tesseramento?: number;
  docPath?: string;
}

interface MatchSuggestion {
  placeholder: ImportedMember;
  realMember: UnifiedMember;
  score: number;
}

// ─── Similarity (same algorithm as utenti-registrati) ─────────────────────────
function levenshtein(a: string, b: string): number {
  if (!a) return b?.length ?? 0;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    [i, ...new Array(n).fill(0)]
  );
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
function stringSimilarity(a: string, b: string): number {
  const s1 = (a || '').toLowerCase().trim();
  const s2 = (b || '').toLowerCase().trim();
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  const maxLen = Math.max(s1.length, s2.length);
  return (maxLen - levenshtein(s1, s2)) / maxLen;
}
function getYearFromDate(dateStr?: string): number | null {
  if (!dateStr) return null;
  if (dateStr.includes('-')) return parseInt(dateStr.split('-')[0], 10) || null;
  if (dateStr.includes('/')) {
    const p = dateStr.split('/');
    if (p.length === 3) return parseInt(p[2], 10) || null;
  }
  const d = new Date(dateStr);
  return isNaN(d.getFullYear()) ? null : d.getFullYear();
}

function calcScore(p: ImportedMember, r: UnifiedMember): number {
  const nomeSim = stringSimilarity(p.nome, r.nome ?? '');
  const cognomeSim = stringSimilarity(p.cognome, r.cognome ?? '');

  if (nomeSim < 0.6 || cognomeSim < 0.6) return 0;

  if (p.dataNascita && r.dataNascita) {
    const pY = getYearFromDate(p.dataNascita);
    const rY = getYearFromDate(r.dataNascita);
    if (pY !== null && rY !== null && pY !== rY) return 0;
  }

  if (p.codiceFiscale && r.codiceFiscale) {
    if (stringSimilarity(p.codiceFiscale.toUpperCase(), r.codiceFiscale.toUpperCase()) < 0.7) return 0;
  }

  return Math.round(60 + (((nomeSim + cognomeSim) / 2) * 40));
}
const MATCH_THRESHOLD = 60;

const getCurrentMembershipYear = () => {
  const today = new Date();
  return today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
};

function formatDate(dateString?: string) {
  if (!dateString) return 'N/D';
  try {
    return new Date(dateString).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return 'Data non valida'; }
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90
    ? 'bg-green-100 text-green-800 border-green-300'
    : 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NuoviIscrittiPage() {
  const firestore = useFirestore();
  const { userData, isLoading: isUserLoading } = useUserData();

  const isAdmin = useMemo(() => userData?.roles?.includes('admin'), [userData]);
  const isEducatore = useMemo(() => userData?.roles?.includes('educatore'), [userData]);

  // ── Reactive queries ────────────────────────────────────────────────────────
  const allMembersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return collectionGroup(firestore, 'membri');
  }, [firestore, isAdmin, isEducatore]);
  const { data: allMembersData, isLoading: isLoadingMembers } = useCollection<any>(allMembersQuery);

  const allUsersQuery = useMemoFirebase(() => {
    if (!firestore || (!isAdmin && !isEducatore)) return null;
    return collection(firestore, 'users');
  }, [firestore, isAdmin, isEducatore]);
  const { data: allUsersData, isLoading: isLoadingUsers } = useCollection<UserData>(allUsersQuery);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'gruppi');
  }, [firestore]);
  const { data: groupsData, isLoading: isLoadingGroups } = useCollection<Group>(groupsQuery);

  // ── Imported placeholders (one-shot) ────────────────────────────────────────
  const [importedMembers, setImportedMembers] = useState<ImportedMember[]>([]);
  const [isLoadingImported, setIsLoadingImported] = useState(true);

  const loadImported = useCallback(async () => {
    if (!firestore || (!isAdmin && !isEducatore)) { setIsLoadingImported(false); return; }
    try {
      const snap = await getDocs(collection(firestore, 'imported-members'));
      setImportedMembers(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ImportedMember))
          .filter(m => !m.matchedWith)
      );
    } catch (e) {
      console.error('Error loading imported members:', e);
    } finally {
      setIsLoadingImported(false);
    }
  }, [firestore, isAdmin, isEducatore]);

  useEffect(() => { loadImported(); }, [loadImported]);

  // Ignored match suggestions (session only)
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Set<string>>(new Set());

  // Confirm match dialog state
  const [confirmingMatch, setConfirmingMatch] = useState<MatchSuggestion | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Unassigned members (for main table) ──────────────────────────────────
  const unassignedMembers = useMemo<UnifiedMember[]>(() => {
    if (!allUsersData || !allMembersData) return [];
    const combined: UnifiedMember[] = [];
    const processedIds = new Set<string>();
    allUsersData.forEach(user => {
      if (user.id) { combined.push({ ...user }); processedIds.add(user.id); }
    });
    allMembersData.forEach(member => {
      if (member.id && !processedIds.has(member.id)) combined.push({ ...member });
    });
    return combined.filter(m => {
      const hasRequired = !!(m.id && m.nome && m.cognome && m.dataNascita);
      const notAssigned = !m.groupId;
      const notArchived = m.archived === false || m.archived === undefined;
      return hasRequired && notAssigned && notArchived;
    });
  }, [allUsersData, allMembersData]);

  // ── Match suggestions ────────────────────────────────────────────────────
  const matchSuggestions = useMemo<MatchSuggestion[]>(() => {
    if (!importedMembers.length || !unassignedMembers.length) return [];
    const pairs: MatchSuggestion[] = [];
    for (const placeholder of importedMembers) {
      for (const real of unassignedMembers) {
        const key = `${placeholder.id}-${real.id}`;
        if (ignoredSuggestions.has(key)) continue;
        const score = calcScore(placeholder, real);
        if (score >= MATCH_THRESHOLD) pairs.push({ placeholder, realMember: real, score });
      }
    }
    // Best match per placeholder
    const seen = new Set<string>();
    return pairs
      .sort((a, b) => b.score - a.score)
      .filter(p => { if (seen.has(p.placeholder.id)) return false; seen.add(p.placeholder.id); return true; });
  }, [importedMembers, unassignedMembers, ignoredSuggestions]);

  // Members NOT involved in a match suggestion (shown in normal table)
  const unmatchedUnassigned = useMemo(() => {
    const suggestedRealIds = new Set(matchSuggestions.map(s => s.realMember.id));
    return unassignedMembers.filter(m => !suggestedRealIds.has(m.id ?? ''));
  }, [unassignedMembers, matchSuggestions]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const getMemberDocRef = async (memberId: string): Promise<any | null> => {
    if (!firestore || !memberId) return null;
    const userDocRef = doc(firestore, 'users', memberId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) return userDocRef;
    const membersSnapshot = await getDocs(collectionGroup(firestore, 'membri'));
    const memberDoc = membersSnapshot.docs.find(d => d.id === memberId);
    if (memberDoc) return memberDoc.ref;
    return null;
  };

  const handleAssignGroup = async (member: UnifiedMember, groupId: string, groupName: string) => {
    if (!firestore || !member.id) return;
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) { alert('Impossibile aggiornare il profilo del membro.'); return; }
    const batch = writeBatch(firestore);
    batch.update(doc(firestore, 'gruppi', groupId), { memberIds: arrayUnion(member.id) });
    batch.update(memberDocRef, { groupId, groupName });
    try { await batch.commit(); } catch (err) { alert(`Errore assegnazione gruppo: ${err}`); }
  };

  const handleToggleArchive = async (member: UnifiedMember) => {
    if (!firestore || !member.id) return;
    const memberDocRef = await getMemberDocRef(member.id);
    if (!memberDocRef) { alert('Impossibile archiviare.'); return; }
    try { await updateDoc(memberDocRef, { archived: true }); } catch (err) { alert(`Errore archiviazione: ${err}`); }
  };

  const handleConfirmMatch = async (match: MatchSuggestion) => {
    if (!firestore) return;
    setIsConfirming(true);
    try {
      const batch = writeBatch(firestore);
      const { placeholder, realMember } = match;

      const memberDocRef = await getMemberDocRef(realMember.id ?? '');
      const groups = groupsData ?? [];
      const matchingGroup = groups.find(g => g.name === placeholder.gruppo);

      if (memberDocRef && matchingGroup) {
        batch.update(memberDocRef, {
          groupId: matchingGroup.id,
          groupName: matchingGroup.name,
        });
        batch.update(doc(firestore, 'gruppi', matchingGroup.id), {
          memberIds: arrayUnion(realMember.id),
        });
      }

      const placeholderGroup = groups.find(g => g.name === placeholder.gruppo);
      if (placeholderGroup) {
        batch.update(doc(firestore, 'gruppi', placeholderGroup.id), {
          memberIds: arrayRemove(placeholder.id)
        });
      }

      // --- 1. Migrazione Presenze (Attendances) ---
      const partQuery = query(collectionGroup(firestore, 'partecipanti'), where('membroId', '==', placeholder.id));
      const partSnap = await getDocs(partQuery);
      partSnap.docs.forEach((d) => {
        const oldRef = d.ref;
        const newRef = doc(oldRef.parent, realMember.id);
        const data = d.data() as any;
        batch.set(newRef, {
           ...data,
           membroId: realMember.id,
           nome: realMember.nome,
           cognome: realMember.cognome
        });
        batch.delete(oldRef);
      });

      // --- 2. Migrazione Movimenti in Contanti ---
      const movQuery = query(collection(firestore, 'movimenti-contanti'), where('membroId', '==', placeholder.id));
      const movSnap = await getDocs(movQuery);
      movSnap.docs.forEach((d) => {
        batch.update(d.ref, { membroId: realMember.id });
      });

      // --- 3. Migrazione Raccolte (Payments) ---
      const raccSnap = await getDocs(collection(firestore, 'raccolte'));
      raccSnap.docs.forEach(d => {
         const data = d.data();
         let changed = false;
         
         const swapArray = (arr: string[] | undefined) => {
             if (!arr) return arr;
             if (arr.includes(placeholder.id)) {
                 changed = true;
                 return arr.filter(id => id !== placeholder.id).concat(realMember.id);
             }
             return arr;
         };
         
         const confermatiIds = swapArray(data.confermatiIds);
         const caparraPaidIds = swapArray(data.caparraPaidIds);
         const saldoPaidIds = swapArray(data.saldoPaidIds);
         const tesseratiIds = swapArray(data.tesseratiIds);
         
         const newPaymentDetails = { ...(data.paymentDetails || {}) } as any;
         if (Object.keys(newPaymentDetails).length > 0) {
            ['caparra', 'saldo', 'tesseramento'].forEach(fase => {
               if (newPaymentDetails[fase] && newPaymentDetails[fase][placeholder.id]) {
                  changed = true;
                  newPaymentDetails[fase][realMember.id] = { ...newPaymentDetails[fase][placeholder.id] };
                  delete newPaymentDetails[fase][placeholder.id];
               }
            });
         }
         
         let newPartecipanti = data.partecipanti;
         if (newPartecipanti && Array.isArray(newPartecipanti)) {
             const idx = newPartecipanti.findIndex((p: any) => p.memberId === placeholder.id);
             if (idx >= 0) {
                 changed = true;
                 newPartecipanti = [...newPartecipanti];
                 newPartecipanti[idx] = { ...newPartecipanti[idx], memberId: realMember.id };
             }
         }
         
         if (changed) {
             batch.update(d.ref, {
                 confermatiIds,
                 caparraPaidIds,
                 saldoPaidIds,
                 tesseratiIds,
                 paymentDetails: newPaymentDetails,
                 partecipanti: newPartecipanti
             });
         }
      });

      // --- 4. Delete placeholder ---
      batch.delete(doc(firestore, 'imported-members', placeholder.id));

      await batch.commit();
      setConfirmingMatch(null);
      await loadImported();
    } catch (e) {
      console.error(e);
      alert('Errore durante la conferma del match.');
    } finally {
      setIsConfirming(false);
    }
  };

  const isLoading = isUserLoading || isLoadingMembers || isLoadingUsers || isLoadingGroups || isLoadingImported;
  const currentMembershipYear = getCurrentMembershipYear();

  if (!isUserLoading && !isAdmin && !isEducatore) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accesso Negato</CardTitle>
          <CardDescription>Non hai i permessi per visualizzare questa sezione.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Section: Match Suggestions ─────────────────────────────────────── */}
      {!isLoading && matchSuggestions.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10 dark:border-yellow-800">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-yellow-800 dark:text-yellow-500">
                ⚠️ Possibili Doppioni da Verificare
              </CardTitle>
              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
                {matchSuggestions.length}
              </Badge>
            </div>
            <CardDescription>
              Questi nuovi iscritti sono molto simili a ragazzi già presenti nel database.
              Conferma la corrispondenza per assegnare automaticamente il gruppo, o ignora se sono persone diverse.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchSuggestions.map(suggestion => (
              <div
                key={`${suggestion.placeholder.id}-${suggestion.realMember.id}`}
                className="rounded-lg border bg-white dark:bg-card p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <ScoreBadge score={suggestion.score} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setConfirmingMatch(suggestion)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Conferma Match
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setIgnoredSuggestions(prev => {
                          const next = new Set(Array.from(prev));
                          next.add(`${suggestion.placeholder.id}-${suggestion.realMember.id}`);
                          return next;
                        })
                      }
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Ignora
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
                  <div className="rounded-md bg-muted/60 p-3 space-y-0.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">📦 Dal database</p>
                    <p className="font-semibold">{suggestion.placeholder.nome} {suggestion.placeholder.cognome}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(suggestion.placeholder.dataNascita)}</p>
                    {suggestion.placeholder.gruppo && (
                      <Badge variant="secondary" className="text-xs">{suggestion.placeholder.gruppo}</Badge>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-0.5">
                    <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wide">✅ Nuovo iscritto</p>
                    <p className="font-semibold">{suggestion.realMember.nome} {suggestion.realMember.cognome}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(suggestion.realMember.dataNascita)}</p>
                    {suggestion.realMember.codiceFiscale && (
                      <p className="text-xs font-mono text-muted-foreground">{suggestion.realMember.codiceFiscale}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Section: Normal Unassigned Members ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Nuovi Iscritti</CardTitle>
          <CardDescription>
            Elenco degli utenti e membri familiari non archiviati e non ancora assegnati a un gruppo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead className="text-center">Gruppo</TableHead>
                <TableHead>Tesserato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Caricamento...</TableCell>
                </TableRow>
              )}

              {!isLoading && unmatchedUnassigned.length > 0 ? (
                unmatchedUnassigned.map(member => {
                  const isTesserato = member.tesseramento === currentMembershipYear;
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.nome}</TableCell>
                      <TableCell>{member.cognome}</TableCell>
                      <TableCell>{formatDate(member.dataNascita)}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isLoadingGroups || !groupsData}>
                              Assegna
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isLoadingGroups ? (
                              <DropdownMenuItem disabled>Caricamento...</DropdownMenuItem>
                            ) : (
                              groupsData && groupsData.length > 0
                                ? groupsData.map(group => (
                                    <DropdownMenuItem
                                      key={group.id}
                                      onSelect={() => handleAssignGroup(member, group.id, group.name)}
                                    >
                                      {group.name}
                                    </DropdownMenuItem>
                                  ))
                                : <DropdownMenuItem disabled>Nessun gruppo</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        {isTesserato
                          ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">Tesserato</Badge>
                          : <Badge variant="destructive">Non Tesserato</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleArchive(member)}
                          title="Archivia Membro"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          <span className="sr-only">Archivia</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      Tutti i membri sono stati assegnati a un gruppo o non ci sono nuovi iscritti.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Confirm Match Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!confirmingMatch} onOpenChange={(o) => !o && setConfirmingMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Corrispondenza</DialogTitle>
            <DialogDescription>
              Stai per associare il placeholder importato con il nuovo iscritto.
              Il gruppo verrà assegnato automaticamente e il placeholder eliminato definitivamente.
            </DialogDescription>
          </DialogHeader>
          {confirmingMatch && (
            <div className="rounded-md bg-muted p-3 text-sm flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Dal database</p>
                <p className="font-semibold">{confirmingMatch.placeholder.nome} {confirmingMatch.placeholder.cognome}</p>
                {confirmingMatch.placeholder.gruppo && (
                  <p className="text-xs text-muted-foreground">→ Gruppo: {confirmingMatch.placeholder.gruppo}</p>
                )}
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Nuovo iscritto</p>
                <p className="font-semibold">{confirmingMatch.realMember.nome} {confirmingMatch.realMember.cognome}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingMatch(null)}>Annulla</Button>
            <Button
              disabled={isConfirming}
              onClick={() => confirmingMatch && handleConfirmMatch(confirmingMatch)}
            >
              {isConfirming ? 'Conferma in corso...' : 'Conferma e Procedi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
