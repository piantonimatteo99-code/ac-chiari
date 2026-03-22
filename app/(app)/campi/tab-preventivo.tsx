'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator, TrendingUp, TrendingDown, Users, Home, Bus, ShoppingCart, AlertTriangle, Info } from 'lucide-react';
import type { Casa } from './tab-case';
import type { Pullman } from './tab-pullman';
import type { Piatto } from './tab-spesa';

// ─── Helpers ──────────────────────────────────────────────────────────────────



// ─── Sezione Categoria Persone ────────────────────────────────────────────────

interface CategoriaPersone {
  label: string;
  numero: number;
  quotaRichiesta: number; // € richiesta a questa categoria
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TabPreventivo() {
  const firestore = useFirestore();

  // Dati da Firestore
  const caseQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-case') : null, [firestore]);
  const { data: caseData } = useCollection<Casa>(caseQ);
  const case_list = caseData ?? [];

  const pullmanQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-pullman') : null, [firestore]);
  const { data: pullmanData } = useCollection<Pullman>(pullmanQ);
  const pullman_list = pullmanData ?? [];

  const piattiQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-piatti') : null, [firestore]);
  const { data: piattiData } = useCollection<Piatto>(piattiQ);
  const piatti = piattiData ?? [];

  // ── Selezione casa ──
  const [casaId, setCasaId] = useState<string>('');
  const [nNotti, setNNotti] = useState(5);
  const [costoStagione, setCostoStagione] = useState<'base' | 'estate' | 'inverno'>('base');

  // ── Selezione pullman ──
  const [pullmanId, setPullmanId] = useState<string>('');
  const [costoPullmanManuale, setCostoPullmanManuale] = useState(0);

  // ── Costi aggiuntivi / extra ──
  const [costiExtra, setCostiExtra] = useState<{ descrizione: string; importo: number }[]>([]);

  // ── Partecipanti per categoria ──
  const [categorie, setCategorie] = useState<CategoriaPersone[]>([
    { label: 'Ragazzi', numero: 15, quotaRichiesta: 0 },
    { label: 'Educatori', numero: 4, quotaRichiesta: 0 },
    { label: 'Fratelli', numero: 2, quotaRichiesta: 0 },
  ]);

  // ── Budget massimo ──
  const [budgetMax, setBudgetMax] = useState(0);

  // ── Menù giorni (importato da tab-spesa se vogliamo, ma qui usiamo costo manuale spesa) ──
  const [costoSpesaManuale, setCostoSpesaManuale] = useState(0);


  const aggiornaCat = (idx: number, field: keyof CategoriaPersone, value: any) =>
    setCategorie(p => p.map((c, i) => i === idx ? { ...c, [field]: value } : c));

  const aggiungiCategoria = () =>
    setCategorie(p => [...p, { label: 'Nuova categoria', numero: 0, quotaRichiesta: 0 }]);

  const rimuoviCategoria = (idx: number) =>
    setCategorie(p => p.filter((_, i) => i !== idx));

  const aggiungiExtra = () =>
    setCostiExtra(p => [...p, { descrizione: '', importo: 0 }]);

  const aggiornaExtra = (idx: number, field: 'descrizione' | 'importo', value: any) =>
    setCostiExtra(p => p.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const rimuoviExtra = (idx: number) =>
    setCostiExtra(p => p.filter((_, i) => i !== idx));

  // ── Calcoli ──────────────────────────────────────────────────────────────────

  const nTotalePersone = useMemo(() => categorie.reduce((s, c) => s + c.numero, 0), [categorie]);

  const casaSelezionata = useMemo(() => case_list.find(c => c.id === casaId), [case_list, casaId]);

  const costoCasa = useMemo(() => {
    if (!casaSelezionata) return 0;
    let base = costoStagione === 'estate' && casaSelezionata.costoEstate
      ? casaSelezionata.costoEstate
      : costoStagione === 'inverno' && casaSelezionata.costoInverno
        ? casaSelezionata.costoInverno
        : casaSelezionata.costoValore;

    switch (casaSelezionata.costoTipo) {
      case 'notte': return base * nNotti;
      case 'giorno': return base * nNotti;
      case 'stanza': return base; // forfait generico
      case 'forfait': return base;
      default: return base;
    }
  }, [casaSelezionata, nNotti, costoStagione]);



  const costoSpesaCalc = costoSpesaManuale;

  const totaleExtra = useMemo(() => costiExtra.reduce((s, e) => s + (e.importo || 0), 0), [costiExtra]);

  const totaleCosti = useMemo(() =>
    costoCasa + costoPullmanManuale + costoSpesaCalc + totaleExtra,
    [costoCasa, costoPullmanManuale, costoSpesaCalc, totaleExtra]);

  const totaleEntrateRichieste = useMemo(() =>
    categorie.reduce((s, c) => s + c.numero * c.quotaRichiesta, 0),
    [categorie]);

  const saldo = useMemo(() => totaleEntrateRichieste - totaleCosti, [totaleEntrateRichieste, totaleCosti]);

  const costoPerPersona = useMemo(() =>
    nTotalePersone > 0 ? totaleCosti / nTotalePersone : 0,
    [totaleCosti, nTotalePersone]);

  const isSopraBudget = budgetMax > 0 && totaleCosti > budgetMax;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5" />
        <h2 className="text-xl font-semibold">Preventivo costi</h2>
      </div>

      {/* Alert budget */}
      {isSopraBudget && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attenzione: budget superato!</AlertTitle>
          <AlertDescription>
            I costi totali (€ {totaleCosti.toFixed(2)}) superano il budget massimo impostato (€ {budgetMax.toFixed(2)}) di <strong>€ {(totaleCosti - budgetMax).toFixed(2)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Colonna sinistra: Inputs ── */}
        <div className="space-y-5">

          {/* Sezione Casa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" />Alloggio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Struttura</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={casaId}
                  onChange={e => setCasaId(e.target.value)}
                >
                  <option value="">— Nessuna / inserisci manualmente —</option>
                  {case_list.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {casaSelezionata && (
                <div className="p-3 bg-muted/50 rounded text-xs space-y-1">
                  <p>💶 Costo base: <strong>€ {casaSelezionata.costoValore}</strong> {casaSelezionata.costoTipo === 'notte' ? 'a notte' : casaSelezionata.costoTipo === 'giorno' ? 'al giorno' : casaSelezionata.costoTipo}</p>
                  {casaSelezionata.interpretazioneAI && <p className="flex gap-1"><Info className="h-3 w-3 shrink-0 mt-0.5 text-blue-500" />{casaSelezionata.interpretazioneAI}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Stagione</Label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={costoStagione}
                    onChange={e => setCostoStagione(e.target.value as any)}
                  >
                    <option value="base">Base</option>
                    <option value="estate">Estate</option>
                    <option value="inverno">Inverno</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>N° notti / giorni</Label>
                  <Input type="number" min={1} value={nNotti} onChange={e => setNNotti(parseInt(e.target.value) || 1)} />
                </div>
              </div>

              {!casaSelezionata && (
                <div className="space-y-1">
                  <Label>Costo alloggio manuale (€)</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={costoCasa === 0 ? '' : costoCasa}
                    onChange={e => { /* override calcolato */ }}
                    placeholder="Verrà calcolato dalla struttura selezionata"
                    disabled={!!casaSelezionata}
                  />
                </div>
              )}

