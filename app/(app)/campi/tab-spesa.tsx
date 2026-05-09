'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import { Plus, Trash2, Pencil, ShoppingCart, Users, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Piatto {
  id: string;
  nome: string;
  categoria: string;
  costoPorzione?: number; // € per persona (opzionale, auto-calcolato da ingredienti)
  ingredienti: { nome: string; quantitaPerPersona: number; unita: string; prezzoPerUnita?: number }[];
  intolleranze: string[];
  note?: string;
}

export type TipoPasto = 'colazione' | 'merenda_mattina' | 'pranzo' | 'merenda' | 'cena';

export interface SlotMenu {
  piattoPrincipaleId?: string;
  contornoId?: string;
  fruttaId?: string;
}

export interface GiornoMenu {
  giorno: number;
  colazione: SlotMenu;
  merenda_mattina: SlotMenu;
  pranzo: SlotMenu;
  merenda: SlotMenu;
  cena: SlotMenu;
}

export const PASTO_LABELS: Record<TipoPasto, string> = {
  colazione: '🌅 Colazione',
  merenda_mattina: '☕ Merenda mattina',
  pranzo: '🍽️ Pranzo',
  merenda: '🍎 Merenda',
  cena: '🌙 Cena',
};

export const CAT_LABELS: Record<string, string> = {
  primo: 'Primo',
  secondo: 'Secondo',
  contorno: 'Contorno',
  frutta: 'Frutta',
  dolce: 'Dolce',
  colazione: 'Colazione',
  merenda: 'Merenda',
  altro: 'Altro',
};

/** Restituisce la label di una categoria indipendentemente dal case */
export function getCatLabel(cat: string): string {
  return CAT_LABELS[cat?.toLowerCase()] ?? CAT_LABELS[cat] ?? cat;
}

export const ALLERGENI_PREDEFINITI = ['Lattosio', 'Glutine', 'Carne'];
export const UNITA_MISURA = ['ml', 'gr', 'L', 'Kg', 'pz', 'metri'];

// ─── Utility: normalizzazione e conversione unità ────────────────────────────

/** Tipo normalizzato usato internamente per l'aggregazione */
type UnitaBase = 'g' | 'ml' | 'altro';

/** Converte qualsiasi unità alla base (grammi o ml) e restituisce il valore e il gruppo */
export function normalizzaUnita(quantita: number, unita: string): { valore: number; base: UnitaBase } {
  const u = unita.trim().toLowerCase();
  switch (u) {
    case 'kg': case 'kg': return { valore: quantita * 1000, base: 'g' };
    case 'gr': case 'g':  return { valore: quantita,         base: 'g' };
    case 'l':             return { valore: quantita * 1000, base: 'ml' };
    case 'ml':            return { valore: quantita,         base: 'ml' };
    default:              return { valore: quantita,         base: 'altro' };
  }
}

/** Formatta un valore in base (grammi o ml) nella migliore unità di visualizzazione */
export function formattaQuantita(valoreBase: number, base: UnitaBase, unitaOriginale: string): { quantita: number; unita: string } {
  if (base === 'g') {
    if (valoreBase >= 1000) return { quantita: Math.round(valoreBase / 10) / 100, unita: 'Kg' };
    return { quantita: Math.round(valoreBase * 10) / 10, unita: 'gr' };
  }
  if (base === 'ml') {
    if (valoreBase >= 1000) return { quantita: Math.round(valoreBase / 10) / 100, unita: 'L' };
    return { quantita: Math.round(valoreBase * 10) / 10, unita: 'ml' };
  }
  // unità non convertibili (pz, metri, ecc.) → mantieni originale
  return { quantita: Math.round(valoreBase * 100) / 100, unita: unitaOriginale };
}

/** Chiave di aggregazione: stesso nome + stesso gruppo unità vengono sommati */
export function chiaveAggregazione(nome: string, unita: string): string {
  const u = unita.trim().toLowerCase();
  const isPeso = ['kg', 'gr', 'g'].includes(u);
  const isLiquido = ['l', 'ml'].includes(u);
  if (isPeso) return `${nome}__peso`;
  if (isLiquido) return `${nome}__liquido`;
  return `${nome}__${u}`;
}

// ─── IngredienteAutoRow: input nome con autocomplete ─────────────────────────

