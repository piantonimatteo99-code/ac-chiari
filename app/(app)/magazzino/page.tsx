'use client';

import { useState, useMemo, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShelfSelector, MiniShelf, type ShelfPosition } from '@/components/shelf-selector';
import { format, differenceInDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Plus, Trash2, AlertTriangle, ChevronUp, ChevronDown, Package,
  BookOpenCheck, Layers, Search, CheckCircle2
} from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProdottoAlimento {
  id: string;
  nome: string;
  categoria: string;
  quantita: number;
  dataScadenza: string; // ISO date string "YYYY-MM-DD"
  posizione: ShelfPosition;
  addedAt: any;
  addedBy: string;
}

export interface ProdottoGenerico {
  id: string;
  nome: string;
  quantita: number;
  stanza: string;
  addedAt: any;
  addedBy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GIORNI_ALLERTA = 7;

function formatData(isoDate: string) {
  if (!isoDate) return '-';
  try {
    return format(parseISO(isoDate), 'd MMM yyyy', { locale: it });
  } catch {
    return isoDate;
  }
}

function giorniScadenza(isoDate: string): number {
  if (!isoDate) return Infinity;
  try {
    return differenceInDays(parseISO(isoDate), new Date());
  } catch {
    return Infinity;
  }
}

function badgeScadenza(giorni: number) {
  if (giorni < 0) return <Badge variant="destructive">Scaduto</Badge>;
  if (giorni <= GIORNI_ALLERTA) return <Badge variant="destructive">⚠ {giorni}g</Badge>;
  if (giorni <= 30) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">⏳ {giorni}g</Badge>;
  return null;
}

type SortDir = 'asc' | 'desc';

// ─── Componente Alimenti ──────────────────────────────────────────────────────

function TabAlimenti() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();

  const isEducatore = userData?.roles?.includes('educatore') || userData?.roles?.includes('admin');

