'use client';

import { useEffect, useState, useMemo } from 'react';
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
  Calendar, Trash2, Download, PieChart,
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
  if (q.type === 'quantity_picker' && q.options) {
    const quantities = value as Record<string, number>;
    return q.options
      .filter(o => quantities[o.id] > 0)
      .map(o => `${o.label} × ${quantities[o.id]}`)
      .join(', ') || '—';
  }
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

// ── Barra progresso per statistiche ─────────────────────────────────────────
function ProgressBar({ pct, color = 'bg-primary' }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// Colori per le opzioni a rotazione
const OPTION_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500',
];

// ── Statistiche per domanda ──────────────────────────────────────────────────
function QuestionStats({ form, responses }: { form: FormSchema; responses: FormResponse[] }) {
  const total = responses.length;

  return (
    <div className="space-y-5">
      {form.questions.map(q => {
        // Domande con opzioni (scelta, prezzo, quantità)
        if (
          q.type === 'single_choice' || q.type === 'multiple_choice' ||
          q.type === 'select' || q.type === 'price_item' || q.type === 'quantity_picker'
        ) {
          if (!q.options || q.options.length === 0) return null;

          // Conta per opzione
          const counts: Record<string, number> = {};
          const totalQty: Record<string, number> = {};
          let answeredCount = 0;

          for (const opt of q.options) {
            counts[opt.id] = 0;
            totalQty[opt.id] = 0;
          }

          for (const r of responses) {
            const ans = r.answers[q.id];
            if (!ans) continue;
            answeredCount++;

            if (q.type === 'quantity_picker') {
              const quantities = ans as Record<string, number>;
              for (const opt of q.options) {
                const qty = quantities[opt.id] ?? 0;
                if (qty > 0) {
                  counts[opt.id]++;        // quante persone hanno scelto quest'opzione
                  totalQty[opt.id] += qty; // quantità totale cumulativa
                }
              }
            } else {
              const ids = Array.isArray(ans) ? ans : [ans as string];
              for (const id of ids) {
                if (counts[id] !== undefined) counts[id]++;
              }
            }
          }

          const isQuantity = q.type === 'quantity_picker';
          const hasPrices = q.options.some(o => o.price != null);
          const maxCount = Math.max(...Object.values(isQuantity ? totalQty : counts), 1);

          return (
            <Card key={q.id} className="overflow-hidden">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-semibold leading-snug">{q.label}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {answeredCount} di {total} risposte
                      {isQuantity && ` · totale unità: ${Object.values(totalQty).reduce((a, b) => a + b, 0)}`}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">
                    {isQuantity ? 'Quantità' : q.type === 'multiple_choice' ? 'Multipla' : 'Singola'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {q.options.map((opt, oi) => {
                  const count = counts[opt.id] ?? 0;
                  const qty = totalQty[opt.id] ?? 0;
                  const displayValue = isQuantity ? qty : count;
                  const pct = total > 0 ? (displayValue / maxCount) * 100 : 0;
                  const pctOfTotal = answeredCount > 0
                    ? ((isQuantity ? count : count) / answeredCount * 100).toFixed(0)
                    : '0';
                  const color = OPTION_COLORS[oi % OPTION_COLORS.length];

                  return (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium truncate flex-1">{opt.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasPrices && opt.price != null && (
                            <span className="text-xs text-muted-foreground">
                              € {opt.price.toFixed(2)}{isQuantity ? '/p' : ''}
                            </span>
                          )}
                          {isQuantity ? (
                            <span className="text-xs tabular-nums font-semibold">
                              <span className="text-primary">{qty} unità</span>
                              <span className="text-muted-foreground ml-1">({count} persone)</span>
                            </span>
                          ) : (
                            <span className="text-xs tabular-nums">
                              <span className="font-semibold">{count}</span>
                              <span className="text-muted-foreground ml-1">({pctOfTotal}%)</span>
                            </span>
                          )}
                          {isQuantity && hasPrices && opt.price != null && qty > 0 && (
                            <span className="text-xs font-bold text-primary tabular-nums">
                              = € {(opt.price * qty).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ProgressBar pct={pct} color={color} />
                    </div>
                  );
                })}

                {/* Totale per le domande con prezzo */}
                {hasPrices && isQuantity && (
                  <>
                    <Separator className="mt-3" />
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-muted-foreground">Totale incasso stimato</span>
                      <span className="text-primary tabular-nums">
                        € {q.options.reduce((sum, o) => sum + (o.price ?? 0) * (totalQty[o.id] ?? 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        }

        // Domande a testo libero / numerico
        if (q.type === 'text' || q.type === 'textarea' || q.type === 'number' ||
          q.type === 'email' || q.type === 'phone') {
          const textAnswers = responses
            .map(r => r.answers[q.id])
            .filter(a => a != null && a !== '');
          const answeredCount = textAnswers.length;

          // Per i numeri: media
          if (q.type === 'number') {
            const nums = textAnswers.map(a => Number(a)).filter(n => !isNaN(n));
            const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
            const min = nums.length > 0 ? Math.min(...nums) : null;
            const max = nums.length > 0 ? Math.max(...nums) : null;

            return (
              <Card key={q.id}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">{q.label}</CardTitle>
                  <CardDescription className="text-xs">{answeredCount} risposte</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {nums.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: 'Media', value: avg?.toFixed(1) },
                        { label: 'Min', value: String(min) },
                        { label: 'Max', value: String(max) },
                      ].map(s => (
                        <div key={s.label} className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nessuna risposta</p>
                  )}
                </CardContent>
              </Card>
            );
          }

          // Testo aperto: mostra le ultime N risposte
          return (
            <Card key={q.id}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{q.label}</CardTitle>
                    <CardDescription className="text-xs">{answeredCount} risposte</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">Testo libero</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1.5 max-h-48 overflow-y-auto">
                {textAnswers.slice(0, 20).map((a, i) => (
                  <p key={i} className="text-sm text-muted-foreground border-l-2 border-muted pl-2 py-0.5">
                    {String(a)}
                  </p>
                ))}
                {textAnswers.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    e altri {textAnswers.length - 20}…
                  </p>
                )}
                {answeredCount === 0 && <p className="text-xs text-muted-foreground">Nessuna risposta</p>}
              </CardContent>
            </Card>
          );
        }

        return null;
      })}
    </div>
  );
}

// ── Componente principale ────────────────────────────────────────────────────
export function FormResponsesDashboard({ form, canEdit }: Props) {
  const firestore = useFirestore();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [collectionRows, setCollectionRows] = useState<FormCollectionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const totalResponses = responses.length;
  const anonymousCount = responses.filter(r => r.isAnonymous).length;
  const linkedCount = responses.filter(r => !r.isAnonymous).length;
  const totalRevenue = responses.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const hasPriceQuestions = form.questions.some(
    q => q.type === 'price_item' || q.type === 'quantity_picker'
  );

  const exportCsv = () => {
    const headers = ['Data', 'Compilatore', 'Email', 'Telefono', 'Tipo', 'Totale €',
      ...form.questions.map(q => q.label)];
    const rows = responses.map(r => [
      formatDate(r.submittedAt),
      r.displayName ?? '—',
      r.email ?? '—',
      (r as any).phone ?? '—',
      r.isAnonymous ? 'Anonimo' : r.userId ? 'Registrato' : 'Esterno',
      r.total?.toFixed(2) ?? '0.00',
      ...form.questions.map(q => getAnswerLabel(form, q.id, r.answers[q.id])),
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
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

  // Tab di default
  const defaultTab = form.generateCollection ? 'raccolta' : 'statistiche';

  return (
    <div className="space-y-4">
      {/* ── Stat cards ── */}
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
              <p className="text-xs text-green-600">Identificati</p>
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
        {hasPriceQuestions && (
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

      <Tabs defaultValue={defaultTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            {form.generateCollection && (
              <TabsTrigger value="raccolta" className="text-xs gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Raccolta
              </TabsTrigger>
            )}
            <TabsTrigger value="statistiche" className="text-xs gap-1.5">
              <PieChart className="h-3.5 w-3.5" />
              Statistiche
            </TabsTrigger>
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
                  Riepilogo automatico per ogni compilatore — {collectionRows.length} righe
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
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">Compilatore</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Riepilogo</TableHead>
                          {hasPriceQuestions && (
                            <TableHead className="text-xs text-right">Totale</TableHead>
                          )}
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collectionRows.map((row, idx) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs text-muted-foreground w-8">
                              {idx + 1}
                            </TableCell>
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
                              <Badge
                                variant={row.userId ? 'default' : 'secondary'}
                                className="text-xs"
                              >
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
                            {hasPriceQuestions && (
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

        {/* ── TAB: STATISTICHE ── */}
        <TabsContent value="statistiche" className="mt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Caricamento...</p>
          ) : responses.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground">
              <PieChart className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nessuna risposta ancora.</p>
              <p className="text-xs mt-1">Le statistiche appariranno quando arriveranno le prime risposte.</p>
            </div>
          ) : (
            <QuestionStats form={form} responses={responses} />
          )}
        </TabsContent>

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