              <div className="flex justify-between text-sm font-medium pt-1">
                <span>Totale alloggio:</span>
                <span className="text-primary">€ {costoCasa.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Sezione Pullman */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Bus className="h-4 w-4" />Trasporto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Azienda pullman</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={pullmanId}
                  onChange={e => setPullmanId(e.target.value)}
                >
                  <option value="">— Nessuno —</option>
                  {pullman_list.map(p => <option key={p.id} value={p.id}>{p.azienda}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Costo pullman (€) — inserisci il preventivo</Label>
                <Input type="number" min={0} step={0.01} value={costoPullmanManuale} onChange={e => setCostoPullmanManuale(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Totale trasporto:</span>
                <span className="text-primary">€ {costoPullmanManuale.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Sezione Spesa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Spesa alimentare</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Costo totale spesa (€)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={costoSpesaManuale}
                  onChange={e => setCostoSpesaManuale(parseFloat(e.target.value) || 0)}
                  placeholder="Inserisci il totale dalla sezione Spesa"
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Puoi copiare il totale calcolato dalla sezione "Spesa"
              </p>
              <div className="flex justify-between text-sm font-medium">
                <span>Totale spesa:</span>
                <span className="text-primary">€ {costoSpesaManuale.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Costi extra */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Costi aggiuntivi</CardTitle>
                <button onClick={aggiungiExtra} className="text-xs text-primary hover:underline flex items-center gap-0.5">+ Aggiungi voce</button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {costiExtra.length === 0 && <p className="text-sm text-muted-foreground">Nessun costo aggiuntivo.</p>}
              {costiExtra.map((e, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={e.descrizione} onChange={ev => aggiornaExtra(i, 'descrizione', ev.target.value)} placeholder="Descrizione" className="flex-1" />
                  <Input type="number" min={0} step={0.01} value={e.importo} onChange={ev => aggiornaExtra(i, 'importo', parseFloat(ev.target.value) || 0)} className="w-28" />
                  <button onClick={() => rimuoviExtra(i)} className="text-destructive text-xs">✕</button>
                </div>
              ))}
              {costiExtra.length > 0 && (
                <div className="flex justify-between text-sm font-medium pt-1">
                  <span>Totale extra:</span>
                  <span className="text-primary">€ {totaleExtra.toFixed(2)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Colonna destra: Partecipanti + Riepilogo ── */}
        <div className="space-y-5">

          {/* Budget massimo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Budget massimo (opzionale)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number" min={0} step={10}
                value={budgetMax || ''}
                onChange={e => setBudgetMax(parseFloat(e.target.value) || 0)}
                placeholder="es. 3000 — per visualizzare avvisi"
              />
            </CardContent>
          </Card>

          {/* Partecipanti per categoria */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Partecipanti per categoria</CardTitle>
                <button onClick={aggiungiCategoria} className="text-xs text-primary hover:underline">+ Categoria</button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {categorie.map((cat, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                  <Input value={cat.label} onChange={e => aggiornaCat(i, 'label', e.target.value)} placeholder="Categoria" />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground">N°</span>
                    <Input type="number" min={0} value={cat.numero} onChange={e => aggiornaCat(i, 'numero', parseInt(e.target.value) || 0)} className="w-16 text-center" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-muted-foreground">Quota €</span>
                    <Input type="number" min={0} step={0.5} value={cat.quotaRichiesta} onChange={e => aggiornaCat(i, 'quotaRichiesta', parseFloat(e.target.value) || 0)} className="w-20 text-center" />
                  </div>
                  {categorie.length > 1
                    ? <button onClick={() => rimuoviCategoria(i)} className="text-destructive text-xs">✕</button>
                    : <span />}
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-2 border-t">
                <span>Totale partecipanti:</span>
                <Badge>{nTotalePersone} persone</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Riepilogo totale */}
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />Riepilogo costi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">🏠 Alloggio</span><span>€ {costoCasa.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🚌 Trasporto</span><span>€ {costoPullmanManuale.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🛒 Spesa</span><span>€ {costoSpesaManuale.toFixed(2)}</span></div>
              {costiExtra.map((e, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted-foreground">{e.descrizione || `Extra ${i + 1}`}</span><span>€ {(e.importo || 0).toFixed(2)}</span></div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Totale costi</span><span className="text-primary">€ {totaleCosti.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Costo per persona</span><span>€ {costoPerPersona.toFixed(2)}</span></div>

              <Separator />

              <div className="space-y-1">
                <p className="font-medium">Entrate per categoria</p>
                {categorie.map((cat, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{cat.label} ({cat.numero} × € {cat.quotaRichiesta})</span>
                    <span>€ {(cat.numero * cat.quotaRichiesta).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Totale entrate</span><span>€ {totaleEntrateRichieste.toFixed(2)}</span></div>
              <div className={`flex justify-between font-bold text-base ${saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                <span className="flex items-center gap-1">
                  {saldo >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {saldo >= 0 ? 'Avanzo' : 'Deficit'}
                </span>
                <span>€ {Math.abs(saldo).toFixed(2)}</span>
              </div>

              {budgetMax > 0 && (
                <div className={`flex justify-between text-sm mt-1 ${isSopraBudget ? 'text-destructive' : 'text-green-600'}`}>
                  <span>Budget max</span>
                  <span>€ {budgetMax.toFixed(2)} {isSopraBudget ? '⚠ Superato' : '✓ OK'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
