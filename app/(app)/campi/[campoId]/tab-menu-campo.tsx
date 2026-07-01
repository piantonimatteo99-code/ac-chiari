'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/src/firebase';
import { collection, collectionGroup, doc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, Users, ShoppingCart, AlertTriangle, ChevronDown, ChevronUp, Download, CheckCheck } from 'lucide-react';
import type { Piatto, TipoPasto, SlotMenu, GiornoMenu, SlotSelezionato } from '../tab-spesa';
import { PASTO_LABELS, CAT_LABELS, normalizzaUnita, formattaQuantita, chiaveAggregazione, normalizeSlots, makeSlot, makeGiorno } from '../tab-spesa';
import { generaPdfMenu, type PartecipantePdf } from '@/lib/genera-pdf-menu';

interface MenuCampoDoc {
  nPersone: number;
  giorni: GiornoMenu[];
  updatedAt?: any;
}

interface TabMenuCampoProps {
  campoId: string;
  canEdit: boolean;
  raccoltaId?: string;        // ID della raccolta fondi collegata, per caricare i partecipanti
  onCostoSpesaChange?: (costo: number) => void;
}

function SlotSelector({ value, onChange, piatti, label, categoria, tipoPasto }: {
  value?: string;
  onChange: (id: string | undefined) => void;
  piatti: Piatto[];
  label: string;
  categoria: string;
  tipoPasto: TipoPasto;
}) {
  const isColMer = tipoPasto === 'colazione' || tipoPasto === 'merenda_mattina' || tipoPasto === 'merenda';
  let catFiltro: string[];

  const c = categoria?.toLowerCase();
  if (c === 'primo') {
    catFiltro = ['primo', 'altro'];
  } else if (c === 'secondo') {
    catFiltro = ['secondo', 'altro'];
  } else if (c === 'contorno') {
    catFiltro = ['contorno', 'altro'];
  } else if (c === 'frutta') {
    catFiltro = ['frutta', 'altro'];
  } else if (c === 'colazione') {
    catFiltro = ['colazione', 'dolce', 'dessert', 'altro'];
  } else if (c === 'merenda' || c === 'merenda_mattina') {
    catFiltro = ['merenda', 'dolce', 'dessert', 'altro'];
  } else {
    // Slot personalizzato o altro
    catFiltro = isColMer
      ? ['colazione', 'merenda', 'dolce', 'dessert', 'altro']
      : ['primo', 'secondo', 'contorno', 'frutta', 'dolce', 'dessert', 'altro'];
  }

  // Confronto case-insensitive per compatibilità con piatti salvati con maiuscola
  const piattiFiltered = piatti.filter(p => catFiltro.includes(p.categoria?.toLowerCase()));
  const selectedPiatto = piatti.find(p => p.id === value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <Select value={value ?? '__none__'} onValueChange={v => onChange(v === '__none__' ? undefined : v)}>
        <SelectTrigger className="h-8 text-xs flex-1">
          <SelectValue placeholder="— nessuno —" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— nessuno —</SelectItem>
          {piattiFiltered.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.nome} {p.costoPorzione > 0 ? `(€${p.costoPorzione.toFixed(2)}/p)` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedPiatto?.intolleranze?.length ? (
        <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 shrink-0">
          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
          {selectedPiatto.intolleranze.join(', ')}
        </Badge>
      ) : null}
    </div>
  );
}

