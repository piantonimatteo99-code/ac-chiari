'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFirestore } from '@/src/firebase';
import {
  collection, collectionGroup, getDocs, addDoc, serverTimestamp,
  deleteDoc, doc, writeBatch, arrayUnion,
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
import { Upload, CheckCircle2, XCircle, Trash2, Download, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import type { Group } from '@/app/(app)/admin/gestione-gruppi/tutti-i-gruppi/page';
import Papa from 'papaparse';

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

// Weights: nome 70, cognome 70, dataNascita 40, codiceFiscale 80 (if present)
function calculateMatchScore(placeholder: ImportedMember, real: RealMember): number {
  const nomeScore = stringSimilarity(placeholder.nome, real.nome) * 70;
  const cognomeScore = stringSimilarity(placeholder.cognome, real.cognome) * 70;
  const dataScore =
    placeholder.dataNascita && real.dataNascita &&
    placeholder.dataNascita === real.dataNascita ? 40 : 0;

  const hasCF = !!(placeholder.codiceFiscale && real.codiceFiscale);
  const cfScore = hasCF
    ? (placeholder.codiceFiscale!.toUpperCase() === real.codiceFiscale!.toUpperCase() ? 80 : 0)
    : 0;

  const maxScore = 70 + 70 + 40 + (hasCF ? 80 : 0);
  const total = nomeScore + cognomeScore + dataScore + cfScore;
  return Math.round((total / maxScore) * 100);
}

const MATCH_THRESHOLD = 70;

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
  const [isConfirming, setIsConfirming] = useState(false);

  // Pairs ignored for this session
  const [ignoredPairs, setIgnoredPairs] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        batch.update(groupDocRef, { memberIds: arrayUnion(pair.realMember.id) });
      }

      // Delete placeholder (irreversible)
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

  const handleDeletePlaceholder = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'imported-members', id));
      setDeletingId(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert("Errore durante l'eliminazione.");
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
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(m.id)}
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
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Placeholder</p>
                  <p className="font-semibold">{confirmingMatch.placeholder.nome} {confirmingMatch.placeholder.cognome}</p>
                  {confirmingMatch.placeholder.gruppo && (
                    <p className="text-xs text-muted-foreground">Gruppo: {confirmingMatch.placeholder.gruppo}</p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
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

      {/* Delete Placeholder Dialog */}
      <Dialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Placeholder</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare questo placeholder? L&apos;operazione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={() => deletingId && handleDeletePlaceholder(deletingId)}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
