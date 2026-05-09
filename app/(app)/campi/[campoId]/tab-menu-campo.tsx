'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/src/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
import { Plus, Trash2, Save, Loader2, Users, ShoppingCart, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Piatto, TipoPasto, SlotMenu, GiornoMenu } from '../tab-spesa';
import { PASTO_LABELS, CAT_LABELS, normalizzaUnita, formattaQuantita, chiaveAggregazione } from '../tab-spesa';

interface MenuCampoDoc {
  nPersone: number;
  giorni: GiornoMenu[];
  updatedAt?: any;
}

interface TabMenuCampoProps {
  campoId: string;
  canEdit: boolean;
  onCostoSpesaChange?: (costo: number) => void;
}

// ─── Slot Selector ────────────────────────────────────────────────────────────
function SlotSelector({ value, onChange, piatti, label, tipoPasto }: {
  value?: string;
  onChange: (id: string | undefined) => void;
  piatti: Piatto[];
  label: string;
  tipoPasto: TipoPasto;
}) {
  const catFiltro = tipoPasto === 'colazione' || tipoPasto === 'merenda_mattina' || tipoPasto === 'merenda'
    ? ['colazione', 'merenda', 'frutta', 'dolce', 'altro']
    : ['primo', 'secondo', 'contorno', 'frutta', 'dolce', 'altro'];

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
        const slot = giorno[key] as SlotMenu;
        for (const id of [slot.piattoPrincipaleId, slot.contornoId, slot.fruttaId].filter(Boolean)) {
          const piatto = piatti.find(p => p.id === id);
          if (!piatto) continue;
          costo += piatto.costoPorzione * nPersone;
          piatto.intolleranze?.forEach(i => intSet.add(i));
          piatto.ingredienti?.forEach(ing => {
            const { valore, base } = normalizzaUnita(ing.quantitaPerPersona, ing.unita);
            const k = chiaveAggregazione(ing.nome, ing.unita);
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
export default function TabMenuCampo({ campoId, canEdit, onCostoSpesaChange }: TabMenuCampoProps) {
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

  const makeSlot = (): SlotMenu => ({});
  const makeGiorno = (g: number): GiornoMenu => ({
    giorno: g,
    colazione: makeSlot(),
    merenda_mattina: makeSlot(),
    pranzo: makeSlot(),
    merenda: makeSlot(),
    cena: makeSlot(),
  });

  const [nPersone, setNPersone] = useState(20);
  const [menu, setMenu] = useState<GiornoMenu[]>([makeGiorno(1)]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedGiorno, setExpandedGiorno] = useState<number>(0);

  // Load data from Firestore into local state
  useEffect(() => {
    if (menuDoc) {
      setNPersone(menuDoc.nPersone ?? 20);
      if (menuDoc.giorni && menuDoc.giorni.length > 0) {
        setMenu(menuDoc.giorni);
      }
      setIsDirty(false);
    }
  }, [menuDoc]);

  // Calculate spesa cost and propagate upward
  const costoSpesa = useMemo(() => {
    let costo = 0;
    const PASTO_KEYS = ['colazione', 'merenda_mattina', 'pranzo', 'merenda', 'cena'] as const;
    for (const giorno of menu) {
      for (const key of PASTO_KEYS) {
        const slot = giorno[key] as SlotMenu;
        for (const id of [slot.piattoPrincipaleId, slot.contornoId, slot.fruttaId].filter(Boolean)) {
          const piatto = piatti.find(p => p.id === id);
          if (piatto) costo += piatto.costoPorzione * nPersone;
        }
      }
    }
    return costo;
  }, [menu, piatti, nPersone]);

  useEffect(() => {
    onCostoSpesaChange?.(costoSpesa);
  }, [costoSpesa, onCostoSpesaChange]);

  const handleSave = useCallback(async () => {
    if (!firestore || !campoId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'campi', campoId, 'dati', 'menu'), {
        nPersone,
        giorni: menu,
        updatedAt: serverTimestamp(),
      });
      setIsDirty(false);
      toast({ title: 'Menù salvato' });
    } catch {
      toast({ title: 'Errore nel salvataggio', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [firestore, campoId, nPersone, menu, toast]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const addGiorno = () => {
    setMenu(m => [...m, makeGiorno(m.length + 1)]);
    markDirty();
  };
  const removeGiorno = (idx: number) => {
    setMenu(m => m.filter((_, i) => i !== idx).map((g, i) => ({ ...g, giorno: i + 1 })));
    markDirty();
  };

  const updateSlot = (giornoIdx: number, pasto: TipoPasto, field: keyof SlotMenu, value: string | undefined) => {
    setMenu(m => m.map((g, i) => i === giornoIdx ? { ...g, [pasto]: { ...g[pasto], [field]: value } } : g));
    markDirty();
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
            onChange={e => { setNPersone(parseInt(e.target.value) || 1); markDirty(); }}
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
          {canEdit && isDirty && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salva menù
            </Button>
          )}
          {!isDirty && !isLoadingMenu && (
            <span className="text-xs text-muted-foreground">Salvato ✓</span>
          )}
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
                    const slot = giorno[pasto] as SlotMenu;
                    const isColMer = pasto === 'colazione' || pasto === 'merenda_mattina' || pasto === 'merenda';
                    return (
                      <div key={pasto} className="space-y-1.5">
                        <p className="text-sm font-medium">{PASTO_LABELS[pasto]}</p>
                        <div className="pl-3 space-y-1.5">
                          <SlotSelector
                            value={slot.piattoPrincipaleId}
                            onChange={id => { if (canEdit) updateSlot(gi, pasto, 'piattoPrincipaleId', id); }}
                            piatti={piatti} label={isColMer ? 'Cibo' : 'Principale'} tipoPasto={pasto}
                          />
                          {!isColMer && (
                            <>
                              <SlotSelector
                                value={slot.contornoId}
                                onChange={id => { if (canEdit) updateSlot(gi, pasto, 'contornoId', id); }}
                                piatti={piatti} label="Contorno" tipoPasto={pasto}
                              />
                              <SlotSelector
                                value={slot.fruttaId}
                                onChange={id => { if (canEdit) updateSlot(gi, pasto, 'fruttaId', id); }}
                                piatti={piatti} label="Frutta" tipoPasto={pasto}
                              />
                            </>
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