// ─── Lista Spesa Calcolata ────────────────────────────────────────────────────
function CalcolaSpesa({ menu, piatti, nPersone }: { menu: GiornoMenu[]; piatti: Piatto[]; nPersone: number }) {
  const { ingredientiTotali, costoTotale, intolleranzeUniche } = useMemo(() => {
    const totali: Record<string, { valoreBase: number; base: 'g' | 'ml' | 'altro'; unitaOriginale: string }> = {};
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
          costo += (piatto.costoPorzione || 0) * nPersone;
          piatto.intolleranze?.forEach(i => intSet.add(i));
          const usaNomePiatto = (piatto.ingredienti?.length ?? 0) === 1;
          piatto.ingredienti?.forEach(ing => {
            const nomeDisplay = usaNomePiatto ? piatto.nome : (ing.nome?.trim() || piatto.nome);
            const { valore, base } = normalizzaUnita(ing.quantitaPerPersona, ing.unita);
            const k = chiaveAggregazione(nomeDisplay, ing.unita);
            if (!totali[k]) totali[k] = { valoreBase: 0, base, unitaOriginale: ing.unita };
            totali[k].valoreBase += valore * nPersone;
          });
        }
      }
    }

    const ingredientiTotali = Object.entries(totali)
      .map(([k, v]) => {
        const nome = k.split('__')[0];
        const { quantita, unita } = formattaQuantita(v.valoreBase, v.base, v.unitaOriginale);
        return { nome, quantita, unita };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));

    return { ingredientiTotali, costoTotale: costo, intolleranzeUniche: Array.from(intSet) };
  }, [menu, piatti, nPersone]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Costo totale spesa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">€ {costoTotale.toFixed(2)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Per persona</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">€ {nPersone > 0 ? (costoTotale / nPersone).toFixed(2) : '0.00'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Intolleranze</CardTitle></CardHeader>
          <CardContent>
            {intolleranzeUniche.length === 0
              ? <p className="text-sm text-muted-foreground">Nessuna</p>
              : <div className="flex flex-wrap gap-1">{intolleranzeUniche.map(i => <Badge key={i} variant="outline" className="border-orange-400 text-orange-600 text-xs">{i}</Badge>)}</div>
            }
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Lista della spesa ({nPersone} persone)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ingredientiTotali.length === 0
            ? <p className="text-muted-foreground text-sm">Nessun ingrediente calcolato. Inserisci il menù prima.</p>
            : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ingredientiTotali.map(ing => (
                  <div key={`${ing.nome}-${ing.unita}`} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span className="font-medium">{ing.nome}</span>
                    <span className="text-muted-foreground tabular-nums">{ing.quantita} {ing.unita}</span>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TabMenuCampo({ campoId, canEdit, raccoltaId, onCostoSpesaChange }: TabMenuCampoProps) {
  const firestore = useFirestore();
  const { userData } = useUserData();
  const { toast } = useToast();

  // Load global piatti database
  const piattiQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-piatti') : null, [firestore]);
  const { data: piattiData } = useCollection<Piatto>(piattiQ);
  const piatti = piattiData ?? [];

  // Load persisted menu for this campo
  const menuDocRef = useMemoFirebase(
    () => firestore && campoId ? doc(firestore, 'campi', campoId, 'dati', 'menu') : null,
    [firestore, campoId]
  );
  const { data: menuDoc, isLoading: isLoadingMenu } = useDoc<MenuCampoDoc>(menuDocRef);

  const [nPersone, setNPersone] = useState(20);
  const [menu, setMenu] = useState<GiornoMenu[]>([makeGiorno(1)]);
  const [isSavingAuto, setIsSavingAuto] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [expandedGiorno, setExpandedGiorno] = useState<number>(0);

  // Refs per auto-save
  const isReadyToAutoSave = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false); // carica da Firestore solo al primo load

  // Inizializza lo stato dal documento Firestore UNA SOLA VOLTA.
  // useDoc è un listener real-time: senza questo guard, ogni salvataggio
  // triggererebbe il refetch da Firestore sovrascrivendo le modifiche locali.
  useEffect(() => {
    if (isLoadingMenu) return;          // aspetta che il caricamento finisca
    if (hasInitialized.current) return; // già inizializzato, ignora gli update successivi
    hasInitialized.current = true;

    if (menuDoc) {
      setNPersone(menuDoc.nPersone ?? 20);
      if (menuDoc.giorni && menuDoc.giorni.length > 0) {
        setMenu(menuDoc.giorni);
      }
    }
    // Abilita l'auto-save dopo un piccolo delay (lascia stabilizzare lo stato)
    const t = setTimeout(() => { isReadyToAutoSave.current = true; }, 400);
    return () => clearTimeout(t);
  }, [menuDoc, isLoadingMenu]);

  // Calculate spesa cost and propagate upward
  const costoSpesa = useMemo(() => {
    let costo = 0;
    const PASTO_KEYS = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'] as const;
    for (const giorno of menu) {
      for (const key of PASTO_KEYS) {
        const slots = normalizeSlots(giorno[key], key);
        for (const slot of slots) {
          const id = slot.piattoId;
          if (!id) continue;
          const piatto = piatti.find(p => p.id === id);
          if (piatto) costo += (piatto.costoPorzione || 0) * nPersone;
        }
      }
    }
    return costo;
  }, [menu, piatti, nPersone]);

  useEffect(() => {
    onCostoSpesaChange?.(costoSpesa);
  }, [costoSpesa, onCostoSpesaChange]);

  // ─── Auto-save (debounced 1.5s) ──────────────────────────────────────────
  const doSave = useCallback(async (menuToSave: GiornoMenu[], np: number) => {
    if (!firestore || !campoId) return;
    setIsSavingAuto(true);
    try {
      const giorniPuliti = JSON.parse(JSON.stringify(menuToSave, (_, v) => v === undefined ? null : v));
      await setDoc(doc(firestore, 'campi', campoId, 'dati', 'menu'), {
        nPersone: np,
        giorni: giorniPuliti,
        updatedAt: serverTimestamp(),
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Auto-save errore:', err);
      toast({ title: 'Errore nel salvataggio automatico', description: String(err), variant: 'destructive' });
    } finally {
      setIsSavingAuto(false);
    }
  }, [firestore, campoId, toast]);

  useEffect(() => {
    if (!isReadyToAutoSave.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(menu, nPersone), 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [menu, nPersone, doSave]);

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true);
    try {
      // Carica i partecipanti iscritti con le loro allergie
      let partecipanti: PartecipantePdf[] | undefined;

      if (firestore && raccoltaId) {
        // 1. Leggi il documento raccolta per ottenere confermatiIds
        const { getDoc } = await import('firebase/firestore');
        const raccoltaSnap = await getDoc(doc(firestore, 'raccolte', raccoltaId));
        const raccoltaData = raccoltaSnap.data();
        const confermatiIds: string[] = raccoltaData?.confermatiIds ?? [];

        if (confermatiIds.length > 0) {
          // 2. Cerca tutti i membri in tutte le famiglie (collectionGroup 'membri')
          const membriSnap = await getDocs(collectionGroup(firestore, 'membri'));
          partecipanti = membriSnap.docs
            .filter(d => confermatiIds.includes(d.id))
            .map(d => {
              const data = d.data();
              return {
                nome: data.nome ?? '',
                cognome: data.cognome ?? '',
                classe: data.groupName ?? data.groupId ?? '',
                allergie: data.allergie ?? '',
              } as PartecipantePdf;
            });
        }
      }

      await generaPdfMenu(menu, piatti, nPersone, undefined, partecipanti);
    } catch (err) {
      console.error('Errore generazione PDF:', err);
      toast({ title: 'Errore generazione PDF', description: String(err), variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  }, [firestore, raccoltaId, menu, piatti, nPersone, toast]);

  const addGiorno = () => {
    setMenu(m => [...m, makeGiorno(m.length + 1)]);
  };
  const removeGiorno = (idx: number) => {
    setMenu(m => m.filter((_, i) => i !== idx).map((g, i) => ({ ...g, giorno: i + 1 })));
  };

  const updateSlotNew = (giornoIdx: number, pasto: TipoPasto, slotIdx: number, field: keyof SlotSelezionato, value: any) => {
    setMenu(m => m.map((g, i) => {
      if (i === giornoIdx) {
        const slots = normalizeSlots(g[pasto], pasto);
        const newSlots = slots.map((s, si) => si === slotIdx ? { ...s, [field]: value } : s);
        return { ...g, [pasto]: newSlots };
      }
      return g;
    }));
  };

  const addSlotNew = (giornoIdx: number, pasto: TipoPasto) => {
    setMenu(m => m.map((g, i) => {
      if (i === giornoIdx) {
        const slots = normalizeSlots(g[pasto], pasto);
        const newSlots = [...slots, { piattoId: '', categoria: 'altro', label: 'Altro', isCustom: true }];
        return { ...g, [pasto]: newSlots };
      }
      return g;
    }));
  };

  const deleteSlotNew = (giornoIdx: number, pasto: TipoPasto, slotIdx: number) => {
    setMenu(m => m.map((g, i) => {
      if (i === giornoIdx) {
        const slots = normalizeSlots(g[pasto], pasto);
        const newSlots = slots.filter((_, si) => si !== slotIdx);
        return { ...g, [pasto]: newSlots };
      }
      return g;
    }));
  };

  if (isLoadingMenu) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-4 w-4" />
          <Label>Partecipanti</Label>
          <Input
            type="number" min={1} value={nPersone}
          onChange={e => { setNPersone(parseInt(e.target.value) || 1); }}
            className="w-24"
            disabled={!canEdit}
          />
        </div>
      <div className="flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addGiorno}>
              <Plus className="h-4 w-4 mr-1" />Aggiungi giorno
            </Button>
          )}
          {/* Stato auto-save */}
          {isSavingAuto
            ? <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Salvataggio...</span>
            : lastSaved
              ? <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCheck className="h-3 w-3 text-green-500" />Salvato {lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
              : <span className="text-xs text-muted-foreground">Non ancora salvato</span>
          }
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={isDownloading || menu.length === 0}
            title="Scarica PDF del menu"
          >
            {isDownloading
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Download className="h-4 w-4 mr-1" />
            }
            Scarica PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu">📅 Menù giorni</TabsTrigger>
          <TabsTrigger value="spesa">🛒 Lista spesa</TabsTrigger>
        </TabsList>

        {/* TAB MENU */}
        <TabsContent value="menu" className="space-y-3 mt-4">
          {menu.map((giorno, gi) => (
            <Card key={gi}>
              <CardHeader
                className="py-3 px-4 cursor-pointer"
                onClick={() => setExpandedGiorno(expandedGiorno === gi ? -1 : gi)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Giorno {giorno.giorno}</CardTitle>
                  <div className="flex items-center gap-2">
                    {canEdit && menu.length > 1 && (
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={e => { e.stopPropagation(); removeGiorno(gi); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {expandedGiorno === gi ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>
              {expandedGiorno === gi && (
                <CardContent className="space-y-3 pt-0">
                  <Separator />
                  {(Object.keys(PASTO_LABELS) as TipoPasto[]).map(pasto => {
                    const slots = normalizeSlots(giorno[pasto], pasto);
                    return (
                      <div key={pasto} className="space-y-1.5 border-l-2 border-primary/20 pl-3 py-1">
                        <p className="text-sm font-semibold text-foreground/90">{PASTO_LABELS[pasto]}</p>
                        <div className="space-y-1.5">
                          {slots.map((slot, slotIdx) => (
                            <div key={slotIdx} className="flex items-center gap-2">
                              <div className="flex-1">
                                <SlotSelector
                                  value={slot.piattoId}
                                  onChange={id => { if (canEdit) updateSlotNew(gi, pasto, slotIdx, 'piattoId', id); }}
                                  piatti={piatti}
                                  label={slot.label}
                                  categoria={slot.categoria}
                                  tipoPasto={pasto}
                                />
                              </div>
                              {canEdit && slot.isCustom && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive h-8 w-8 p-0"
                                  onClick={() => deleteSlotNew(gi, pasto, slotIdx)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-primary flex items-center gap-1 h-7 pl-20 hover:bg-primary/5"
                              onClick={() => addSlotNew(gi, pasto)}
                            >
                              <Plus className="h-3 w-3" /> Aggiungi piatto
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}
          {piatti.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
              Nessun piatto nel database. Vai su <strong>Piatti</strong> dalla sidebar per aggiungerne.
            </p>
          )}
        </TabsContent>

        {/* TAB SPESA */}
        <TabsContent value="spesa" className="mt-4">
          <CalcolaSpesa menu={menu} piatti={piatti} nPersone={nPersone} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