function IngredienteAutoRow({ ing, suggestions, onUpdate, onRemove }: {
  ing: Piatto['ingredienti'][0];
  suggestions: { nome: string; unita?: string; prezzoPerUnita?: number }[];
  onUpdate: (field: keyof Piatto['ingredienti'][0], value: any) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const filtered = ing.nome.trim().length > 0
    ? suggestions.filter(s => s.nome.toLowerCase().includes(ing.nome.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_5.5rem_2rem] gap-1.5 items-center">
      <div className="relative" ref={wrapRef}>
        <Input
          value={ing.nome}
          onChange={e => { onUpdate('nome', e.target.value); setOpen(true); }}
          onFocus={() => ing.nome.trim().length > 0 && setOpen(true)}
          placeholder="ingrediente"
          autoComplete="off"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded-md shadow-md max-h-36 overflow-y-auto">
            {filtered.map((s, idx) => (
              <button key={idx} type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex justify-between"
                onMouseDown={e => {
                  e.preventDefault();
                  onUpdate('nome', s.nome);
                  if (s.unita) onUpdate('unita', s.unita);
                  if (s.prezzoPerUnita) onUpdate('prezzoPerUnita', s.prezzoPerUnita);
                  setOpen(false);
                }}
              >
                <span>{s.nome}</span>
                <span className="text-muted-foreground text-xs">{s.unita}{s.prezzoPerUnita ? ` · €${s.prezzoPerUnita}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Input type="number" min={0} step={0.1} value={ing.quantitaPerPersona || ''}
        onChange={e => onUpdate('quantitaPerPersona', parseFloat(e.target.value) || 0)} />
      <Select value={ing.unita} onValueChange={v => onUpdate('unita', v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{UNITA_MISURA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
      </Select>
      <div className="relative">
        <Input type="number" min={0} step={0.01} value={ing.prezzoPerUnita ?? ''}
          onChange={e => onUpdate('prezzoPerUnita', parseFloat(e.target.value) || undefined)}
          placeholder="0.00" className="pl-4 pr-1 text-sm" />
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
      </div>
      <Button size="sm" variant="ghost" className="text-destructive h-8 w-8 p-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Form Piatto ──────────────────────────────────────────────────────────────

function PiattoForm({ initial, onSave, onClose, piatti = [] }: { initial?: Partial<Piatto>; onSave: (d: Partial<Piatto>) => Promise<void>; onClose: () => void; piatti?: Piatto[] }) {
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

  // ── Suggerimenti da ingredienti già nel database ──
  const suggestions = useMemo(() => {
    const map = new Map<string, { nome: string; unita?: string; prezzoPerUnita?: number }>();
    piatti.forEach(p => p.ingredienti?.forEach(ing => {
      const k = ing.nome?.trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, { nome: ing.nome.trim(), unita: ing.unita, prezzoPerUnita: ing.prezzoPerUnita });
    }));
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [piatti]);

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
    <div className="space-y-4 py-2">
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

        <div className="space-y-1 col-span-2"><Label>Note</Label><Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note aggiuntive..." /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Ingredienti (per persona)</Label>
          <Button size="sm" variant="outline" onClick={addIngrediente}><Plus className="h-3 w-3 mr-1" />Aggiungi</Button>
        </div>
        {ingredienti.length > 0 && (
          <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_4.5rem_5.5rem_2rem] gap-1.5 text-xs text-muted-foreground px-0.5">
            <span>Ingrediente</span><span>Qtà</span><span>Unità</span><span>€/u</span><span />
          </div>
        )}
        {ingredienti.map((ing, i) => (
          <IngredienteAutoRow key={i} ing={ing} suggestions={suggestions}
            onUpdate={(field, val) => updateIngrediente(i, field, val)}
            onRemove={() => removeIngrediente(i)} />
        ))}
        {ingredienti.some(i => (i.prezzoPerUnita || 0) > 0) && (
          <p className="text-xs text-right text-muted-foreground pr-8">
            Costo/porzione stimato: <span className="font-semibold text-foreground">
              € {ingredienti.reduce((s, i) => s + (i.prezzoPerUnita || 0) * i.quantitaPerPersona, 0).toFixed(3)}
            </span>
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={!nome || saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
      </div>
    </div>
  );
}

// ─── Menu Builder ─────────────────────────────────────────────────────────────

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
          // Se il piatto ha 1 solo ingrediente usa il nome del piatto (evita disallineamenti tipo "Latteo" vs "Latte")
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
        <Card className="col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Costo totale spesa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-primary">€ {costoTotale.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Per persona</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">€ {nPersone > 0 ? (costoTotale / nPersone).toFixed(2) : '0.00'}</p></CardContent>
        </Card>
        <Card className="col-span-1">
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
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Lista della spesa ({nPersone} persone)</CardTitle></CardHeader>
        <CardContent>
          {ingredientiTotali.length === 0
            ? <p className="text-muted-foreground text-sm">Nessun ingrediente calcolato. Inserisci il menù prima.</p>
            : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ingredientiTotali.map(ing => (
                  <div key={`${ing.nome}-${ing.unita}`} className="flex items-center justify-between p-2 border rounded text-sm">
                    <span className="font-medium">{ing.nome}</span>
                    <span className="text-muted-foreground font-tabular-nums">{ing.quantita} {ing.unita}</span>
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

// ─── Main Tab Spesa ──────────────────────────────────────────────────────────

export default function TabSpesa() {
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

  // Menu giorni
  const makeSlot = (): SlotMenu => ({});
  const makeGiorno = (g: number): GiornoMenu => ({ giorno: g, colazione: makeSlot(), merenda_mattina: makeSlot(), pranzo: makeSlot(), merenda: makeSlot(), cena: makeSlot() });
  const [menu, setMenu] = useState<GiornoMenu[]>([makeGiorno(1)]);

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

  const [expandedGiorno, setExpandedGiorno] = useState<number>(0);

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
                <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
                  <DialogHeader className="shrink-0"><DialogTitle>Aggiungi piatto</DialogTitle></DialogHeader>
                  <div className="overflow-y-auto flex-1 px-1 -mx-1">
                    <PiattoForm onSave={d => savePiatto(d)} onClose={() => setOpenAdd(false)} piatti={piatti} />
                  </div>
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
                      {p.ingredienti?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5">🥘 {p.ingredienti.map(i => `${i.nome} ${i.quantitaPerPersona}${i.unita}`).join(', ')}</p>
                      )}
                      {p.note && <p className="text-xs text-muted-foreground mt-1">{p.note}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Dialog open={editingId === p.id} onOpenChange={o => { if (!o) setEditingId(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(p.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
                            <DialogHeader className="shrink-0"><DialogTitle>Modifica piatto</DialogTitle></DialogHeader>
                            <div className="overflow-y-auto flex-1 px-1 -mx-1">
                              <PiattoForm initial={p} onSave={d => savePiatto(d, p.id)} onClose={() => setEditingId(null)} piatti={piatti} />
                            </div>
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
