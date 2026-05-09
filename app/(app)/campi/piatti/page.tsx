'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import {
  collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  CookingPot, Plus, Trash2, Pencil, ChevronDown, ChevronRight, Users, Package,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ALLERGENI_PREDEFINITI = ['Lattosio', 'Glutine', 'Carne'];
const UNITA_MISURA = ['ml', 'gr', 'L', 'Kg', 'pz', 'metri'];

/* ─── Types ───────────────────────────────────────────────────────────────── */
export interface Ingrediente {
  nome: string;
  quantitaPerPersona: number;   // grammi / ml / unità
  unita: string;                // g, ml, pz, cucchiai...
}

export interface Piatto {
  id: string;
  nome: string;
  categoria: string;        // es. Primo, Secondo, Contorno, Colazione...
  porzioniBase?: number;    // numero persone di riferimento
  note?: string;
  ingredienti: Ingrediente[];
  createdAt?: any;
}

const CATEGORIE = ['Colazione', 'Primo', 'Secondo', 'Contorno', 'Dessert', 'Merenda', 'Altro'];

/* ─── Ingrediente row editor ─────────────────────────────────────────────── */
function IngredienteRow({
  item,
  onChange,
  onRemove,
}: {
  item: Ingrediente;
  onChange: (updated: Ingrediente) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
      <Input
        placeholder="Nome ingrediente"
        value={item.nome}
        onChange={e => onChange({ ...item, nome: e.target.value })}
      />
      <Input
        type="number"
        min={0}
        step="any"
        className="w-24"
        placeholder="Qtà"
        value={item.quantitaPerPersona || ''}
        onChange={e => onChange({ ...item, quantitaPerPersona: parseFloat(e.target.value) || 0 })}
      />
      <Select value={item.unita} onValueChange={v => onChange({ ...item, unita: v })}>
        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
        <SelectContent>
          {UNITA_MISURA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ─── Piatto Form ────────────────────────────────────────────────────────── */
function PiattoForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<Piatto>;
  onSave: (d: Omit<Piatto, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [categoria, setCategoria] = useState(initial?.categoria ?? 'Primo');
  const [porzioniBase, setPorzioniBase] = useState<number>(initial?.porzioniBase ?? 10);
  const [note, setNote] = useState(initial?.note ?? '');
  const [ingredienti, setIngredienti] = useState<Ingrediente[]>(
    initial?.ingredienti ?? []
  );
  const [saving, setSaving] = useState(false);

  // ── Gestione intolleranze con checkbox (salvate in 'note' per compatibilità) ──
  // Usiamo il campo note per le intolleranze in questo form
  const parseAllergeniFromNote = (n: string) => {
    const known = ALLERGENI_PREDEFINITI.filter(a => n.includes(a));
    const extra = n.split(',').map(s => s.trim()).filter(s => s && !ALLERGENI_PREDEFINITI.includes(s));
    return { known, extra };
  };
  const parsed = parseAllergeniFromNote(initial?.note ?? '');
  const [checkedAllergeni, setCheckedAllergeni] = useState<Set<string>>(new Set(parsed.known));
  const [extraAllergeni, setExtraAllergeni] = useState(parsed.extra.join(', '));
  const [noteLibere, setNoteLibere] = useState('');

  const toggleAllergene = (a: string) =>
    setCheckedAllergeni(prev => { const s = new Set(prev); s.has(a) ? s.delete(a) : s.add(a); return s; });

  const addIngrediente = () =>
    setIngredienti(prev => [...prev, { nome: '', quantitaPerPersona: 0, unita: 'ml' }]);

  const updateIngrediente = (i: number, updated: Ingrediente) =>
    setIngredienti(prev => prev.map((ing, idx) => (idx === i ? updated : ing)));

  const removeIngrediente = (i: number) =>
    setIngredienti(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!nome) return;
    setSaving(true);
    const extra = extraAllergeni.split(',').map(s => s.trim()).filter(Boolean);
    const allergeniNote = [...Array.from(checkedAllergeni), ...extra].join(', ');
    const noteFinale = [allergeniNote, noteLibere].filter(Boolean).join(' | ');
    await onSave({ nome, categoria, porzioniBase, note: noteFinale, ingredienti });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Nome piatto *</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Pasta al pomodoro" />
        </div>
        <div className="space-y-1">
          <Label>Categoria</Label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
          >
            {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Porzioni di riferimento</Label>
          <Input
            type="number"
            min={1}
            value={porzioniBase}
            onChange={e => setPorzioniBase(parseInt(e.target.value) || 10)}
          />
        </div>
      </div>

      {/* Ingredienti */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Package className="h-4 w-4" />
            Ingredienti (per {porzioniBase} persone)
          </Label>
          <Button type="button" size="sm" variant="outline" onClick={addIngrediente}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Aggiungi
          </Button>
        </div>
        <div className="space-y-2">
          {ingredienti.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 border rounded-md border-dashed">
              Nessun ingrediente aggiunto
            </p>
          )}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs text-muted-foreground px-0.5 mb-1">
            <span>Ingrediente</span><span>Quantità</span><span>Unità</span><span />
          </div>
          {ingredienti.map((ing, i) => (
            <IngredienteRow
              key={i}
              item={ing}
              onChange={updated => updateIngrediente(i, updated)}
              onRemove={() => removeIngrediente(i)}
            />
          ))}
        </div>
      </div>

      {/* Allergeni / Intolleranze */}
      <div className="space-y-2">
        <Label>Allergeni / Intolleranze</Label>
        <div className="flex flex-wrap gap-3">
          {ALLERGENI_PREDEFINITI.map(a => (
            <label key={a} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={checkedAllergeni.has(a)}
                onChange={() => toggleAllergene(a)}
              />
              <span className="text-sm">{a}</span>
            </label>
          ))}
        </div>
        <Input
          value={extraAllergeni}
          onChange={e => setExtraAllergeni(e.target.value)}
          placeholder="Altro allergene (es. frutta secca, uova) — separati da virgola"
        />
      </div>

      <div className="space-y-1">
        <Label>Note aggiuntive</Label>
        <Textarea value={noteLibere} onChange={e => setNoteLibere(e.target.value)} placeholder="Preparazione, varianti..." rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={!nome || saving}>
          {saving ? 'Salvataggio...' : 'Salva piatto'}
        </Button>
      </div>
    </div>
  );
}

/* ─── Piatto Card ────────────────────────────────────────────────────────── */
function PiattoCard({
  piatto,
  isAdmin,
  onEdit,
  onDelete,
}: {
  piatto: Piatto;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [persone, setPersone] = useState(piatto.porzioniBase ?? 10);

  const scaledIngredienti = useMemo(() => {
    const ratio = persone / (piatto.porzioniBase || 10);
    return piatto.ingredienti.map(ing => ({
      ...ing,
      quantitaScaled: Math.round((ing.quantitaPerPersona * ratio) * 100) / 100,
    }));
  }, [piatto, persone]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-2 text-left"
            >
              {expanded
                ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              }
              <div>
                <CardTitle className="text-base">{piatto.nome}</CardTitle>
                {piatto.note && (
                  <CardDescription className="text-xs mt-0.5 line-clamp-1">{piatto.note}</CardDescription>
                )}
              </div>
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs">{piatto.categoria}</Badge>
            {piatto.ingredienti.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {piatto.ingredienti.length} ingr.
              </Badge>
            )}
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Elimina piatto</AlertDialogTitle>
                      <AlertDialogDescription>
                        Sei sicuro di voler eliminare <strong>{piatto.nome}</strong>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete}>Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Portion scaler */}
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Calcola per</span>
            <Input
              type="number"
              min={1}
              className="h-7 w-20 text-sm"
              value={persone}
              onChange={e => setPersone(parseInt(e.target.value) || 1)}
            />
            <span className="text-sm text-muted-foreground">persone</span>
            {persone !== piatto.porzioniBase && (
              <Badge variant="outline" className="text-xs ml-auto">
                base: {piatto.porzioniBase}p
              </Badge>
            )}
          </div>

          {/* Ingredients table */}
          {scaledIngredienti.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ingrediente</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Quantità</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unità</th>
                  </tr>
                </thead>
                <tbody>
                  {scaledIngredienti.map((ing, i) => (
                    <tr key={i} className={cn('border-b last:border-b-0', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
                      <td className="px-3 py-2">{ing.nome}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{ing.quantitaScaled}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{ing.unita}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Nessun ingrediente specificato</p>
          )}

          {piatto.note && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note: </span>{piatto.note}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function PiattiPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();
  const isAdmin = userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');

  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('Tutti');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPiatto, setEditingPiatto] = useState<Piatto | null>(null);

  const piattiQ = useMemoFirebase(
    () => firestore ? collection(firestore, 'campi-piatti') : null,
    [firestore]
  );
  const { data: piattiData, isLoading } = useCollection<Piatto>(piattiQ);
  const piatti = piattiData ?? [];

  const filteredPiatti = useMemo(() => {
    return piatti.filter(p => {
      const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategoria === 'Tutti' || p.categoria === filterCategoria;
      return matchSearch && matchCat;
    });
  }, [piatti, search, filterCategoria]);

  const piattiByCategory = useMemo(() => {
    const groups = new Map<string, Piatto[]>();
    filteredPiatti.forEach(p => {
      const cat = p.categoria || 'Altro';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(p);
    });
    // Sort by CATEGORIE order
    const sorted = new Map<string, Piatto[]>();
    CATEGORIE.forEach(cat => { if (groups.has(cat)) sorted.set(cat, groups.get(cat)!); });
    groups.forEach((val, key) => { if (!sorted.has(key)) sorted.set(key, val); });
    return sorted;
  }, [filteredPiatti]);

  const handleSave = async (data: Omit<Piatto, 'id' | 'createdAt'>) => {
    if (!firestore || !user) return;
    try {
      if (editingPiatto) {
        await updateDoc(doc(firestore, 'campi-piatti', editingPiatto.id), {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast({ title: 'Piatto aggiornato' });
      } else {
        await addDoc(collection(firestore, 'campi-piatti'), {
          ...data,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        });
        toast({ title: 'Piatto aggiunto' });
      }
    } catch {
      toast({ title: 'Errore nel salvataggio', variant: 'destructive' });
    }
    setEditingPiatto(null);
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'campi-piatti', id));
      toast({ title: 'Piatto eliminato' });
    } catch {
      toast({ title: 'Errore eliminazione', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <CookingPot className="h-8 w-8 text-primary" />
            Piatti
          </h1>
          <p className="text-muted-foreground mt-1">
            Ricettario con ingredienti e quantità per persona — scalabili a qualsiasi numero di commensali
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditingPiatto(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nuovo piatto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Cerca piatto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {['Tutti', ...CATEGORIE].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategoria(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                filterCategoria === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:border-primary hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-16 animate-pulse bg-muted/50" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && piatti.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <CookingPot className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="font-medium">Nessun piatto presente</p>
              <p className="text-sm text-muted-foreground mt-1">
                Aggiungi il primo piatto con i suoi ingredienti
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi piatto
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Piatti by category */}
      {!isLoading && Array.from(piattiByCategory.entries()).map(([categoria, items]) => (
        <section key={categoria} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{categoria}</h2>
            <Badge variant="outline" className="text-xs">{items.length} piatt{items.length === 1 ? 'o' : 'i'}</Badge>
          </div>
          <div className="space-y-2">
            {items.map(piatto => (
              <PiattoCard
                key={piatto.id}
                piatto={piatto}
                isAdmin={isAdmin ?? false}
                onEdit={() => { setEditingPiatto(piatto); setFormOpen(true); }}
                onDelete={() => handleDelete(piatto.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={o => { if (!o) { setEditingPiatto(null); } setFormOpen(o); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CookingPot className="h-5 w-5" />
              {editingPiatto ? 'Modifica piatto' : 'Nuovo piatto'}
            </DialogTitle>
          </DialogHeader>
          <PiattoForm
            initial={editingPiatto ?? undefined}
            onSave={handleSave}
            onClose={() => { setFormOpen(false); setEditingPiatto(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
