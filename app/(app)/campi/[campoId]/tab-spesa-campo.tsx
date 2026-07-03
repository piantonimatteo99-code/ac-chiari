'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ShoppingCart, Users, AlertTriangle, Loader2, RefreshCw, CheckCircle2, Circle } from 'lucide-react';
import type { Piatto, GiornoMenu, SlotMenu, TipoPasto, SlotSelezionato, IngredienteDettaglio } from '../tab-spesa';
import { PASTO_LABELS, CAT_LABELS, ALLERGENI_PREDEFINITI, UNITA_MISURA, normalizzaUnita, formattaQuantita, chiaveAggregazione, etichettaPrezzoUnita, fattoreConversione, normalizeSlots, makeSlot, makeGiorno, calcolaCostoPiattoPersona, ottieniAllergeniIngrediente } from '../tab-spesa';

interface SpesaStatoDoc {
  acquistati: string[];
}

interface MenuCampoDoc {
  nPersone: number;
  giorni: GiornoMenu[];
}

export default function TabSpesaCampo({ campoId }: { campoId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [nPersone, setNPersone] = useState(20);
  const [menu, setMenu] = useState<GiornoMenu[]>([makeGiorno(1)]);
  const [acquistati, setAcquistati] = useState<string[]>([]);
  
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [isLoadingStato, setIsLoadingStato] = useState(true);
  const [isSavingStato, setIsSavingStato] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Load global piatti database
  const piattiQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-piatti') : null, [firestore]);
  const { data: piattiData } = useCollection<Piatto>(piattiQ);
  const piatti = piattiData ?? [];

  // Load central ingredient database
  const ingredientiQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-ingredienti') : null, [firestore]);
  const { data: ingredientiData } = useCollection<IngredienteDettaglio>(ingredientiQ);
  const ingredientiDb = ingredientiData ?? [];

  // 1. Carica il menù ed il numero partecipanti
  const loadMenu = useCallback(async () => {
    if (!firestore || !campoId) return;
    setIsLoadingMenu(true);
    setLoadError(false);
    try {
      const snap = await getDoc(doc(firestore, 'campi', campoId, 'dati', 'menu'));
      if (snap.exists()) {
        const data = snap.data() as MenuCampoDoc;
        setNPersone(data.nPersone ?? 20);
        if (data.giorni && data.giorni.length > 0) {
          setMenu(data.giorni);
        }
      }
    } catch (err) {
      console.error('Errore caricamento menu:', err);
      setLoadError(true);
    } finally {
      setIsLoadingMenu(false);
    }
  }, [firestore, campoId]);

  // 2. Carica lo stato degli ingredienti acquistati
  const loadStatoSpesa = useCallback(async () => {
    if (!firestore || !campoId) return;
    setIsLoadingStato(true);
    try {
      const snap = await getDoc(doc(firestore, 'campi', campoId, 'dati', 'spesa'));
      if (snap.exists()) {
        const data = snap.data() as SpesaStatoDoc;
        setAcquistati(data.acquistati ?? []);
      } else {
        setAcquistati([]);
      }
    } catch (err) {
      console.error('Errore caricamento stato spesa:', err);
    } finally {
      setIsLoadingStato(false);
    }
  }, [firestore, campoId]);

  useEffect(() => {
    loadMenu();
    loadStatoSpesa();
  }, [loadMenu, loadStatoSpesa]);

  // 3. Aggiorna lo stato su Firestore al click della checkbox
  const handleToggleAcquistato = async (nomeIngrediente: string, check: boolean) => {
    if (!firestore || !campoId) return;
    setIsSavingStato(true);
    
    let newAcquistati = [...acquistati];
    if (check) {
      if (!newAcquistati.includes(nomeIngrediente)) {
        newAcquistati.push(nomeIngrediente);
      }
    } else {
      newAcquistati = newAcquistati.filter(name => name !== nomeIngrediente);
    }

    setAcquistati(newAcquistati);

    try {
      await setDoc(doc(firestore, 'campi', campoId, 'dati', 'spesa'), {
        acquistati: newAcquistati
      });
    } catch (err) {
      console.error('Errore salvataggio stato spesa:', err);
      toast({
        title: 'Errore nel salvare lo stato',
        description: 'Connessione a internet non stabile.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingStato(false);
    }
  };

  // 4. Calcola e aggrega tutti gli ingredienti dal menù
  const spesaDati = useMemo(() => {
    const totali: Record<string, { 
      valoreBase: number; 
      base: 'g' | 'ml' | 'altro'; 
      unitaOriginale: string;
      allergeni: Set<string>;
    }> = {};
    let costo = 0;
    const intSet = new Set<string>();
    const PASTO_KEYS = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'] as const;

    for (const giorno of menu) {
      for (const key of PASTO_KEYS) {
        const slots = normalizeSlots(giorno[key], key);
        for (const slot of slots) {
          const id = slot.piattoId;
          if (!id) continue;
          const piatto = piatti.find(p => p.id === id);
          if (!piatto) continue;
          
          costo += calcolaCostoPiattoPersona(piatto, ingredientiDb) * nPersone;
          
          // Eredita sia le intolleranze del piatto che gli allergeni definiti nei singoli ingredienti
          piatto.intolleranze?.forEach(i => intSet.add(i));
          piatto.ingredienti?.forEach(ing => {
            const allIng = ottieniAllergeniIngrediente(ing.nome, ingredientiDb);
            allIng.forEach(i => intSet.add(i));
          });
          
          const usaNomePiatto = (piatto.ingredienti?.length ?? 0) === 1;
          piatto.ingredienti?.forEach(ing => {
            const nomeDisplay = usaNomePiatto ? piatto.nome : (ing.nome?.trim() || piatto.nome);
            const { valore, base } = normalizzaUnita(ing.quantitaPerPersona, ing.unita);
            const k = chiaveAggregazione(nomeDisplay, ing.unita);
            
            if (!totali[k]) {
              totali[k] = { valoreBase: 0, base, unitaOriginale: ing.unita, allergeni: new Set() };
            }
            totali[k].valoreBase += valore * nPersone;
            
            // Allergeni specifici dell'ingrediente ereditati sia da campi-ingredienti che dal piatto
            piatto.intolleranze?.forEach(all => totali[k].allergeni.add(all));
            const allIng = ottieniAllergeniIngrediente(ing.nome, ingredientiDb);
            allIng.forEach(all => totali[k].allergeni.add(all));
          });
        }
      }
    }

    const ingredientiTutti = Object.entries(totali)
      .map(([k, v]) => {
        const nome = k.split('__')[0];
        const { quantita, unita } = formattaQuantita(v.valoreBase, v.base, v.unitaOriginale);
        return { 
          nome, 
          quantita, 
          unita,
          allergeni: Array.from(v.allergeni)
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return { 
      ingredientiTutti, 
      costoTotale: costo, 
      intolleranzeUniche: Array.from(intSet) 
    };
  }, [menu, piatti, nPersone, ingredientiDb]);

  // 5. Separa in Da Acquistare e Acquistati
  const { daAcquistare, acquistatiList } = useMemo(() => {
    const daAcq = spesaDati.ingredientiTutti.filter(ing => !acquistati.includes(ing.nome));
    const acq = spesaDati.ingredientiTutti.filter(ing => acquistati.includes(ing.nome));
    return { daAcquistare: daAcq, acquistatiList: acq };
  }, [spesaDati.ingredientiTutti, acquistati]);

  const handleRefresh = () => {
    loadMenu();
    loadStatoSpesa();
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">Impossibile caricare la spesa</p>
          <p className="text-sm text-muted-foreground mt-1">Controlla la connessione internet.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" /> Riprova
        </Button>
      </div>
    );
  }

  if (isLoadingMenu || isLoadingStato) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header preventivo / info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase font-semibold">Costo stimato spesa</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-emerald-600">€ {spesaDati.costoTotale.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase font-semibold">Costo per persona ({nPersone}p)</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">€ {nPersone > 0 ? (spesaDati.costoTotale / nPersone).toFixed(2) : '0.00'}</p></CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase font-semibold">Allergeni del menù</CardTitle></CardHeader>
          <CardContent>
            {spesaDati.intolleranzeUniche.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun allergene</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {spesaDati.intolleranzeUniche.map(i => (
                  <Badge key={i} variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 text-xs px-2 py-0.5">
                    {i}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">Lista spesa</h3>
          <p className="text-sm text-muted-foreground">Spunta gli ingredienti acquistati al supermercato. I dati si sincronizzano in tempo reale.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {spesaDati.ingredientiTutti.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            Nessun ingrediente da acquistare. Aggiungi dei piatti al menù del campo per generare la lista della spesa.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sezione: Da Acquistare */}
          <Card className="border-orange-100 bg-orange-50/5">
            <CardHeader className="pb-3 bg-orange-50/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                  <Circle className="h-5 w-5 text-orange-500" />
                  Da Acquistare
                </CardTitle>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 font-semibold">{daAcquistare.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {daAcquistare.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Ottimo lavoro! Tutto acquistato 🎉</p>
              ) : (
                <div className="divide-y">
                  {daAcquistare.map(ing => (
                    <div key={ing.nome} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          id={`daAcq-${ing.nome}`}
                          checked={false}
                          onCheckedChange={(c) => handleToggleAcquistato(ing.nome, !!c)}
                          className="h-5 w-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500 shrink-0"
                        />
                        <div className="min-w-0">
                          <Label htmlFor={`daAcq-${ing.nome}`} className="font-semibold text-foreground text-sm cursor-pointer block truncate hover:text-orange-600 transition-colors">
                            {ing.nome}
                          </Label>
                          {ing.allergeni.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ing.allergeni.map(all => (
                                <span key={all} className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1 py-0.2 rounded">
                                  {all}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-muted-foreground shrink-0 tabular-nums bg-muted px-2 py-0.5 rounded">
                        {ing.quantita} {ing.unita}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sezione: Acquistati */}
          <Card className="border-emerald-100 bg-emerald-50/5">
            <CardHeader className="pb-3 bg-emerald-50/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Acquistati
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-semibold">{acquistatiList.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {acquistatiList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nessun ingrediente ancora acquistato.</p>
              ) : (
                <div className="divide-y">
                  {acquistatiList.map(ing => (
                    <div key={ing.nome} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3 opacity-60">
                      <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                          id={`acq-${ing.nome}`}
                          checked={true}
                          onCheckedChange={(c) => handleToggleAcquistato(ing.nome, !!c)}
                          className="h-5 w-5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                        />
                        <div className="min-w-0">
                          <Label htmlFor={`acq-${ing.nome}`} className="font-medium text-muted-foreground text-sm cursor-pointer line-through block truncate">
                            {ing.nome}
                          </Label>
                          {ing.allergeni.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ing.allergeni.map(all => (
                                <span key={all} className="text-[10px] font-bold text-muted-foreground/80 bg-muted px-1 py-0.2 rounded">
                                  {all}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground shrink-0 tabular-nums line-through">
                        {ing.quantita} {ing.unita}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
