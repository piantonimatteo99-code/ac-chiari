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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Pencil, ExternalLink, MapPin, Phone, Mail, Users, Sun, Snowflake, Info } from 'lucide-react';

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
      <div className="flex items-center justify-between">
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

      {case_list.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nessuna struttura inserita. {isAdmin && 'Clicca "Aggiungi Casa" per iniziare.'}</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {case_list.map(casa => (
          <Card key={casa.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    {casa.webLink
                      ? <a href={casa.webLink} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 text-primary">{casa.nome}<ExternalLink className="h-3 w-3" /></a>
                      : casa.nome
                    }
                  </CardTitle>
                  {casa.luogo && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><MapPin className="h-3 w-3" />{casa.luogo}</p>}
                </div>
                <div className="flex gap-1">
                  {casa.utilizzabileEstate && <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800"><Sun className="h-3 w-3 mr-0.5"/>Est</Badge>}
                  {casa.utilizzabileInverno && <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800"><Snowflake className="h-3 w-3 mr-0.5"/>Inv</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
              {/* Costo */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-sm font-semibold">€ {casa.costoValore} {COSTO_TIPO_LABELS[casa.costoTipo]}</Badge>
                {casa.costoEstate && <Badge variant="outline" className="text-amber-700 border-amber-300 text-xs">Est: €{casa.costoEstate}</Badge>}
                {casa.costoInverno && <Badge variant="outline" className="text-sky-700 border-sky-300 text-xs">Inv: €{casa.costoInverno}</Badge>}
              </div>

              {/* Interpretazione AI */}
              {casa.interpretazioneAI && (
                <div className="flex gap-2 p-2 rounded bg-muted text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                  <span>{casa.interpretazioneAI}</span>
                </div>
              )}

              {/* Posti */}
              {casa.maxPosti > 0 && (
                <p className="text-sm flex items-center gap-1"><Users className="h-4 w-4" /> Max {casa.maxPosti} posti</p>
              )}

              {/* Tempo percorrenza */}
              {casa.tempoPercorrenza && <p className="text-xs text-muted-foreground">🚗 {casa.tempoPercorrenza} da Chiari</p>}

              {/* Contatti */}
              <div className="text-xs space-y-0.5">
                {casa.telefonoContatto && <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{casa.telefonoContatto}</p>}
                {casa.mailContatto && <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{casa.mailContatto}</p>}
              </div>

              {/* Note espandibili */}
              {casa.note && (
                <div>
                  <button onClick={() => setExpandedId(expandedId === casa.id ? null : casa.id)} className="text-xs text-primary hover:underline">
                    {expandedId === casa.id ? 'Nascondi note' : 'Mostra note'}
                  </button>
                  {expandedId === casa.id && <p className="text-xs mt-1 text-muted-foreground border-l-2 pl-2">{casa.note}</p>}
                </div>
              )}
            </CardContent>

            {isAdmin && (
              <div className="flex gap-2 p-4 pt-0">
                <Dialog open={editingCasa?.id === casa.id} onOpenChange={o => { if (!o) setEditingCasa(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditingCasa(casa)}>
                      <Pencil className="h-3 w-3 mr-1" /> Modifica
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Modifica struttura</DialogTitle></DialogHeader>
                    <CosaForm initial={casa} onSave={data => saveCasa(data, casa.id)} onClose={() => setEditingCasa(null)} />
                  </DialogContent>
                </Dialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Elimina struttura</AlertDialogTitle>
                      <AlertDialogDescription>Vuoi eliminare <strong>{casa.nome}</strong>? L'azione è irreversibile.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteCasa(casa.id)}>Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
