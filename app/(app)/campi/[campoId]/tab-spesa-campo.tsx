'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Pencil, ShoppingCart, Users, AlertTriangle, ChevronDown, ChevronUp, Save, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import type { Piatto, GiornoMenu, SlotMenu, TipoPasto } from '../tab-spesa';
import { PASTO_LABELS, CAT_LABELS, ALLERGENI_PREDEFINITI, UNITA_MISURA, normalizzaUnita, formattaQuantita, chiaveAggregazione } from '../tab-spesa';

// ─── SlotSelector (same as parent) ───────────────────────────────────────────

function SlotSelector({ value, onChange, piatti, label, tipoPasto }: {
  value?: string; onChange: (id: string | undefined) => void;
  piatti: Piatto[]; label: string; tipoPasto: TipoPasto;
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

// ─── Lista Spesa ──────────────────────────────────────────────────────────────

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
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Costo totale spesa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">€ {costoTotale.toFixed(2)}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Per persona</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">€ {nPersone > 0 ? (costoTotale / nPersone).toFixed(2) : '0.00'}</p></CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Intolleranze</CardTitle></CardHeader>
          <CardContent>
            {intolleranzeUniche.length === 0
              ? <p className="text-sm text-muted-foreground">Nessuna</p>
              : <div className="flex flex-wrap gap-1">{intolleranzeUniche.map(i => <Badge key={i} variant="outline" className="border-orange-400 text-orange-600 text-xs">{i}</Badge>)}</div>
            }
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Lista della spesa ({nPersone} persone)</CardTitle></CardHeader>
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

// ─── PiattoForm ───────────────────────────────────────────────────────────────

function PiattoForm({ initial, onSave, onClose }: { initial?: Partial<Piatto>; onSave: (d: Partial<Piatto>) => Promise<void>; onClose: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [categoria, setCategoria] = useState<string>(initial?.categoria ?? 'primo');
  const [costoPorzione, setCostoPorzione] = useState(initial?.costoPorzione ?? 0);
  const [note, setNote] = useState(initial?.note ?? '');
  const [ingredienti, setIngredienti] = useState<Piatto['ingredienti']>(initial?.ingredienti ?? [{ nome: '', quantitaPerPersona: 0, unita: 'ml' }]);
  const [saving, setSaving] = useState(false);

  // ── Gestione intolleranze con checkbox ──
  const existingExtra = (initial?.intolleranze ?? []).filter(i => !ALLERGENI_PREDEFINITI.includes(i));
  const [checkedAllergeni, setCheckedAllergeni] = useState<Set<string>>(
    new Set((initial?.intolleranze ?? []).filter(i => ALLERGENI_PREDEFINITI.includes(i)))
  );
  const [extraAllergeni, setExtraAllergeni] = useState(existingExtra.join(', '));

  const toggleAllergene = (a: string) =>
    setCheckedAllergeni(prev => { const s = new Set(prev); s.has(a) ? s.delete(a) : s.add(a); return s; });

  const addIngrediente = () => setIngredienti(p => [...p, { nome: '', quantitaPerPersona: 0, unita: 'ml' }]);
  const removeIngrediente = (i: number) => setIngredienti(p => p.filter((_, idx) => idx !== i));
  const updateIngrediente = (i: number, field: keyof Piatto['ingredienti'][0], value: any) =>
    setIngredienti(p => p.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));

  const handleSave = async () => {
    if (!nome) return;
    setSaving(true);
    const extra = extraAllergeni.split(',').map(s => s.trim()).filter(Boolean);
    const intolleranze = [...Array.from(checkedAllergeni), ...extra];
    await onSave({
      nome, categoria, costoPorzione,
      intolleranze,
      ingredienti: ingredienti.filter(i => i.nome),
      note,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2"><Label>Nome piatto *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Pasta al pomodoro" /></div>
        <div className="space-y-1">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={v => setCategoria(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Costo per persona (€)</Label><Input type="number" min={0} step={0.01} value={costoPorzione} onChange={e => setCostoPorzione(parseFloat(e.target.value) || 0)} /></div>

        {/* Intolleranze con checkbox */}
        <div className="space-y-2 col-span-2">
          <Label>Allergeni / Intolleranze</Label>
          <div className="flex flex-wrap gap-4">
            {ALLERGENI_PREDEFINITI.map(a => (
              <label key={a} className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={checkedAllergeni.has(a)}
                  onCheckedChange={() => toggleAllergene(a)}
                  className="rounded-full"
                />
                <span className="text-sm">{a}</span>
              </label>
            ))}
          </div>
          <Input
            value={extraAllergeni}
            onChange={e => setExtraAllergeni(e.target.value)}
            placeholder="Altro (es. frutta secca, uova) — separati da virgola"
          />
        </div>

        <div className="space-y-1 col-span-2"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ingredienti (per persona)</Label>
          <Button size="sm" variant="outline" onClick={addIngrediente}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button>
        </div>
        {ingredienti.map((ing, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input value={ing.nome} onChange={e => updateIngrediente(i, 'nome', e.target.value)} placeholder="ingrediente" className="flex-1" />
            <Input type="number" min={0} step={0.1} value={ing.quantitaPerPersona} onChange={e => updateIngrediente(i, 'quantitaPerPersona', parseFloat(e.target.value) || 0)} className="w-20" />
            <Select value={ing.unita} onValueChange={v => updateIngrediente(i, 'unita', v)}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITA_MISURA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeIngrediente(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={!nome || saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
      </div>
    </div>
  );
}

// ─── Main Tab Spesa Campo ─────────────────────────────────────────────────────

interface TabSpesaCampoProps {
  campoId: string;
}

const makeSlot = (): SlotMenu => ({});
const makeGiorno = (g: number): GiornoMenu => ({ giorno: g, colazione: makeSlot(), merenda_mattina: makeSlot(), pranzo: makeSlot(), merenda: makeSlot(), cena: makeSlot() });

export default function TabSpesaCampo({ campoId }: TabSpesaCampoProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();
  const isAdmin = userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');

  const piattiQ = useMemoFirebase(() => firestore ? collection(firestore, 'campi-piatti') : null, [firestore]);
  const { data: piattiData } = useCollection<Piatto>(piattiQ);
  const piatti = piattiData ?? [];

  const [openAdd, setOpenAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nPersone, setNPersone] = useState(20);
  const [menu, setMenu] = useState<GiornoMenu[]>([makeGiorno(1)]);
  const [expandedGiorno, setExpandedGiorno] = useState<number>(0);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Load menu from Firestore
  useEffect(() => {
    if (!firestore || !campoId) return;
    setIsLoadingConfig(true);
    getDoc(doc(firestore, 'campi', campoId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.menu && Array.isArray(d.menu)) setMenu(d.menu);
        if (d.nPersone) setNPersone(d.nPersone);
      }
    }).finally(() => setIsLoadingConfig(false));
  }, [firestore, campoId]);

  const saveMenu = async () => {
    if (!firestore) return;
    setIsSavingConfig(true);
    try {
      await updateDoc(doc(firestore, 'campi', campoId), { menu, nPersone });
      toast({ title: 'Menù salvato' });
    } catch {
      toast({ title: 'Errore nel salvataggio', variant: 'destructive' });
    }
    setIsSavingConfig(false);
  };

  const addGiorno = () => setMenu(m => [...m, makeGiorno(m.length + 1)]);
  const removeGiorno = (idx: number) => setMenu(m => m.filter((_, i) => i !== idx).map((g, i) => ({ ...g, giorno: i + 1 })));
  const updateSlot = (giornoIdx: number, pasto: TipoPasto, field: keyof SlotMenu, value: string | undefined) => {
    setMenu(m => m.map((g, i) => i === giornoIdx ? { ...g, [pasto]: { ...g[pasto], [field]: value } } : g));
  };

  const savePiatto = async (data: Partial<Piatto>, id?: string) => {
    if (!firestore || !user) return;
    try {
      if (id) { await updateDoc(doc(firestore, 'campi-piatti', id), { ...data, updatedAt: serverTimestamp() }); toast({ title: 'Piatto aggiornato' }); }
      else { await addDoc(collection(firestore, 'campi-piatti'), { ...data, createdAt: serverTimestamp(), createdBy: user.uid }); toast({ title: 'Piatto aggiunto' }); }
    } catch { toast({ title: 'Errore', variant: 'destructive' }); }
  };

  const deletePiatto = async (id: string) => {
    if (!firestore) return;
    try { await deleteDoc(doc(firestore, 'campi-piatti', id)); toast({ title: 'Piatto rimosso' }); }
    catch { toast({ title: 'Errore', variant: 'destructive' }); }
  };

  if (isLoadingConfig) return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="menu">
        <TabsList>
          <TabsTrigger value="menu">📅 Menù giorni</TabsTrigger>
          <TabsTrigger value="spesa">🛒 Lista spesa</TabsTrigger>
          <TabsTrigger value="piatti">🍴 Database piatti</TabsTrigger>
        </TabsList>

        {/* ── TAB MENU ── */}
        <TabsContent value="menu" className="space-y-4 mt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <Label>Numero partecipanti</Label>
              <Input type="number" min={1} value={nPersone} onChange={e => setNPersone(parseInt(e.target.value) || 1)} className="w-24" />
            </div>
            <Button size="sm" variant="outline" onClick={addGiorno}><Plus className="h-4 w-4 mr-1" />Aggiungi giorno</Button>
            <Button size="sm" onClick={saveMenu} disabled={isSavingConfig} className="ml-auto">
              {isSavingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salva menù
            </Button>
          </div>

          <div className="space-y-3">
            {menu.map((giorno, gi) => (
              <Card key={gi}>
                <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => setExpandedGiorno(expandedGiorno === gi ? -1 : gi)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Giorno {giorno.giorno}</CardTitle>
                    <div className="flex items-center gap-2">
                      {menu.length > 1 && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={e => { e.stopPropagation(); removeGiorno(gi); }}>
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
                            <SlotSelector value={slot.piattoPrincipaleId} onChange={id => updateSlot(gi, pasto, 'piattoPrincipaleId', id)} piatti={piatti} label={isColMer ? 'Cibo' : 'Principale'} tipoPasto={pasto} />
                            {!isColMer && (
                              <>
                                <SlotSelector value={slot.contornoId} onChange={id => updateSlot(gi, pasto, 'contornoId', id)} piatti={piatti} label="Contorno" tipoPasto={pasto} />
                                <SlotSelector value={slot.fruttaId} onChange={id => updateSlot(gi, pasto, 'fruttaId', id)} piatti={piatti} label="Frutta" tipoPasto={pasto} />
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
          </div>
        </TabsContent>

        {/* ── TAB SPESA ── */}
        <TabsContent value="spesa" className="mt-4">
          <CalcolaSpesa menu={menu} piatti={piatti} nPersone={nPersone} />
        </TabsContent>

        {/* ── TAB DATABASE PIATTI ── */}
        <TabsContent value="piatti" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Database piatti</h3>
            {isAdmin && (
              <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuovo piatto</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Aggiungi piatto</DialogTitle></DialogHeader>
                  <PiattoForm onSave={d => savePiatto(d)} onClose={() => setOpenAdd(false)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {piatti.length === 0 && <p className="col-span-2 text-center text-muted-foreground py-8">Nessun piatto nel database. {isAdmin && 'Aggiungine uno!'}</p>}
            {piatti.map(p => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold">{p.nome}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">{CAT_LABELS[p.categoria]}</Badge>
                        {p.costoPorzione > 0 && <Badge variant="outline" className="text-xs">€ {p.costoPorzione.toFixed(2)}/p</Badge>}
                        {p.intolleranze?.map(i => <Badge key={i} variant="outline" className="text-xs border-orange-400 text-orange-600">{i}</Badge>)}
                      </div>
                      {p.ingredienti?.length > 0 && <p className="text-xs text-muted-foreground mt-1.5">🥘 {p.ingredienti.map(i => `${i.nome} ${i.quantitaPerPersona}${i.unita}`).join(', ')}</p>}
                      {p.note && <p className="text-xs text-muted-foreground mt-1">{p.note}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Dialog open={editingId === p.id} onOpenChange={o => { if (!o) setEditingId(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(p.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>Modifica piatto</DialogTitle></DialogHeader>
                            <PiattoForm initial={p} onSave={d => savePiatto(d, p.id)} onClose={() => setEditingId(null)} />
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina piatto</AlertDialogTitle>
                              <AlertDialogDescription>Vuoi eliminare <strong>{p.nome}</strong>?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deletePiatto(p.id)}>Elimina</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
