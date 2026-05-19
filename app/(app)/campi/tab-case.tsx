'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, ExternalLink, MapPin, Phone, Mail, Users, Sun, Snowflake, Info, Search, X } from 'lucide-react';

export interface Casa {
  id: string;
  nome: string;
  webLink?: string;
  costoValore: number;
  costoTipo: 'giorno' | 'notte' | 'forfait' | 'stanza' | 'altro';
  costoAltroDesc?: string;
  costoEstate?: number;
  costoInverno?: number;
  interpretazioneAI?: string;
  maxPosti: number;
  utilizzabileEstate: boolean;
  utilizzabileInverno: boolean;
  telefonoContatto?: string;
  mailContatto?: string;
  luogo?: string;
  tempoPercorrenza?: string;
  note?: string;
}

const COSTO_TIPO_LABELS: Record<string, string> = {
  giorno: 'al giorno',
  notte: 'a notte',
  forfait: 'a forfait',
  stanza: 'a stanza',
  altro: 'altro',
};

function CosaForm({ initial, onSave, onClose }: { initial?: Partial<Casa>; onSave: (data: Partial<Casa>) => Promise<void>; onClose: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [webLink, setWebLink] = useState(initial?.webLink ?? '');
  const [costoValore, setCostoValore] = useState(initial?.costoValore ?? 0);
  const [costoTipo, setCostoTipo] = useState<Casa['costoTipo']>(initial?.costoTipo ?? 'notte');
  const [costoAltroDesc, setCostoAltroDesc] = useState(initial?.costoAltroDesc ?? '');
  const [costoEstate, setCostoEstate] = useState<string>(initial?.costoEstate?.toString() ?? '');
  const [costoInverno, setCostoInverno] = useState<string>(initial?.costoInverno?.toString() ?? '');
  const [interpretazioneAI, setInterpretazioneAI] = useState(initial?.interpretazioneAI ?? '');
  const [maxPosti, setMaxPosti] = useState(initial?.maxPosti ?? 0);
  const [utilizzabileEstate, setUtilizzabileEstate] = useState(initial?.utilizzabileEstate ?? true);
  const [utilizzabileInverno, setUtilizzabileInverno] = useState(initial?.utilizzabileInverno ?? true);
  const [telefonoContatto, setTelefonoContatto] = useState(initial?.telefonoContatto ?? '');
  const [mailContatto, setMailContatto] = useState(initial?.mailContatto ?? '');
  const [luogo, setLuogo] = useState(initial?.luogo ?? '');
  const [tempoPercorrenza, setTempoPercorrenza] = useState(initial?.tempoPercorrenza ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome) return;
    setSaving(true);
    await onSave({
      nome, webLink, costoValore, costoTipo, costoAltroDesc,
      costoEstate: costoEstate ? parseFloat(costoEstate) : undefined,
      costoInverno: costoInverno ? parseFloat(costoInverno) : undefined,
      interpretazioneAI, maxPosti, utilizzabileEstate, utilizzabileInverno,
      telefonoContatto, mailContatto, luogo, tempoPercorrenza, note,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <Label>Nome struttura *</Label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Casa Alpina Breno" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Link web</Label>
          <Input value={webLink} onChange={e => setWebLink(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-1">
          <Label>Costo (€)</Label>
          <Input type="number" min={0} value={costoValore} onChange={e => setCostoValore(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Tipo costo</Label>
          <Select value={costoTipo} onValueChange={v => setCostoTipo(v as Casa['costoTipo'])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(COSTO_TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {costoTipo === 'altro' && (
          <div className="space-y-1 col-span-2">
            <Label>Descrizione tipo costo</Label>
            <Input value={costoAltroDesc} onChange={e => setCostoAltroDesc(e.target.value)} placeholder="es. a settimana, per gruppo..." />
          </div>
        )}
        <div className="space-y-1">
          <Label>Costo estate (€) — se diverso</Label>
          <Input type="number" min={0} value={costoEstate} onChange={e => setCostoEstate(e.target.value)} placeholder="Lascia vuoto se uguale" />
        </div>
        <div className="space-y-1">
          <Label>Costo inverno (€) — se diverso</Label>
          <Input type="number" min={0} value={costoInverno} onChange={e => setCostoInverno(e.target.value)} placeholder="Lascia vuoto se uguale" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Interpretazione / Note sul costo (AI)</Label>
          <Textarea value={interpretazioneAI} onChange={e => setInterpretazioneAI(e.target.value)} placeholder="es. Il costo è per persona a notte, min 2 notti..." rows={2} />
        </div>
        <div className="space-y-1">
          <Label>Max posti</Label>
          <Input type="number" min={0} value={maxPosti} onChange={e => setMaxPosti(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Luogo</Label>
          <Input value={luogo} onChange={e => setLuogo(e.target.value)} placeholder="es. Breno (BS)" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Tempo di percorrenza da Chiari</Label>
          <Input value={tempoPercorrenza} onChange={e => setTempoPercorrenza(e.target.value)} placeholder="es. 45 min in auto" />
        </div>
        <div className="flex items-center gap-3 col-span-2 p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 flex-1">
            <Sun className="h-4 w-4 text-amber-500" />
            <Label className="cursor-pointer">Utilizzabile in estate</Label>
            <Switch checked={utilizzabileEstate} onCheckedChange={setUtilizzabileEstate} />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Snowflake className="h-4 w-4 text-sky-500" />
            <Label className="cursor-pointer">Utilizzabile in inverno</Label>
            <Switch checked={utilizzabileInverno} onCheckedChange={setUtilizzabileInverno} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Telefono contatto</Label>
          <Input value={telefonoContatto} onChange={e => setTelefonoContatto(e.target.value)} placeholder="+39 030 ..." />
        </div>
        <div className="space-y-1">
          <Label>Email contatto</Label>
          <Input type="email" value={mailContatto} onChange={e => setMailContatto(e.target.value)} placeholder="info@..." />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Note aggiuntive</Label>
          <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Qualsiasi informazione utile..." />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={!nome || saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
      </div>
    </div>
  );
}

export default function TabCase() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();
  const isAdmin = userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');

  const caseQuery = useMemoFirebase(() => firestore ? collection(firestore, 'campi-case') : null, [firestore]);
  const { data: caseData } = useCollection<Casa>(caseQuery);
  const case_list = caseData ?? [];

  const [openAdd, setOpenAdd] = useState(false);
  const [editingCasa, setEditingCasa] = useState<Casa | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStagione, setFilterStagione] = useState<'tutti' | 'estate' | 'inverno'>('tutti');
  const [filterPostiMin, setFilterPostiMin] = useState<number>(0);

  const hasActiveFilters = filterStagione !== 'tutti' || filterPostiMin > 0;

  const resetFilters = () => {
    setSearch('');
    setFilterStagione('tutti');
    setFilterPostiMin(0);
  };

  const filtered_list = case_list.filter(c => {
    if (search.trim() && ![c.nome, c.luogo, c.telefonoContatto, c.mailContatto, c.note].join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStagione === 'estate' && !c.utilizzabileEstate) return false;
    if (filterStagione === 'inverno' && !c.utilizzabileInverno) return false;
    if (filterPostiMin > 0 && (c.maxPosti ?? 0) < filterPostiMin) return false;
    return true;
  });

  const saveCasa = async (data: Partial<Casa>, id?: string) => {
    if (!firestore || !user) return;
    try {
      if (id) {
        await updateDoc(doc(firestore, 'campi-case', id), { ...data, updatedAt: serverTimestamp() });
        toast({ title: 'Casa aggiornata' });
      } else {
        await addDoc(collection(firestore, 'campi-case'), { ...data, createdAt: serverTimestamp(), createdBy: user.uid });
        toast({ title: 'Casa aggiunta' });
      }
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  const deleteCasa = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'campi-case', id));
      toast({ title: 'Casa rimossa' });
    } catch {
      toast({ title: 'Errore', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Case / Strutture</h2>
        {isAdmin && (
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Aggiungi Casa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Nuova struttura</DialogTitle></DialogHeader>
              <CosaForm onSave={data => saveCasa(data)} onClose={() => setOpenAdd(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per nome, luogo, contatto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Stagione */}
        <div className="flex items-center rounded-lg border overflow-hidden">
          <button
            onClick={() => setFilterStagione('tutti')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              filterStagione === 'tutti' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >Tutti</button>
          <button
            onClick={() => setFilterStagione('estate')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1 border-l transition-colors ${
              filterStagione === 'estate' ? 'bg-amber-500 text-white' : 'hover:bg-muted'
            }`}
          ><Sun className="h-3.5 w-3.5" />Estate</button>
          <button
            onClick={() => setFilterStagione('inverno')}
            className={`px-3 py-1.5 text-sm flex items-center gap-1 border-l transition-colors ${
              filterStagione === 'inverno' ? 'bg-sky-500 text-white' : 'hover:bg-muted'
            }`}
          ><Snowflake className="h-3.5 w-3.5" />Inverno</button>
        </div>

        {/* Posti minimi */}
        <Select value={String(filterPostiMin)} onValueChange={v => setFilterPostiMin(Number(v))}>
          <SelectTrigger className="w-40">
            <Users className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Posti minimi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Qualsiasi capienza</SelectItem>
            <SelectItem value="30">&ge; 30 posti</SelectItem>
            <SelectItem value="50">&ge; 50 posti</SelectItem>
            <SelectItem value="80">&ge; 80 posti</SelectItem>
            <SelectItem value="100">&ge; 100 posti</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset */}
        {(hasActiveFilters || search) && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />Reset
          </Button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{filtered_list.length} / {case_list.length} strutture</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Struttura</TableHead>
                <TableHead>Luogo</TableHead>
                <TableHead className="text-center">Posti</TableHead>
                <TableHead className="text-center">Stagione</TableHead>
                <TableHead>Costo</TableHead>
                <TableHead>Contatti</TableHead>
                {isAdmin && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered_list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-10">
                    {search ? 'Nessun risultato per la ricerca.' : <>Nessuna struttura inserita. {isAdmin && 'Clicca "Aggiungi Casa" per iniziare.'}</>}
                  </TableCell>
                </TableRow>
              )}
              {filtered_list.map(casa => (
                <>
                  <TableRow key={casa.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedId(expandedId === casa.id ? null : casa.id)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        {casa.webLink
                          ? <a href={casa.webLink} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary flex items-center gap-1" onClick={e => e.stopPropagation()}>{casa.nome}<ExternalLink className="h-3 w-3" /></a>
                          : casa.nome
                        }
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {casa.luogo && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{casa.luogo}</span>}
                      {casa.tempoPercorrenza && <span className="text-xs block">🚗 {casa.tempoPercorrenza}</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      {casa.maxPosti > 0 ? <span className="flex items-center justify-center gap-1"><Users className="h-3.5 w-3.5" />{casa.maxPosti}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {casa.utilizzabileEstate && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800"><Sun className="h-3 w-3 mr-0.5" />Est</Badge>}
                        {casa.utilizzabileInverno && <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800"><Snowflake className="h-3 w-3 mr-0.5" />Inv</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {casa.costoValore > 0 && <Badge className="text-xs">€{casa.costoValore} {COSTO_TIPO_LABELS[casa.costoTipo]}</Badge>}
                      {casa.interpretazioneAI && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{casa.interpretazioneAI}</p>}
                    </TableCell>
                    <TableCell className="text-xs space-y-0.5">
                      {casa.telefonoContatto && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{casa.telefonoContatto}</p>}
                      {casa.mailContatto && <a href={`mailto:${casa.mailContatto}`} className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}><Mail className="h-3 w-3" />{casa.mailContatto}</a>}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          <Dialog open={editingCasa?.id === casa.id} onOpenChange={o => { if (!o) setEditingCasa(null); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCasa(casa)}><Pencil className="h-3.5 w-3.5" /></Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader><DialogTitle>Modifica struttura</DialogTitle></DialogHeader>
                              <CosaForm initial={casa} onSave={data => saveCasa(data, casa.id)} onClose={() => setEditingCasa(null)} />
                            </DialogContent>
                          </Dialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Elimina struttura</AlertDialogTitle>
                                <AlertDialogDescription>Vuoi eliminare <strong>{casa.nome}</strong>?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteCasa(casa.id)}>Elimina</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {expandedId === casa.id && casa.note && (
                    <TableRow key={`${casa.id}-note`}>
                      <TableCell colSpan={isAdmin ? 7 : 6} className="bg-muted/30 py-2">
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                          <span className="whitespace-pre-line">{casa.note}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