  // Prodotti
  const alimentiQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'magazzino-alimenti'), orderBy('dataScadenza', 'asc')) : null,
    [firestore]);
  const { data: prodotti = [] } = useCollection<ProdottoAlimento>(alimentiQuery);

  // Storico categorie
  const [categorieStorico, setCategorieStorico] = useState<Record<string, string>>({});
  const loadCategorieStorico = useCallback(async () => {
    if (!firestore) return;
    const snap = await getDocs(collection(firestore, 'magazzino-categorie-storico'));
    const map: Record<string, string> = {};
    snap.forEach(d => { map[d.id] = d.data().categoria; });
    setCategorieStorico(map);
  }, [firestore]);

  // Stanze per cancelleria (non usato qui)
  // Dialog state
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [quantita, setQuantita] = useState(1);
  const [dataScadenza, setDataScadenza] = useState('');
  const [posizione, setPosizione] = useState<ShelfPosition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggestedCat, setSuggestedCat] = useState<string | null>(null);
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);

  // Visualizzazione
  const [vista, setVista] = useState<'categoria' | 'prodotto'>('prodotto');
  const [sortKey, setSortKey] = useState<keyof ProdottoAlimento>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterText, setFilterText] = useState('');

  const handleNomeChange = async (val: string) => {
    setNome(val);
    if (!firestore) return;
    // Suggest category from history
    const normalized = val.toLowerCase().trim();
    if (normalized.length > 2) {
      await loadCategorieStorico();
      const match = Object.entries(categorieStorico).find(([k]) =>
        k.toLowerCase().includes(normalized) || normalized.includes(k.toLowerCase())
      );
      if (match) {
        setSuggestedCat(match[1]);
      } else {
        setSuggestedCat(null);
      }
    } else {
      setSuggestedCat(null);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user || !nome || !categoria || !dataScadenza || !posizione) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'magazzino-alimenti'), {
        nome: nome.trim(),
        categoria: categoria.trim(),
        quantita,
        dataScadenza,
        posizione,
        addedAt: serverTimestamp(),
        addedBy: user.uid,
      });
      // Save to storico categorie
      const { setDoc, doc: docRef } = await import('firebase/firestore');
      const chiave = nome.trim().toLowerCase();
      await setDoc(docRef(firestore, 'magazzino-categorie-storico', chiave), {
        categoria: categoria.trim(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Prodotto aggiunto', description: `"${nome}" inserito con successo.` });
      setOpen(false);
      setNome(''); setCategoria(''); setQuantita(1); setDataScadenza(''); setPosizione(null); setSuggestedCat(null);
    } catch (e) {
      toast({ title: 'Errore', description: 'Impossibile salvare il prodotto.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nomeProd: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'magazzino-alimenti', id));
      toast({ title: 'Prodotto rimosso', description: `"${nomeProd}" segnato come utilizzato.` });
    } catch {
      toast({ title: 'Errore', description: 'Impossibile rimuovere il prodotto.', variant: 'destructive' });
    }
  };

  const handleSort = (key: keyof ProdottoAlimento) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: keyof ProdottoAlimento }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  // Prodotti filtrati
  const prodottiFiltrati = useMemo(() => {
    let list = [...(prodotti || [])];
    if (filterText) {
      const t = filterText.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(t) || p.categoria.toLowerCase().includes(t));
    }
    list.sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];
      if (sortKey === 'dataScadenza') {
        va = va || '9999';
        vb = vb || '9999';
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [prodotti, filterText, sortKey, sortDir]);

  // Prodotti in scadenza
  const inScadenza = useMemo(() =>
    (prodotti || []).filter(p => {
      const g = giorniScadenza(p.dataScadenza);
      return g >= 0 && g <= GIORNI_ALLERTA;
    }), [prodotti]);

  const scaduti = useMemo(() =>
    (prodotti || []).filter(p => giorniScadenza(p.dataScadenza) < 0), [prodotti]);

  // Per categoria
  const perCategoria = useMemo(() => {
    const map: Record<string, ProdottoAlimento[]> = {};
    (prodottiFiltrati || []).forEach(p => {
      const cat = p.categoria || 'Senza categoria';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [prodottiFiltrati]);

  const suggestedCategories = useMemo(() => {
    const all = Array.from(new Set(Object.values(categorieStorico)));
    if (!categoria) return all;
    return all.filter(c => c.toLowerCase().includes(categoria.toLowerCase()));
  }, [categorieStorico, categoria]);

  return (
    <div className="space-y-4">
      {/* Alert scadenza */}
      {(inScadenza.length > 0 || scaduti.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Attenzione alle scadenze!</AlertTitle>
          <AlertDescription>
            {scaduti.length > 0 && <span className="font-semibold">{scaduti.length} prodotto/i scaduto/i. </span>}
            {inScadenza.length > 0 && <span>{inScadenza.length} prodotto/i in scadenza entro {GIORNI_ALLERTA} giorni.</span>}
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca prodotto o categoria..."
              className="pl-9 w-64"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
            />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              size="sm" variant={vista === 'prodotto' ? 'default' : 'ghost'}
              onClick={() => setVista('prodotto')} className="rounded-none text-xs"
            >
              Per prodotto
            </Button>
            <Button
              size="sm" variant={vista === 'categoria' ? 'default' : 'ghost'}
              onClick={() => setVista('categoria')} className="rounded-none text-xs"
            >
              Per categoria
            </Button>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Aggiungi Alimento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aggiungi Prodotto Alimentare</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome prodotto *</Label>
                  <Input value={nome} onChange={e => handleNomeChange(e.target.value)} placeholder="es. Coca Cola" />
                  {suggestedCat && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Categoria suggerita:</span>
                      <button
                        type="button"
                        onClick={() => setCategoria(suggestedCat)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {suggestedCat} (click per usare)
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Categoria *</Label>
                  <div className="relative">
                    <Input
                      value={categoria}
                      onChange={e => {
                        setCategoria(e.target.value);
                        setShowCatSuggestions(true);
                      }}
                      onFocus={() => setShowCatSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
                      placeholder="es. Bevanda, Pasta, Snack..."
                    />
                    {showCatSuggestions && suggestedCategories.length > 0 && (
                      <div className="absolute z-50 top-full w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-48 overflow-auto py-1">
                        {suggestedCategories.map(c => (
                          <div
                            key={c}
                            className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onMouseDown={(e) => {
                              // use onMouseDown to fire before input onBlur
                              e.preventDefault();
                              setCategoria(c);
                              setShowCatSuggestions(false);
                            }}
                          >
                            {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Quantità *</Label>
                  <Input
                    type="number" min={1} value={quantita}
                    onChange={e => setQuantita(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data scadenza *</Label>
                  <Input
                    type="date" value={dataScadenza}
                    onChange={e => setDataScadenza(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Posizione sullo scaffale *</Label>
                <ShelfSelector value={posizione} onChange={setPosizione} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button
                onClick={handleSubmit}
                disabled={!nome || !categoria || !dataScadenza || !posizione || submitting}
              >
                {submitting ? 'Salvataggio...' : 'Salva'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vista per prodotto */}
      {vista === 'prodotto' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('nome')}>
                    Nome <SortIcon col="nome" />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('categoria')}>
                    Categoria <SortIcon col="categoria" />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground w-20" onClick={() => handleSort('quantita')}>
                    Qtà <SortIcon col="quantita" />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('dataScadenza')}>
                    Scadenza <SortIcon col="dataScadenza" />
                  </TableHead>
                  <TableHead>Posizione</TableHead>
                  {isEducatore && <TableHead className="w-28" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {prodottiFiltrati.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isEducatore ? 6 : 5} className="text-center text-muted-foreground py-10">
                      Nessun prodotto trovato
                    </TableCell>
                  </TableRow>
                )}
                {prodottiFiltrati.map(p => {
                  const giorni = giorniScadenza(p.dataScadenza);
                  const isScaduto = giorni < 0;
                  const isWarning = giorni >= 0 && giorni <= GIORNI_ALLERTA;
                  return (
                    <TableRow key={p.id} className={cn(isScaduto && 'bg-destructive/5', isWarning && 'bg-amber-50 dark:bg-amber-950/20')}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.categoria}</Badge>
                      </TableCell>
                      <TableCell>{p.quantita}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatData(p.dataScadenza)}</span>
                          {badgeScadenza(giorni)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MiniShelf posizione={p.posizione} />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            R{p.posizione?.ripiano} C{p.posizione?.colonna}
                          </span>
                        </div>
                      </TableCell>
                      {isEducatore && (
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Utilizzato
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Conferma utilizzo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Stai per segnare <strong>"{p.nome}"</strong> come utilizzato. Il prodotto verrà rimosso dall'elenco.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p.id, p.nome)}>
                                  Conferma
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Vista per categoria */}
      {vista === 'categoria' && (
        <Accordion type="multiple" className="space-y-2">
          {perCategoria.length === 0 && (
            <p className="text-center text-muted-foreground py-10">Nessun prodotto trovato</p>
          )}
          {perCategoria.map(([cat, items]) => {
            const totQta = items.reduce((s, i) => s + i.quantita, 0);
            const hasAlert = items.some(i => giorniScadenza(i.dataScadenza) <= GIORNI_ALLERTA);
            return (
              <AccordionItem key={cat} value={cat} className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <span className="font-semibold">{cat}</span>
                    <Badge variant="outline">{items.length} prodotti</Badge>
                    <span className="text-xs text-muted-foreground">Totale: {totQta} pz</span>
                    {hasAlert && <Badge variant="destructive" className="text-xs">⚠ In scadenza</Badge>}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0">
                  {/* Prodotti nella categoria */}
                  <Accordion type="multiple" className="px-4 space-y-1 pb-2">
                    {items.map(p => {
                      const giorni = giorniScadenza(p.dataScadenza);
                      return (
                        <AccordionItem key={p.id} value={p.id} className="border rounded-md">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline text-sm hover:bg-muted/30">
                            <div className="flex items-center gap-3 flex-1 text-left">
                              <span>{p.nome}</span>
                              <span className="text-muted-foreground text-xs">x{p.quantita}</span>
                              {badgeScadenza(giorni)}
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 pt-2">
                            <div className="grid grid-cols-[1fr_auto_auto] items-start gap-6 pt-3 border-t">

                              {/* Scadenza */}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Scadenza</p>
                                <p className="text-sm font-semibold">{formatData(p.dataScadenza)}</p>
                                {(() => {
                                  const g = giorniScadenza(p.dataScadenza);
                                  if (g < 0) return <p className="text-xs text-destructive font-medium mt-0.5">Scaduto</p>;
                                  if (g <= GIORNI_ALLERTA) return <p className="text-xs text-amber-600 font-medium mt-0.5">Scade in {g} giorn{g === 1 ? 'o' : 'i'}</p>;
                                  return null;
                                })()}
                              </div>

                              {/* Posizione scaffale */}
                              <div className="flex flex-col items-center gap-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Posizione</p>
                                <MiniShelf posizione={p.posizione} />
                                <span className="text-[11px] font-mono font-semibold bg-muted px-2 py-0.5 rounded">
                                  R{p.posizione?.ripiano} · C{p.posizione?.colonna}
                                </span>
                              </div>

                              {/* Azioni */}
                              {isEducatore && (
                                <div className="flex items-start pt-1">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs gap-1.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Segna utilizzato
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Conferma utilizzo</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Il prodotto <strong>"{p.nome}"</strong> verrà rimosso dall'elenco.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(p.id, p.nome)}>
                                          Conferma
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

// ─── Componente Generico (Cancelleria / Materiale) ────────────────────────────

function TabGenerico({ collectionName, label }: { collectionName: string; label: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();

  const isEducatore = userData?.roles?.includes('educatore') || userData?.roles?.includes('admin');

  const q = useMemoFirebase(() =>
    firestore ? query(collection(firestore, collectionName), orderBy('nome', 'asc')) : null,
    [firestore, collectionName]);
  const { data: prodotti = [] } = useCollection<ProdottoGenerico>(q);

  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState('');
  const [quantita, setQuantita] = useState(1);
  const [stanza, setStanza] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [sortKey, setSortKey] = useState<'nome' | 'quantita' | 'stanza'>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showStanzaSuggestions, setShowStanzaSuggestions] = useState(false);

  // Stanze uniche da storico
  const stanzeStorico = useMemo(() => {
    const set = new Set((prodotti || []).map(p => p.stanza).filter(Boolean));
    return Array.from(set).sort();
  }, [prodotti]);

  const handleSubmit = async () => {
    if (!firestore || !user || !nome || !stanza) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, collectionName), {
        nome: nome.trim(),
        quantita,
        stanza: stanza.trim(),
        addedAt: serverTimestamp(),
        addedBy: user.uid,
      });
      toast({ title: 'Prodotto aggiunto', description: `"${nome}" inserito con successo.` });
      setOpen(false);
      setNome(''); setQuantita(1); setStanza('');
    } catch {
      toast({ title: 'Errore', description: 'Impossibile salvare il prodotto.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nomeProd: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, collectionName, id));
      toast({ title: 'Prodotto rimosso', description: `"${nomeProd}" rimosso.` });
    } catch {
      toast({ title: 'Errore', description: 'Impossibile rimuovere.', variant: 'destructive' });
    }
  };

  const handleSort = (key: 'nome' | 'quantita' | 'stanza') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />;
  };

  const prodottiFiltrati = useMemo(() => {
    let list = [...(prodotti || [])];
    if (filterText) {
      const t = filterText.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(t) || p.stanza?.toLowerCase().includes(t));
    }
    list.sort((a, b) => {
      let va: any = a[sortKey];
      let vb: any = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [prodotti, filterText, sortKey, sortDir]);

  const suggestedStanze = useMemo(() => {
    if (!stanza) return stanzeStorico;
    return stanzeStorico.filter(s => s.toLowerCase().includes(stanza.toLowerCase()));
  }, [stanzeStorico, stanza]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca prodotto o stanza..."
            className="pl-9 w-64"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Aggiungi {label}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi {label}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Nome prodotto *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder={`Nome ${label.toLowerCase()}`} />
              </div>
              <div className="space-y-1">
                <Label>Quantità *</Label>
                <Input type="number" min={1} value={quantita} onChange={e => setQuantita(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-1">
                <Label>Stanza *</Label>
                <div className="relative">
                  <Input
                    value={stanza}
                    onChange={e => {
                      setStanza(e.target.value);
                      setShowStanzaSuggestions(true);
                    }}
                    onFocus={() => setShowStanzaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowStanzaSuggestions(false), 200)}
                    placeholder="es. Sala riunioni, Magazzino..."
                  />
                  {showStanzaSuggestions && suggestedStanze.length > 0 && (
                    <div className="absolute z-50 top-full w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-md max-h-48 overflow-auto py-1">
                      {suggestedStanze.map(s => (
                        <div
                          key={s}
                          className="px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setStanza(s);
                            setShowStanzaSuggestions(false);
                          }}
                        >
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {stanzeStorico.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Stanze usate: {stanzeStorico.join(', ')}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={handleSubmit} disabled={!nome || !stanza || submitting}>
                {submitting ? 'Salvataggio...' : 'Salva'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('nome')}>
                  Nome <SortIcon col="nome" />
                </TableHead>
                <TableHead className="cursor-pointer hover:text-foreground w-20" onClick={() => handleSort('quantita')}>
                  Qtà <SortIcon col="quantita" />
                </TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('stanza')}>
                  Stanza <SortIcon col="stanza" />
                </TableHead>
                {isEducatore && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {prodottiFiltrati.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isEducatore ? 4 : 3} className="text-center text-muted-foreground py-10">
                    Nessun prodotto trovato
                  </TableCell>
                </TableRow>
              )}
              {prodottiFiltrati.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.quantita}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.stanza}</Badge>
                  </TableCell>
                  {isEducatore && (
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs gap-1">
                            <Trash2 className="h-3.5 w-3.5" /> Rimuovi
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Conferma rimozione</AlertDialogTitle>
                            <AlertDialogDescription>
                              Vuoi rimuovere <strong>"{p.nome}"</strong> dall'elenco?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(p.id, p.nome)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Rimuovi
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pagina Principale ────────────────────────────────────────────────────────

export default function MagazzinoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Magazzino</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestione inventario: alimenti, cancelleria e materiale vario dell'associazione.
        </p>
      </div>

      <Tabs defaultValue="alimenti">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="alimenti" className="gap-2">
            <Package className="h-4 w-4" /> Alimenti
          </TabsTrigger>
          <TabsTrigger value="cancelleria" className="gap-2">
            <BookOpenCheck className="h-4 w-4" /> Cancelleria
          </TabsTrigger>
          <TabsTrigger value="materiale" className="gap-2">
            <Layers className="h-4 w-4" /> Materiale Vario
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alimenti" className="mt-6">
          <TabAlimenti />
        </TabsContent>

        <TabsContent value="cancelleria" className="mt-6">
          <TabGenerico collectionName="magazzino-cancelleria" label="Articolo di Cancelleria" />
        </TabsContent>

        <TabsContent value="materiale" className="mt-6">
          <TabGenerico collectionName="magazzino-materiale" label="Materiale Vario" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
