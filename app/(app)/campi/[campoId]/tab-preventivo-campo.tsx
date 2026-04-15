'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator, TrendingUp, TrendingDown, Users, Home, Bus, ShoppingCart, AlertTriangle, Info, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import type { Casa } from '../tab-case';
import type { Pullman } from '../tab-pullman';

interface CategoriaPersone {
  label: string;
  numero: number;
  quotaRichiesta: number;
}

interface PreventivoConfig {
  casaId: string;
  nNotti: number;
  costoStagione: 'base' | 'estate' | 'inverno';
  pullmanId: string;
  costoPullmanManuale: number;
  costoSpesaManuale: number;
  costiExtra: { descrizione: string; importo: number }[];
  categorie: CategoriaPersone[];
  budgetMax: number;
}

const DEFAULT_CONFIG: PreventivoConfig = {
  casaId: '',
  nNotti: 5,
  costoStagione: 'base',
  pullmanId: '',
  costoPullmanManuale: 0,
  costoSpesaManuale: 0,
  costiExtra: [],
  categorie: [
    { label: 'Ragazzi', numero: 15, quotaRichiesta: 0 },
    { label: 'Educatori', numero: 4, quotaRichiesta: 0 },
  ],
  budgetMax: 0,
};

export default function TabPreventivooCampo({ campoId, costoSpesaCalcolato }: { campoId: string; costoSpesaCalcolato?: number }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const caseQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-case') : null, [firestore]);
  const { data: caseData } = useCollection<Casa>(caseQ);
  const case_list = caseData ?? [];

  const pullmanQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-pullman') : null, [firestore]);
  const { data: pullmanData } = useCollection<Pullman>(pullmanQ);
  const pullman_list = pullmanData ?? [];

  const [config, setConfig] = useState<PreventivoConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load config from Firestore
  useEffect(() => {
    if (!firestore || !campoId) return;
    setIsLoading(true);
    getDoc(doc(firestore, 'campi', campoId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.preventivoConfig) {
          setConfig({ ...DEFAULT_CONFIG, ...d.preventivoConfig });
        }
      }
    }).finally(() => setIsLoading(false));
  }, [firestore, campoId]);

  const saveConfig = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'campi', campoId), { preventivoConfig: config });
      toast({ title: 'Preventivo salvato' });
    } catch {
      toast({ title: 'Errore nel salvataggio', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const update = <K extends keyof PreventivoConfig>(key: K, value: PreventivoConfig[K]) =>
    setConfig(c => ({ ...c, [key]: value }));

  const aggiornaCat = (idx: number, field: keyof CategoriaPersone, value: any) =>
    setConfig(c => ({ ...c, categorie: c.categorie.map((cat, i) => i === idx ? { ...cat, [field]: value } : cat) }));

  const aggiungiCategoria = () =>
    setConfig(c => ({ ...c, categorie: [...c.categorie, { label: 'Nuova categoria', numero: 0, quotaRichiesta: 0 }] }));

  const rimuoviCategoria = (idx: number) =>
    setConfig(c => ({ ...c, categorie: c.categorie.filter((_, i) => i !== idx) }));

  const aggiungiExtra = () =>
    setConfig(c => ({ ...c, costiExtra: [...c.costiExtra, { descrizione: '', importo: 0 }] }));

  const aggiornaExtra = (idx: number, field: 'descrizione' | 'importo', value: any) =>
    setConfig(c => ({ ...c, costiExtra: c.costiExtra.map((e, i) => i === idx ? { ...e, [field]: value } : e) }));

  const rimuoviExtra = (idx: number) =>
    setConfig(c => ({ ...c, costiExtra: c.costiExtra.filter((_, i) => i !== idx) }));

  // Calcoli
  const nTotalePersone = useMemo(() => config.categorie.reduce((s, c) => s + c.numero, 0), [config.categorie]);
  const casaSelezionata = useMemo(() => case_list.find(c => c.id === config.casaId), [case_list, config.casaId]);

  const costoCasa = useMemo(() => {
    if (!casaSelezionata) return 0;
    const base = config.costoStagione === 'estate' && casaSelezionata.costoEstate
      ? casaSelezionata.costoEstate
      : config.costoStagione === 'inverno' && casaSelezionata.costoInverno
        ? casaSelezionata.costoInverno
        : casaSelezionata.costoValore;

    switch (casaSelezionata.costoTipo) {
      case 'notte': case 'giorno': return base * config.nNotti;
      default: return base;
    }
  }, [casaSelezionata, config.nNotti, config.costoStagione]);

  const totaleExtra = useMemo(() => config.costiExtra.reduce((s, e) => s + (e.importo || 0), 0), [config.costiExtra]);
  // Use computed cost from menu if available, otherwise use manual override
  const costoSpesaEffettivo = costoSpesaCalcolato !== undefined ? costoSpesaCalcolato : config.costoSpesaManuale;
  const totaleCosti = useMemo(() => costoCasa + config.costoPullmanManuale + costoSpesaEffettivo + totaleExtra, [costoCasa, config.costoPullmanManuale, costoSpesaEffettivo, totaleExtra]);
  const totaleEntrate = useMemo(() => config.categorie.reduce((s, c) => s + c.numero * c.quotaRichiesta, 0), [config.categorie]);
  const saldo = useMemo(() => totaleEntrate - totaleCosti, [totaleEntrate, totaleCosti]);
  const costoPerPersona = useMemo(() => nTotalePersone > 0 ? totaleCosti / nTotalePersone : 0, [totaleCosti, nTotalePersone]);
  const isSopraBudget = config.budgetMax > 0 && totaleCosti > config.budgetMax;

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Preventivo costi</h2>
        </div>
        <Button onClick={saveConfig} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Salva preventivo
        </Button>
      </div>

      {isSopraBudget && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attenzione: budget superato!</AlertTitle>
          <AlertDescription>
            I costi totali (€ {totaleCosti.toFixed(2)}) superano il budget massimo (€ {config.budgetMax.toFixed(2)}) di <strong>€ {(totaleCosti - config.budgetMax).toFixed(2)}</strong>.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Colonna sinistra: Inputs ── */}
        <div className="space-y-5">

          {/* Alloggio */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Home className="h-4 w-4" />Alloggio</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Struttura</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={config.casaId} onChange={e => update('casaId', e.target.value)}>
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
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={config.costoStagione} onChange={e => update('costoStagione', e.target.value as any)}>
                    <option value="base">Base</option>
                    <option value="estate">Estate</option>
                    <option value="inverno">Inverno</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>N° notti / giorni</Label>
                  <Input type="number" min={1} value={config.nNotti} onChange={e => update('nNotti', parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="flex justify-between text-sm font-medium pt-1">
                <span>Totale alloggio:</span>
                <span className="text-primary">€ {costoCasa.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pullman */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bus className="h-4 w-4" />Trasporto</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Azienda pullman</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={config.pullmanId} onChange={e => update('pullmanId', e.target.value)}>
                  <option value="">— Nessuno —</option>
                  {pullman_list.map(p => <option key={p.id} value={p.id}>{p.azienda}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Costo pullman (€) — inserisci il preventivo</Label>
                <Input type="number" min={0} step={0.01} value={config.costoPullmanManuale} onChange={e => update('costoPullmanManuale', parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Totale trasporto:</span>
                <span className="text-primary">€ {config.costoPullmanManuale.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Spesa */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Spesa alimentare</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {costoSpesaCalcolato !== undefined ? (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-300 font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Calcolato dal Menù: <strong>€ {costoSpesaCalcolato.toFixed(2)}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Aggiorna il menù per modificare questo valore.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Costo totale spesa (€)</Label>
                    <Input type="number" min={0} step={0.01} value={config.costoSpesaManuale} onChange={e => update('costoSpesaManuale', parseFloat(e.target.value) || 0)} placeholder="Inserisci dalla sezione Menù" />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />Compila il Menù per auto-calcolare questo valore.
                  </p>
                </>
              )}
              <div className="flex justify-between text-sm font-medium">
                <span>Totale spesa:</span>
                <span className="text-primary">€ {costoSpesaEffettivo.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Costi extra */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Costi aggiuntivi</CardTitle>
                <button onClick={aggiungiExtra} className="text-xs text-primary hover:underline">+ Aggiungi voce</button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {config.costiExtra.length === 0 && <p className="text-sm text-muted-foreground">Nessun costo aggiuntivo.</p>}
              {config.costiExtra.map((e, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={e.descrizione} onChange={ev => aggiornaExtra(i, 'descrizione', ev.target.value)} placeholder="Descrizione" className="flex-1" />
                  <Input type="number" min={0} step={0.01} value={e.importo} onChange={ev => aggiornaExtra(i, 'importo', parseFloat(ev.target.value) || 0)} className="w-28" />
                  <button onClick={() => rimuoviExtra(i)} className="text-destructive text-xs">✕</button>
                </div>
              ))}
              {config.costiExtra.length > 0 && (
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
          {/* Budget */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Budget massimo (opzionale)</CardTitle></CardHeader>
            <CardContent>
              <Input type="number" min={0} step={10} value={config.budgetMax || ''} onChange={e => update('budgetMax', parseFloat(e.target.value) || 0)} placeholder="es. 3000" />
            </CardContent>
          </Card>

          {/* Partecipanti */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Partecipanti per categoria</CardTitle>
                <button onClick={aggiungiCategoria} className="text-xs text-primary hover:underline">+ Categoria</button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.categorie.map((cat, i) => (
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
                  {config.categorie.length > 1 ? <button onClick={() => rimuoviCategoria(i)} className="text-destructive text-xs">✕</button> : <span />}
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-2 border-t">
                <span>Totale partecipanti:</span>
                <Badge>{nTotalePersone} persone</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Riepilogo */}
          <Card className="border-2">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4" />Riepilogo costi</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">🏠 Alloggio</span><span>€ {costoCasa.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🚌 Trasporto</span><span>€ {config.costoPullmanManuale.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">🛒 Spesa</span><span>€ {costoSpesaEffettivo.toFixed(2)}</span></div>
              {config.costiExtra.map((e, i) => (
                <div key={i} className="flex justify-between"><span className="text-muted-foreground">{e.descrizione || `Extra ${i + 1}`}</span><span>€ {(e.importo || 0).toFixed(2)}</span></div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Totale costi</span><span className="text-primary">€ {totaleCosti.toFixed(2)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Costo per persona</span><span>€ {costoPerPersona.toFixed(2)}</span></div>
              <Separator />
              <div className="space-y-1">
                <p className="font-medium">Entrate per categoria</p>
                {config.categorie.map((cat, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{cat.label} ({cat.numero} × € {cat.quotaRichiesta})</span>
                    <span>€ {(cat.numero * cat.quotaRichiesta).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Totale entrate</span><span>€ {totaleEntrate.toFixed(2)}</span></div>
              <div className={`flex justify-between font-bold text-base ${saldo >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                <span className="flex items-center gap-1">
                  {saldo >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {saldo >= 0 ? 'Avanzo' : 'Deficit'}
                </span>
                <span>€ {Math.abs(saldo).toFixed(2)}</span>
              </div>
              {config.budgetMax > 0 && (
                <div className={`flex justify-between text-sm mt-1 ${isSopraBudget ? 'text-destructive' : 'text-green-600'}`}>
                  <span>Budget max</span>
                  <span>€ {config.budgetMax.toFixed(2)} {isSopraBudget ? '⚠ Superato' : '✓ OK'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
