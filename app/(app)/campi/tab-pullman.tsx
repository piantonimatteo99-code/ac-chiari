'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/src/firebase';
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil, Phone, Mail, MapPin, Bus } from 'lucide-react';

export interface Pullman {
  id: string;
  azienda: string;
  telefono?: string;
  email?: string;
  localita?: string;
  note?: string;
}

function PullmanForm({ initial, onSave, onClose }: { initial?: Partial<Pullman>; onSave: (d: Partial<Pullman>) => Promise<void>; onClose: () => void }) {
  const [azienda, setAzienda] = useState(initial?.azienda ?? '');
  const [telefono, setTelefono] = useState(initial?.telefono ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [localita, setLocalita] = useState(initial?.localita ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!azienda) return;
    setSaving(true);
    await onSave({ azienda, telefono, email, localita, note });
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <Label>Nome azienda / N° pullman *</Label>
        <Input value={azienda} onChange={e => setAzienda(e.target.value)} placeholder="es. Autolinee Rossi - Pullman N°3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Telefono</Label>
          <Input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+39 ..." />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@..." />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Località</Label>
        <Input value={localita} onChange={e => setLocalita(e.target.value)} placeholder="es. Chiari (BS)" />
      </div>
      <div className="space-y-1">
        <Label>Note</Label>
        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note aggiuntive..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Annulla</Button>
        <Button onClick={handleSave} disabled={!azienda || saving}>{saving ? 'Salvataggio...' : 'Salva'}</Button>
      </div>
    </div>
  );
}

export default function TabPullman() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { userData } = useUserData();
  const { toast } = useToast();
  const isAdmin = userData?.roles?.includes('admin') || userData?.roles?.includes('educatore');

  const q = useMemoFirebase(() => firestore ? collection(firestore, 'campi-pullman') : null, [firestore]);
  const { data: pullmanData } = useCollection<Pullman>(q);
  const pullman_list = pullmanData ?? [];

  const [openAdd, setOpenAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const save = async (data: Partial<Pullman>, id?: string) => {
    if (!firestore || !user) return;
    try {
      if (id) {
        await updateDoc(doc(firestore, 'campi-pullman', id), { ...data, updatedAt: serverTimestamp() });
        toast({ title: 'Pullman aggiornato' });
      } else {
        await addDoc(collection(firestore, 'campi-pullman'), { ...data, createdAt: serverTimestamp(), createdBy: user.uid });
        toast({ title: 'Pullman aggiunto' });
      }
    } catch { toast({ title: 'Errore', variant: 'destructive' }); }
  };

  const remove = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'campi-pullman', id));
      toast({ title: 'Pullman rimosso' });
    } catch { toast({ title: 'Errore', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2"><Bus className="h-5 w-5" />Pullman / Aziende</h2>
        {isAdmin && (
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Aggiungi Pullman</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuovo pullman</DialogTitle></DialogHeader>
              <PullmanForm onSave={d => save(d)} onClose={() => setOpenAdd(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Azienda / N° Pullman</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Località</TableHead>
                <TableHead>Note</TableHead>
                {isAdmin && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pullman_list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-10">
                    Nessun pullman inserito.
                  </TableCell>
                </TableRow>
              )}
              {pullman_list.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.azienda}</TableCell>
                  <TableCell>
                    {p.telefono ? <a href={`tel:${p.telefono}`} className="flex items-center gap-1 text-primary hover:underline text-sm"><Phone className="h-3 w-3" />{p.telefono}</a> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {p.email ? <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-primary hover:underline text-sm"><Mail className="h-3 w-3" />{p.email}</a> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {p.localita ? <span className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3" />{p.localita}</span> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.note || '—'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog open={editingId === p.id} onOpenChange={o => { if (!o) setEditingId(null); }}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(p.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Modifica pullman</DialogTitle></DialogHeader>
                            <PullmanForm initial={p} onSave={d => save(d, p.id)} onClose={() => setEditingId(null)} />
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Elimina pullman</AlertDialogTitle>
                              <AlertDialogDescription>Vuoi eliminare <strong>{p.azienda}</strong>?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(p.id)}>Elimina</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
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
