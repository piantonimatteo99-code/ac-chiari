'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFirestore } from '@/src/firebase';
import {
  collection, collectionGroup, getDocs, addDoc, serverTimestamp,
  deleteDoc, doc, writeBatch, arrayUnion, arrayRemove, query, where, updateDoc,
} from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle2, XCircle, Trash2, Download, RefreshCw, ArrowRight, AlertTriangle, UserPlus, Link2, Users2, Search } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import Papa from 'papaparse';
import { Input } from '@/components/ui/input';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ImportedMember {
  id: string;
  nome: string;
  cognome: string;
  dataNascita?: string;
  codiceFiscale?: string;
  luogoNascita?: string;
  gruppo?: string;
  isImported: boolean;
  importedAt?: any;
  matchedWith?: string | null;
}

interface RealMember {
  id: string;
  nome: string;
  cognome: string;
  dataNascita?: string;
  codiceFiscale?: string;
  luogoNascita?: string;
  groupId?: string;
  docPath: string;
}

interface MatchPair {
  placeholder: ImportedMember;
  realMember: RealMember;
  score: number;
}

// ─── Registered user type for family linking ──────────────────────────────────
interface RegisteredUser {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  displayName: string;
  familyId?: string;
}

interface FamilyLinkSuggestion {
  user: RegisteredUser;
  suggestedHead: RegisteredUser;
  score: number;
}

// ─── Similarity Algorithm ─────────────────────────────────────────────────────
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

function calculateMatchScore(placeholder: ImportedMember, real: RealMember): number {
  const nomeSim = stringSimilarity(placeholder.nome, real.nome);
  const cognomeSim = stringSimilarity(placeholder.cognome, real.cognome);

  if (nomeSim < 0.6 || cognomeSim < 0.6) return 0;

  if (placeholder.dataNascita && real.dataNascita) {
    const pY = getYearFromDate(placeholder.dataNascita);
    const rY = getYearFromDate(real.dataNascita);
    if (pY !== null && rY !== null && pY !== rY) return 0;
  }

  if (placeholder.codiceFiscale && real.codiceFiscale) {
    if (stringSimilarity(placeholder.codiceFiscale.toUpperCase(), real.codiceFiscale.toUpperCase()) < 0.7) return 0;
  }

  return Math.round(60 + (((nomeSim + cognomeSim) / 2) * 40));
}

