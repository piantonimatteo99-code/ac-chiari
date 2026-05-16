'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, where, onSnapshot, deleteDoc, doc, orderBy,
} from 'firebase/firestore';
import { useFirestore } from '@/src/firebase';
import type { FormResponse, FormSchema, FormCollectionRow } from '@/src/types/form-types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Users, BarChart2, Euro, UserCircle2, ShieldCheck,
  Calendar, Trash2, Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Props {
  form: FormSchema;
  canEdit: boolean;
}

function formatDate(ts: any) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return format(d, 'dd MMM yyyy HH:mm', { locale: it });
}

function getAnswerLabel(form: FormSchema, questionId: string, value: any): string {
  const q = form.questions.find(q => q.id === questionId);
  if (!q) return String(value ?? '—');
  if (!value && value !== 0) return '—';
  if (q.type === 'single_choice' || q.type === 'select' || q.type === 'price_item') {
    const ids = Array.isArray(value) ? value : [value];
    return ids.map((id: string) => q.options?.find(o => o.id === id)?.label ?? id).join(', ');
  }
  if (q.type === 'multiple_choice') {
    const ids = Array.isArray(value) ? value : [value];
    return ids.map((id: string) => q.options?.find(o => o.id === id)?.label ?? id).join(', ');
  }
  return String(value);
}

export function FormResponsesDashboard({ form, canEdit }: Props) {
  const firestore = useFirestore();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [collectionRows, setCollectionRows] = useState<FormCollectionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ascolta risposte in real-time
  useEffect(() => {
    if (!firestore) return;
    const q = query(
      collection(firestore, 'form_responses'),
      where('formId', '==', form.id),
      orderBy('submittedAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() } as FormResponse)));
      setIsLoading(false);
    });
    return () => unsub();
  }, [firestore, form.id]);

  // Ascolta righe raccolta automatica
  useEffect(() => {
    if (!firestore || !form.generateCollection) return;
    const q = query(
      collection(firestore, 'form_collection_rows'),
      where('formId', '==', form.id),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setCollectionRows(snap.docs.map(d => ({ id: d.id, ...d.data() } as FormCollectionRow)));
    });
    return () => unsub();
  }, [firestore, form.id, form.generateCollection]);

  // Statistiche
  const totalResponses = responses.length;
  const anonymousCount = responses.filter(r => r.isAnonymous).length;
  const linkedCount = responses.filter(r => !r.isAnonymous).length;
  const totalRevenue = responses.reduce((sum, r) => sum + (r.total ?? 0), 0);

  // Esportazione CSV
  const exportCsv = () => {
    const headers = ['Data', 'Compilatore', 'Email', 'Tipo', 'Totale €',
      ...form.questions.map(q => q.label)];
    const rows = responses.map(r => [
      formatDate(r.submittedAt),
      r.displayName ?? '—',
      r.email ?? '—',
      r.isAnonymous ? 'Anonimo' : 'Registrato',
      r.total?.toFixed(2) ?? '0.00',
      ...form.questions.map(q => getAnswerLabel(form, q.id, r.answers[q.id])),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risposte-${form.title.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteResponse = async (responseId: string) => {
    if (!firestore || !canEdit) return;
    if (!confirm('Eliminare questa risposta?')) return;
    await deleteDoc(doc(firestore, 'form_responses', responseId));
  };

  return (
    <div className="space-y-4">
      {/* Statistiche */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{totalResponses}</p>
              <p className="text-xs text-blue-600">Risposte totali</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50/50 border-green-200">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">{linkedCount}</p>
              <p className="text-xs text-green-600">Utenti registrati</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="p-3 flex items-center gap-3">
            <UserCircle2 className="h-6 w-6 text-amber-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-amber-700">{anonymousCount}</p>
              <p className="text-xs text-amber-600">Anonimi</p>
            </div>
          </CardContent>
        </Card>
        {form.questions.some(q => q.type === 'price_item') && (
          <Card className="bg-purple-50/50 border-purple-200">
            <CardContent className="p-3 flex items-center gap-3">
              <Euro className="h-6 w-6 text-purple-600 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-purple-700">€ {totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-purple-600">Totale raccolto</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue={form.generateCollection ? 'raccolta' : 'risposte'}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            {form.generateCollection && (
              <TabsTrigger value="raccolta" className="text-xs gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Raccolta
              </TabsTrigger>
            )}
            <TabsTrigger value="risposte" className="text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Risposte singole
            </TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={exportCsv}>
            <Download className="h-3 w-3" />
            Esporta CSV
          </Button>
        </div>

        {/* ── TAB: RACCOLTA AUTOMATICA ── */}
        {form.generateCollection && (
          <TabsContent value="raccolta" className="mt-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{form.collectionTitle ?? form.title}</CardTitle>
                <CardDescription className="text-xs">
                  Riepilogo automatico per ogni compilatore identificato
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {collectionRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nessuna risposta ancora nella raccolta.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">Compilatore</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Riepilogo</TableHead>
                          {form.questions.some(q => q.type === 'price_item') && (
                            <TableHead className="text-xs text-right">Totale</TableHead>
                          )}
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collectionRows.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="text-sm font-medium">
                              <div>
                                <p>{row.displayName}</p>
                                {row.email && (
                                  <p className="text-xs text-muted-foreground">{row.email}</p>
                                )}
                                {(row as any).phone && (
                                  <p className="text-xs text-muted-foreground">{(row as any).phone}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={row.userId ? 'default' : 'secondary'} className="text-xs">
                                {row.userId ? 'Registrato' : 'Esterno'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                              {row.summaryLines.map((l, i) => (
                                <span key={i} className="block">
                                  <span className="font-medium text-foreground">{l.label}:</span> {l.value}
                                </span>
                              ))}
                            </TableCell>
                            {form.questions.some(q => q.type === 'price_item') && (
                              <TableCell className="text-right font-bold text-primary tabular-nums">
                                {row.total != null ? `€ ${row.total.toFixed(2)}` : '—'}
                              </TableCell>
                            )}
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(row.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── TAB: RISPOSTE SINGOLE ── */}
        <TabsContent value="risposte" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Caricamento...</p>
          ) : responses.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nessuna risposta ancora.</p>
              <p className="text-xs mt-1">Condividi il link del modulo per raccogliere risposte.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map(r => (
                <Card key={r.id} className="overflow-hidden">
                  <CardHeader className="py-2 px-4 bg-muted/20 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${r.isAnonymous ? 'bg-amber-400' : r.userId ? 'bg-green-500' : 'bg-blue-400'}`} />
                        <p className="text-sm font-medium truncate">
                          {r.displayName ?? 'Sconosciuto'}
                          {r.email && <span className="text-muted-foreground font-normal ml-1.5">({r.email})</span>}
                          {(r as any).phone && <span className="text-muted-foreground font-normal ml-1.5">☎ {(r as any).phone}</span>}
                        </p>
                        <Badge
                          variant={r.userId ? 'default' : r.isAnonymous ? 'outline' : 'secondary'}
                          className="text-xs shrink-0"
                        >
                          {r.userId ? 'Registrato' : r.isAnonymous ? 'Anonimo' : 'Esterno'}
                        </Badge>
                      </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.total != null && r.total > 0 && (
                        <span className="text-sm font-bold text-primary tabular-nums">
                          € {r.total.toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(r.submittedAt)}
                      </span>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteResponse(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 py-3">
                    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                      {form.questions.map(q => {
                        const label = getAnswerLabel(form, q.id, r.answers[q.id]);
                        if (label === '—') return null;
                        return (
                          <div key={q.id} className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">{q.label}</p>
                            <p className="text-sm font-medium">{label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
