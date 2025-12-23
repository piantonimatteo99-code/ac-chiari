'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/src/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddFamiliareDialog({ isOpen, onOpenChange }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    dataNascita: '',
    codiceFiscale: '',
    luogoNascita: '',
    indirizzo: '',
    telefonoPrincipale: '',
    telefonoSecondario: '',
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!firestore || !user) {
      setError('Utente o database non disponibile.');
      return;
    }

    if (!formData.nome || !formData.cognome || !formData.dataNascita) {
      setError('Nome, cognome e data di nascita sono obbligatori.');
      return;
    }

    try {
      const familiariCollection = collection(firestore, 'familiari');
      await addDoc(familiariCollection, {
        ...formData,
        registratoDa: user.uid,
        emailRiferimento: user.email,
        createdAt: serverTimestamp(),
      });

      // Reset form and close dialog
      setFormData({
        nome: '',
        cognome: '',
        dataNascita: '',
        codiceFiscale: '',
        luogoNascita: '',
        indirizzo: '',
        telefonoPrincipale: '',
        telefonoSecondario: '',
      });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setError('Si è verificato un errore durante il salvataggio.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Aggiungi Familiare</DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo membro del nucleo familiare.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nome" className="text-right">
              Nome
            </Label>
            <Input id="nome" value={formData.nome} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="cognome" className="text-right">
              Cognome
            </Label>
            <Input id="cognome" value={formData.cognome} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dataNascita" className="text-right">
              Data di Nascita
            </Label>
            <Input id="dataNascita" type="date" value={formData.dataNascita} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="codiceFiscale" className="text-right">
              Codice Fiscale
            </Label>
            <Input id="codiceFiscale" value={formData.codiceFiscale} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="luogoNascita" className="text-right">
              Luogo di Nascita
            </Label>
            <Input id="luogoNascita" value={formData.luogoNascita} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="indirizzo" className="text-right">
              Indirizzo
            </Label>
            <Input id="indirizzo" value={formData.indirizzo} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="telefonoPrincipale" className="text-right">
              Tel. Principale
            </Label>
            <Input id="telefonoPrincipale" value={formData.telefonoPrincipale} onChange={handleChange} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="telefonoSecondario" className="text-right">
              Tel. Secondario
            </Label>
            <Input id="telefonoSecondario" value={formData.telefonoSecondario} onChange={handleChange} className="col-span-3" />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button type="submit" onClick={handleSubmit}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
