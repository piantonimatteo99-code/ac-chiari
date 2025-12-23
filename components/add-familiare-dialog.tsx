'use client';

import { useState, useEffect } from 'react';
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
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import type { Familiare } from '@/app/(app)/nucleo-familiare/page';
import AddressInput from '../src/components/address-input';

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familiareToEdit?: Familiare | null;
}

const initialState = {
  nome: '',
  cognome: '',
  dataNascita: '',
  codiceFiscale: '',
  luogoNascita: '',
  indirizzo: '',
  telefonoPrincipale: '',
  telefonoSecondario: '',
};

export function AddFamiliareDialog({ isOpen, onOpenChange, familiareToEdit }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState<string | null>(null);

  const isEditing = familiareToEdit != null;

  useEffect(() => {
    if (isEditing) {
      // If we are editing, pre-fill the form with existing data
      setFormData({
        nome: familiareToEdit.nome,
        cognome: familiareToEdit.cognome,
        dataNascita: familiareToEdit.dataNascita,
        codiceFiscale: familiareToEdit.codiceFiscale || '',
        luogoNascita: familiareToEdit.luogoNascita || '',
        indirizzo: familiareToEdit.indirizzo || '',
        telefonoPrincipale: familiareToEdit.telefonoPrincipale || '',
        telefonoSecondario: familiareToEdit.telefonoSecondario || '',
      });
    } else {
      // If adding a new one, reset the form
      setFormData(initialState);
    }
  }, [familiareToEdit, isOpen]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleAddressChange = (address: string) => {
    setFormData((prev) => ({ ...prev, indirizzo: address }));
  };

  const handleClose = () => {
    onOpenChange(false);
  }

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
      if(isEditing) {
        // Update existing document
        const docRef = doc(firestore, 'familiari', familiareToEdit.id);
        await updateDoc(docRef, {
            ...formData,
            // You might want to add an updatedAt field here
        });
      } else {
        // Create new document
        const familiariCollection = collection(firestore, 'familiari');
        await addDoc(familiariCollection, {
            ...formData,
            registratoDa: user.uid,
            emailRiferimento: user.email,
            createdAt: serverTimestamp(),
        });
      }

      handleClose();
    } catch (err) {
      console.error(err);
      setError('Si è verificato un errore durante il salvataggio.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifica Familiare' : 'Aggiungi Familiare'}</DialogTitle>
          <DialogDescription>
            {isEditing 
                ? 'Aggiorna i dati del membro del nucleo familiare.'
                : 'Inserisci i dati del nuovo membro del nucleo familiare.'
            }
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
             <AddressInput
                id="indirizzo"
                value={formData.indirizzo}
                onChange={handleAddressChange}
                className="col-span-3"
            />
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
          <Button variant="outline" onClick={handleClose}>Annulla</Button>
          <Button type="submit" onClick={handleSubmit}>Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