const MATCH_THRESHOLD = 60;

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? 'bg-green-100 text-green-800 border-green-300' :
    score >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
    'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}% match
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return dateStr; }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UtentiRegistratiPage() {
  const firestore = useFirestore();
  const { userData } = useUserData();
  const isAdmin = userData?.roles?.includes('admin');

  const [importedMembers, setImportedMembers] = useState<ImportedMember[]>([]);
  const [realMembers, setRealMembers] = useState<RealMember[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV Import
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Match confirmation dialog
  const [confirmingMatch, setConfirmingMatch] = useState<MatchPair | null>(null);
  const [manualMatchPlaceholder, setManualMatchPlaceholder] = useState<ImportedMember | null>(null);
  const [selectedRealMemberId, setSelectedRealMemberId] = useState<string>('');
  const [manualMatchSearch, setManualMatchSearch] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);

  // Pairs ignored for this session
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deletingPlaceholder, setDeletingPlaceholder] = useState<ImportedMember | null>(null);

  // ── Family Linking state ───────────────────────────────────────────────────
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [familyLinkSearch, setFamilyLinkSearch] = useState('');
  const [linkingUser, setLinkingUser] = useState<RegisteredUser | null>(null);
  const [selectedFamilyHeadId, setSelectedFamilyHeadId] = useState<string>('');
  const [familyHeadSearch, setFamilyHeadSearch] = useState('');
  const [isLinkingFamily, setIsLinkingFamily] = useState(false);
  const [familyLinkSuccess, setFamilyLinkSuccess] = useState<string | null>(null);
  const [ignoredFamilySuggestions, setIgnoredFamilySuggestions] = useState<Set<string>>(new Set());

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    setError(null);
    try {
      // Imported placeholders (unmatched only)
      const importedSnap = await getDocs(collection(firestore, 'imported-members'));
      const imported: ImportedMember[] = importedSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as ImportedMember))
        .filter(m => !m.matchedWith);
      setImportedMembers(imported);

      // Groups
      const groupsSnap = await getDocs(collection(firestore, 'gruppi'));
      setGroups(groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));

      // Real members: users collection + famiglie/*/membri
      const real: RealMember[] = [];
      const usersSnap = await getDocs(collection(firestore, 'users'));
      usersSnap.docs.forEach(d => {
        const data = d.data();
        real.push({
          id: d.id,
          nome: data.nome || (data.displayName ?? '').split(' ')[0] || '',
          cognome: data.cognome || (data.displayName ?? '').split(' ').slice(1).join(' ') || '',
          dataNascita: data.dataNascita,
          codiceFiscale: data.codiceFiscale,
          luogoNascita: data.luogoNascita,
          groupId: data.groupId,
          docPath: d.ref.path,
        });
      });

      // Build registered users list for family linking
      const registered: RegisteredUser[] = usersSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nome: data.nome || (data.displayName ?? '').split(' ')[0] || '',
          cognome: data.cognome || (data.displayName ?? '').split(' ').slice(1).join(' ') || '',
          email: data.email || '',
          displayName: data.displayName || `${data.nome || ''} ${data.cognome || ''}`.trim(),
          familyId: data.familyId,
        };
      });
      setRegisteredUsers(registered);

      const membersSnap = await getDocs(collectionGroup(firestore, 'membri'));
      membersSnap.docs.forEach(d => {
        if (!real.some(r => r.id === d.id)) {
          const data = d.data();
          real.push({
            id: d.id,
            nome: data.nome || '',
            cognome: data.cognome || '',
            dataNascita: data.dataNascita,
            codiceFiscale: data.codiceFiscale,
            luogoNascita: data.luogoNascita,
            groupId: data.groupId,
            docPath: d.ref.path,
          });
        }
      });
      setRealMembers(real);
    } catch (e) {
      console.error(e);
      setError('Errore nel caricamento dei dati.');
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Compute matches ────────────────────────────────────────────────────────
  const matches = useMemo((): MatchPair[] => {
    if (!importedMembers.length || !realMembers.length) return [];
    const pairs: MatchPair[] = [];
    for (const placeholder of importedMembers) {
      for (const real of realMembers) {
        const key = `${placeholder.id}-${real.id}`;
        if (ignoredPairs.has(key)) continue;
        const score = calculateMatchScore(placeholder, real);
        if (score >= MATCH_THRESHOLD) {
          pairs.push({ placeholder, realMember: real, score });
        }
      }
    }
    // Keep only the best match per placeholder
    const seen = new Set<string>();
    return pairs
      .sort((a, b) => b.score - a.score)
      .filter(p => { if (seen.has(p.placeholder.id)) return false; seen.add(p.placeholder.id); return true; });
  }, [importedMembers, realMembers, ignoredPairs]);

  const unmatchedPlaceholders = useMemo(() => {
    const matchedIds = new Set(matches.map(m => m.placeholder.id));
    return importedMembers.filter(m => !matchedIds.has(m.id));
  }, [importedMembers, matches]);

  const filteredRealMembersForManual = useMemo(() => {
     if (!manualMatchSearch) return realMembers;
     const s = manualMatchSearch.toLowerCase();
     return realMembers.filter(r => 
        r.nome.toLowerCase().includes(s) || 
        r.cognome.toLowerCase().includes(s) || 
        (r.codiceFiscale && r.codiceFiscale.toLowerCase().includes(s))
     );
  }, [realMembers, manualMatchSearch]);

  // ── CSV Import ─────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setCsvPreview([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setImportError('Errore nel parsing CSV: ' + results.errors[0].message);
          return;
        }
        setCsvPreview(results.data as Record<string, string>[]);
      },
    });
  };

  const handleImport = async () => {
    if (!firestore || !csvPreview.length) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const batch = writeBatch(firestore);
      for (const row of csvPreview) {
        const nome = (row['Nome'] ?? row['nome'] ?? '').trim();
        const cognome = (row['Cognome'] ?? row['cognome'] ?? '').trim();
        const dataNascita = (row['Data Nascita'] ?? row['dataNascita'] ?? '').trim();
        const codiceFiscale = (row['Codice Fiscale'] ?? row['codiceFiscale'] ?? '').trim().toUpperCase();
        const luogoNascita = (row['Luogo Nascita'] ?? row['luogoNascita'] ?? '').trim();
        const gruppo = (row['Gruppo'] ?? row['gruppo'] ?? '').trim();
        if (!nome || !cognome) continue;
        const newRef = doc(collection(firestore, 'imported-members'));
        
        batch.set(newRef, {
          nome, cognome, dataNascita, codiceFiscale, luogoNascita, gruppo,
          isImported: true,
          importedAt: serverTimestamp(),
          matchedWith: null,
        });

        if (gruppo) {
          const matchingGroup = groups.find(g => g.name === gruppo);
          if (matchingGroup) {
            batch.update(doc(firestore, 'gruppi', matchingGroup.id), {
              memberIds: arrayUnion(newRef.id)
            });
          }
        }
      }
      await batch.commit();
      setIsImportDialogOpen(false);
      setCsvPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadData();
    } catch (e) {
      console.error(e);
      setImportError("Errore durante l'importazione.");
    } finally {
      setIsImporting(false);
    }
  };

  // ── Download template CSV ─────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = [
      'Nome,Cognome,Data Nascita,Codice Fiscale,Luogo Nascita,Gruppo',
      'Mario,Rossi,2015-04-12,RSSMRA15D12C618A,Chiari,Fanciulli A',
      'Giulia,Bianchi,2016-09-23,,Brescia,Fanciulle B',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_ragazzi.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Confirm Match ─────────────────────────────────────────────────────────
  const handleConfirmMatch = async (pair: MatchPair) => {
    if (!firestore) return;
    setIsConfirming(true);
    try {
      const batch = writeBatch(firestore);
      const matchingGroup = groups.find(g => g.name === pair.placeholder.gruppo);
      const realDocRef = doc(firestore, pair.realMember.docPath);

      if (matchingGroup) {
        batch.update(realDocRef, {
          groupId: matchingGroup.id,
          groupName: matchingGroup.name,
        });
        const groupDocRef = doc(firestore, 'gruppi', matchingGroup.id);
        batch.update(groupDocRef, { 
          memberIds: arrayUnion(pair.realMember.id),
        });
      }

      // If the placeholder was in a group, we should remove its ID from that group
      const placeholderGroup = groups.find(g => g.name === pair.placeholder.gruppo);
      if (placeholderGroup) {
        batch.update(doc(firestore, 'gruppi', placeholderGroup.id), {
          memberIds: arrayRemove(pair.placeholder.id)
        });
      }

      // --- 1. Migrazione Presenze (Attendances) ---
      const partQuery = query(collectionGroup(firestore, 'partecipanti'), where('membroId', '==', pair.placeholder.id));
      const partSnap = await getDocs(partQuery);
      partSnap.docs.forEach((d) => {
        const oldRef = d.ref;
        const newRef = doc(oldRef.parent, pair.realMember.id);
        const data = d.data() as any;
        batch.set(newRef, {
           ...data,
           membroId: pair.realMember.id,
           nome: pair.realMember.nome,
           cognome: pair.realMember.cognome
        });
        batch.delete(oldRef);
      });

      // --- 2. Migrazione Movimenti in Contanti ---
      const movQuery = query(collection(firestore, 'movimenti-contanti'), where('membroId', '==', pair.placeholder.id));
      const movSnap = await getDocs(movQuery);
      movSnap.docs.forEach((d) => {
        batch.update(d.ref, { membroId: pair.realMember.id });
      });

      // --- 3. Migrazione Raccolte (Payments) ---
      const raccSnap = await getDocs(collection(firestore, 'raccolte'));
      raccSnap.docs.forEach(d => {
         const data = d.data();
         let changed = false;
         
         const swapArray = (arr: string[] | undefined) => {
             if (!arr) return arr;
             if (arr.includes(pair.placeholder.id)) {
                 changed = true;
                 return arr.filter(id => id !== pair.placeholder.id).concat(pair.realMember.id);
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
               if (newPaymentDetails[fase] && newPaymentDetails[fase][pair.placeholder.id]) {
                  changed = true;
                  newPaymentDetails[fase][pair.realMember.id] = { ...newPaymentDetails[fase][pair.placeholder.id] };
                  delete newPaymentDetails[fase][pair.placeholder.id];
               }
            });
         }
         
         let newPartecipanti = data.partecipanti;
         if (newPartecipanti && Array.isArray(newPartecipanti)) {
             const idx = newPartecipanti.findIndex((p: any) => p.memberId === pair.placeholder.id);
             if (idx >= 0) {
                 changed = true;
                 newPartecipanti = [...newPartecipanti];
                 newPartecipanti[idx] = { ...newPartecipanti[idx], memberId: pair.realMember.id };
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
      batch.delete(doc(firestore, 'imported-members', pair.placeholder.id));

      await batch.commit();
      setConfirmingMatch(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('Errore durante la conferma del match.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDeletePlaceholder = async (placeholder: ImportedMember) => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'imported-members', placeholder.id));
      
      const placeholderGroup = groups.find(g => g.name === placeholder.gruppo);
      if (placeholderGroup) {
        batch.update(doc(firestore, 'gruppi', placeholderGroup.id), {
          memberIds: arrayRemove(placeholder.id)
        });
      }

      await batch.commit();
      setDeletingPlaceholder(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Errore durante l'eliminazione.");
      setIsLoading(false);
    }
  };

  // ── Family Linking helpers ────────────────────────────────────────────────
  const familySuggestions = useMemo((): FamilyLinkSuggestion[] => {
    if (!registeredUsers.length) return [];
    // Only suggest for users without familyId
    const unlinked = registeredUsers.filter(u => !u.familyId);
    const potentialHeads = registeredUsers; // anyone can be a head
    const suggestions: FamilyLinkSuggestion[] = [];
    for (const user of unlinked) {
      let best: { head: RegisteredUser; score: number } | null = null;
      for (const head of potentialHeads) {
        if (head.id === user.id) continue;
        const key = `${user.id}-${head.id}`;
        if (ignoredFamilySuggestions.has(key)) continue;
        const nSim = stringSimilarity(user.cognome, head.cognome);
        if (nSim < 0.75) continue; // Only suggest same surname
        const score = Math.round(nSim * 100);
        if (!best || score > best.score) best = { head, score };
      }
      if (best) suggestions.push({ user, suggestedHead: best.head, score: best.score });
    }
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [registeredUsers, ignoredFamilySuggestions]);

  const filteredUsersForLink = useMemo(() => {
    const q = familyLinkSearch.toLowerCase();
    return registeredUsers.filter(u =>
      !q || u.nome.toLowerCase().includes(q) || u.cognome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [registeredUsers, familyLinkSearch]);

  const filteredFamilyHeads = useMemo(() => {
    const q = familyHeadSearch.toLowerCase();
    return registeredUsers.filter(u =>
      u.id !== linkingUser?.id &&
      (!q || u.nome.toLowerCase().includes(q) || u.cognome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    );
  }, [registeredUsers, familyHeadSearch, linkingUser]);

  const handleLinkFamily = async () => {
    if (!firestore || !linkingUser || !selectedFamilyHeadId) return;
    setIsLinkingFamily(true);
    try {
      await updateDoc(doc(firestore, 'users', linkingUser.id), {
        familyId: selectedFamilyHeadId,
      });
      setFamilyLinkSuccess(`${linkingUser.displayName} collegato al nucleo familiare con successo.`);
      setLinkingUser(null);
      setSelectedFamilyHeadId('');
      setFamilyHeadSearch('');
      await loadData();
      setTimeout(() => setFamilyLinkSuccess(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Errore durante il collegamento familiare.');
    } finally {
      setIsLinkingFamily(false);
    }
  };

  const handleUnlinkFamily = async (user: RegisteredUser) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.id), { familyId: null });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmSuggestion = async (suggestion: FamilyLinkSuggestion) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', suggestion.user.id), {
        familyId: suggestion.suggestedHead.id,
      });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // ── Access guard ──────────────────────────────────────────────────────────
  if (!isAdmin && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accesso Negato</CardTitle>
          <CardDescription>Solo gli amministratori possono accedere a questa sezione.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Utenti Registrati</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Aggiorna
          </Button>
          <Button onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importa da CSV
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {familyLinkSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          {familyLinkSuccess}
        </div>
      )}

      {/* ── Sezione: Collegamento Nucleo Familiare ───────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users2 className="h-5 w-5 text-blue-500" />
              Collegamento Nucleo Familiare
            </CardTitle>
            {familySuggestions.length > 0 && (
              <Badge variant="secondary">{familySuggestions.length} suggerimenti</Badge>
            )}
          </div>
          <CardDescription>
            Collega manualmente utenti registrati allo stesso nucleo familiare impostando il loro <code>familyId</code>.
            I suggerimenti sono basati sulla corrispondenza del cognome (match ≥ 75%).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Suggestions */}
          {!isLoading && familySuggestions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Suggerimenti automatici</p>
              {familySuggestions.map(s => (
                <div key={`${s.user.id}-${s.suggestedHead.id}`} className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="rounded-md bg-muted px-3 py-2 text-sm min-w-0">
                      <p className="font-semibold truncate">{s.user.displayName}</p>
                      <p className="text-xs text-muted-foreground">{s.user.email}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm min-w-0">
                      <p className="font-semibold truncate text-blue-800">{s.suggestedHead.displayName}</p>
                      <p className="text-xs text-blue-600">{s.suggestedHead.email}</p>
                    </div>
                    <ScoreBadge score={s.score} />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleConfirmSuggestion(s)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Collega
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setIgnoredFamilySuggestions(prev => new Set([...Array.from(prev), `${s.user.id}-${s.suggestedHead.id}`]));
                    }}>
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Ignora
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual link table */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Collegamento manuale</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca utente per nome, cognome o email..."
                className="pl-9"
                value={familyLinkSearch}
                onChange={e => setFamilyLinkSearch(e.target.value)}
              />
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nucleo attuale</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6">Caricamento...</TableCell></TableRow>
                  )}
                  {!isLoading && filteredUsersForLink.slice(0, 20).map(u => {
                    const head = u.familyId ? registeredUsers.find(r => r.id === u.familyId) : null;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.displayName || `${u.nome} ${u.cognome}`}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                        <TableCell>
                          {head ? (
                            <Badge variant="secondary" className="text-xs">{head.displayName}</Badge>
                          ) : u.familyId ? (
                            <Badge variant="outline" className="text-xs text-amber-600">ID: {u.familyId.slice(0, 8)}…</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setLinkingUser(u); setSelectedFamilyHeadId(''); setFamilyHeadSearch(''); }}>
                              <Link2 className="mr-1.5 h-3.5 w-3.5" />
                              Collega
                            </Button>
                            {u.familyId && (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleUnlinkFamily(u)}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 1: Matches ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>Corrispondenze da Verificare</CardTitle>
            {matches.length > 0 && (
              <Badge variant="destructive">{matches.length} da controllare</Badge>
            )}
          </div>
          <CardDescription>
            Iscritti importati che potrebbero corrispondere a utenti appena registrati.
            Conferma per assegnare il gruppo al membro reale ed eliminare il placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <p className="text-center text-muted-foreground py-8">Caricamento...</p>
          )}
          {!isLoading && matches.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm">Nessuna corrispondenza da verificare.</p>
            </div>
          )}
          {!isLoading && matches.map(pair => (
            <div
              key={`${pair.placeholder.id}-${pair.realMember.id}`}
              className="rounded-lg border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ScoreBadge score={pair.score} />
                  <ScoreBar score={pair.score} />
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => setConfirmingMatch(pair)}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Conferma Match
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                        const next = new Set(Array.from(ignoredPairs));
                        next.add(`${pair.placeholder.id}-${pair.realMember.id}`);
                        setIgnoredPairs(next);
                      }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Ignora
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
                {/* Placeholder */}
                <div className="rounded-md bg-muted/60 p-3 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    📦 Importato dal DB
                  </p>
                  <p className="font-semibold">{pair.placeholder.nome} {pair.placeholder.cognome}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(pair.placeholder.dataNascita)}</p>
                  {pair.placeholder.codiceFiscale && (
                    <p className="text-muted-foreground text-xs font-mono">{pair.placeholder.codiceFiscale}</p>
                  )}
                  {pair.placeholder.luogoNascita && (
                    <p className="text-muted-foreground text-xs">{pair.placeholder.luogoNascita}</p>
                  )}
                  {pair.placeholder.gruppo && (
                    <Badge variant="secondary" className="text-xs">{pair.placeholder.gruppo}</Badge>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center pt-8">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>

                {/* Real member */}
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-1 text-sm">
                  <p className="text-xs font-semibold text-primary/70 uppercase tracking-wide mb-1.5">
                    ✅ Utente Registrato
                  </p>
                  <p className="font-semibold">{pair.realMember.nome} {pair.realMember.cognome}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(pair.realMember.dataNascita)}</p>
                  {pair.realMember.codiceFiscale && (
                    <p className="text-muted-foreground text-xs font-mono">{pair.realMember.codiceFiscale}</p>
                  )}
                  {pair.realMember.luogoNascita && (
                    <p className="text-muted-foreground text-xs">{pair.realMember.luogoNascita}</p>
                  )}
                  {pair.realMember.groupId ? (
                    <Badge className="text-xs">Ha già un gruppo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Nessun gruppo</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 2: Unmatched Placeholders ──────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>Placeholder Importati senza Corrispondenza</CardTitle>
            {!isLoading && (
              <Badge variant="secondary">{unmatchedPlaceholders.length}</Badge>
            )}
          </div>
          <CardDescription>
            Ragazzi importati dal database iniziale per i quali non è ancora stata trovata
            una registrazione corrispondente nell'app.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cognome</TableHead>
                <TableHead>Data di Nascita</TableHead>
                <TableHead>Luogo</TableHead>
                <TableHead>Cod. Fiscale</TableHead>
                <TableHead>Gruppo</TableHead>
                <TableHead>Importato il</TableHead>
                <TableHead><span className="sr-only">Azioni</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Caricamento...</TableCell>
                </TableRow>
              )}
              {!isLoading && unmatchedPlaceholders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nessun placeholder da mostrare.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && unmatchedPlaceholders.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.cognome}</TableCell>
                  <TableCell>{formatDate(m.dataNascita)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.luogoNascita || '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{m.codiceFiscale || '—'}</TableCell>
                  <TableCell>
                    {m.gruppo ? <Badge variant="secondary">{m.gruppo}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {m.importedAt?.toDate?.()
                      ? new Date(m.importedAt.toDate()).toLocaleDateString('it-IT')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-primary hover:text-primary"
                      title="Associa Manualmente"
                      onClick={() => setManualMatchPlaceholder(m)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingPlaceholder(m)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ──────────────────────────────────────────────────────────────────────
          Dialogs
      ─────────────────────────────────────────────────────────────────────── */}

      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(o) => { setIsImportDialogOpen(o); if (!o) { setCsvPreview([]); setImportError(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importa Ragazzi da CSV</DialogTitle>
            <DialogDescription>
              Carica un file CSV con i dati dei ragazzi esistenti. Le colonne devono essere:
              <strong> Nome, Cognome, Data Nascita, Codice Fiscale, Luogo Nascita, Gruppo</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex gap-2">
              <label
                htmlFor="csv-upload"
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/30 px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
              >
                <Upload className="h-5 w-5" />
                {csvPreview.length > 0 ? `${csvPreview.length} righe caricate` : 'Clicca per caricare il file CSV'}
              </label>
              <input
                id="csv-upload"
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 self-center">
                <Download className="mr-2 h-4 w-4" />
                Scarica Template
              </Button>
            </div>

            {importError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 text-sm">
                {importError}
              </div>
            )}

            {csvPreview.length > 0 && (
              <div className="rounded-md border overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cognome</TableHead>
                      <TableHead>Data Nascita</TableHead>
                      <TableHead>Cod. Fiscale</TableHead>
                      <TableHead>Luogo</TableHead>
                      <TableHead>Gruppo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row['Nome'] ?? row['nome'] ?? '—'}</TableCell>
                        <TableCell>{row['Cognome'] ?? row['cognome'] ?? '—'}</TableCell>
                        <TableCell>{row['Data Nascita'] ?? row['dataNascita'] ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{row['Codice Fiscale'] ?? row['codiceFiscale'] ?? '—'}</TableCell>
                        <TableCell>{row['Luogo Nascita'] ?? row['luogoNascita'] ?? '—'}</TableCell>
                        <TableCell>{row['Gruppo'] ?? row['gruppo'] ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                    {csvPreview.length > 20 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground text-xs">
                          … e altri {csvPreview.length - 20} elementi
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setCsvPreview([]); }}>
              Annulla
            </Button>
            <Button
              onClick={handleImport}
              disabled={csvPreview.length === 0 || isImporting}
            >
              {isImporting ? 'Importazione in corso...' : `Importa ${csvPreview.length} Ragazzi`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Match Dialog */}
      <Dialog open={!!confirmingMatch} onOpenChange={(o) => !o && setConfirmingMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Corrispondenza</DialogTitle>
            <DialogDescription>
              Stai per associare il placeholder importato con l'utente registrato.
              Se il gruppo è specificato, verrà assegnato automaticamente al membro reale.
              Il placeholder verrà <strong>eliminato definitivamente</strong>.
            </DialogDescription>
          </DialogHeader>
          {confirmingMatch && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center gap-3 rounded-md bg-muted p-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Placeholder</p>
                  <p className="font-semibold truncate">{confirmingMatch.placeholder.nome} {confirmingMatch.placeholder.cognome}</p>
                  {confirmingMatch.placeholder.gruppo && (
                    <p className="text-xs text-muted-foreground truncate">Gruppo: {confirmingMatch.placeholder.gruppo}</p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Membro Reale</p>
                  <p className="font-semibold">{confirmingMatch.realMember.nome} {confirmingMatch.realMember.cognome}</p>
                  {confirmingMatch.realMember.docPath && (
                    <p className="text-xs text-muted-foreground font-mono truncate">{confirmingMatch.realMember.docPath}</p>
                  )}
                </div>
              </div>
              {!groups.find(g => g.name === confirmingMatch.placeholder.gruppo) &&
               confirmingMatch.placeholder.gruppo && (
                <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Il gruppo &quot;{confirmingMatch.placeholder.gruppo}&quot; non è stato trovato nel sistema. Il membro verrà matchato senza assegnazione di gruppo.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingMatch(null)}>Annulla</Button>
            <Button
              onClick={() => confirmingMatch && handleConfirmMatch(confirmingMatch)}
              disabled={isConfirming}
            >
              {isConfirming ? 'Conferma in corso...' : 'Conferma e Procedi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={!!manualMatchPlaceholder} onOpenChange={(o) => !o && setManualMatchPlaceholder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associazione Manuale</DialogTitle>
            <DialogDescription>
              Seleziona l'utente reale a cui associare il placeholder <strong>{manualMatchPlaceholder?.nome} {manualMatchPlaceholder?.cognome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="relative">
              <input 
                type="text"
                placeholder="Cerca utente per nome, cognome o CF..." 
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={manualMatchSearch} 
                onChange={e => setManualMatchSearch(e.target.value)} 
              />
            </div>
            <div className="max-h-60 overflow-y-auto border rounded-md p-1 space-y-1 bg-muted/20">
              {filteredRealMembersForManual.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">Nessun utente trovato</div>
              ) : (
                filteredRealMembersForManual.map(rm => (
                  <div 
                    key={rm.id} 
                    onClick={() => setSelectedRealMemberId(rm.id)}
                    className={`p-2 text-sm rounded-md cursor-pointer flex items-center justify-between ${
                      selectedRealMemberId === rm.id 
                        ? 'bg-primary/10 border-primary/30 border' 
                        : 'hover:bg-muted border border-transparent'
                    }`}
                  >
                     <div>
                       <span className="font-medium">{rm.nome} {rm.cognome}</span>
                       <span className="text-muted-foreground ml-2">{rm.dataNascita ? `(${formatDate(rm.dataNascita)})` : ''}</span>
                       {rm.codiceFiscale && <span className="text-muted-foreground ml-2 text-xs font-mono">{rm.codiceFiscale}</span>}
                     </div>
                     {selectedRealMemberId === rm.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setManualMatchPlaceholder(null); setSelectedRealMemberId(''); setManualMatchSearch(''); }}>
              Annulla
            </Button>
            <Button
              disabled={!selectedRealMemberId}
              onClick={() => {
                const real = realMembers.find(r => r.id === selectedRealMemberId);
                if (manualMatchPlaceholder && real) {
                  setConfirmingMatch({
                      placeholder: manualMatchPlaceholder,
                      realMember: real,
                      score: 100
                  });
                  setManualMatchPlaceholder(null);
                  setSelectedRealMemberId('');
                }
              }}
            >
              Procedi al Riepilogo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Placeholder Dialog */}
      <Dialog open={!!deletingPlaceholder} onOpenChange={(o) => !o && setDeletingPlaceholder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Placeholder</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo placeholder? L&apos;operazione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPlaceholder(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deletingPlaceholder && handleDeletePlaceholder(deletingPlaceholder)}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Link Dialog */}
      <Dialog open={!!linkingUser} onOpenChange={(o) => !o && setLinkingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              Scegli Capofamiglia
            </DialogTitle>
            <DialogDescription>
              Stai collegando <strong>{linkingUser?.displayName}</strong> a un nucleo familiare.
              Seleziona il capofamiglia (l&apos;utente la cui famiglia verrà condivisa).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca capofamiglia..."
                className="pl-9"
                value={familyHeadSearch}
                onChange={e => setFamilyHeadSearch(e.target.value)}
              />
            </div>
            <div className="rounded-md border max-h-52 overflow-y-auto">
              {filteredFamilyHeads.slice(0, 15).map(u => (
                <button
                  key={u.id}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-muted/50 border-b last:border-b-0 transition-colors ${selectedFamilyHeadId === u.id ? 'bg-primary/10 text-primary font-semibold' : ''}`}
                  onClick={() => setSelectedFamilyHeadId(u.id)}
                >
                  <p className="font-medium">{u.displayName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </button>
              ))}
              {filteredFamilyHeads.length === 0 && (
                <p className="text-center text-muted-foreground py-4 text-sm">Nessun utente trovato</p>
              )}
            </div>
            {selectedFamilyHeadId && (
              <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
                <p className="text-xs text-primary/70 font-semibold mb-0.5">Capofamiglia selezionato:</p>
                <p className="font-semibold">{registeredUsers.find(u => u.id === selectedFamilyHeadId)?.displayName}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingUser(null)}>Annulla</Button>
            <Button
              disabled={!selectedFamilyHeadId || isLinkingFamily}
              onClick={handleLinkFamily}
            >
              {isLinkingFamily ? 'Collegamento...' : 'Collega Nucleo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
