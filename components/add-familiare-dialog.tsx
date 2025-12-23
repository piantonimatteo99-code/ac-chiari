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
import { AddressInput } from '@/src/components/address-input';

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
  via: '',
  numeroCivico: '',
  citta: '',
  provincia: '',
  cap: '',
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
    if (isOpen) {
      if (isEditing && familiareToEdit) {
        // Since address fields are split now, we handle them directly.
        const addressData = {
          via: (familiareToEdit as any).via || '',
          numeroCivico: (familiareToEdit as any).numeroCivico || '',
          citta: (familiareToEdit as any).citta || '',
          provincia: (familiareToEdit as any).provincia || '',
          cap: (familiareToEdit as any).cap || '',
        };
        setFormData({
          nome: familiareToEdit.nome || '',
          cognome: familiareToEdit.cognome || '',
          dataNascita: familiareToEdit.dataNascita || '',
          codiceFiscale: familiareToEdit.codiceFiscale || '',
          luogoNascita: familiareToEdit.luogoNascita || '',
          ...addressData,
          telefonoPrincipale: familiareToEdit.telefonoPrincipale || '',
          telefonoSecondario: familiareToEdit.telefonoSecondario || '',
        });
      } else {
        setFormData(initialState);
      }
       setError(null);
    }
  }, [familiareToEdit, isEditing, isOpen]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };
  
  const handleAddressSelect = (address: { via: string; numeroCivico: string; citta: string; provincia: string; cap: string; }) => {
    setFormData(prev => ({
        ...prev,
        via: address.via,
        numeroCivico: address.numeroCivico,
        citta: address.citta,
        provincia: address.provincia,
        cap: address.cap,
    }));
  }

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
      if(isEditing && familiareToEdit) {
        const docRef = doc(firestore, 'familiari', familiareToEdit.id);
        await updateDoc(docRef, {
            ...formData,
        });
      } else {
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
      <DialogContent className="sm:max-w-[475px]">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={formData.nome} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cognome">Cognome</Label>
              <Input id="cognome" value={formData.cognome} onChange={handleChange} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dataNascita">Data di Nascita</Label>
            <Input id="dataNascita" type="date" value={formData.dataNascita} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
            <Input id="codiceFiscale" value={formData.codiceFiscale} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="luogoNascita">Luogo di Nascita</Label>
            <Input id="luogoNascita" value={formData.luogoNascita} onChange={handleChange} />
          </div>

          <AddressInput onAddressSelect={handleAddressSelect} />

          <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3 grid gap-2">
                  <Label htmlFor="via">Via</Label>
                  <Input id="via" value={formData.via} onChange={handleChange} disabled />
              </div>
              <div className="col-span-2 grid gap-2">
                  <Label htmlFor="numeroCivico">Numero Civico</Label>
                  <Input id="numeroCivico" value={formData.numeroCivico} onChange={handleChange} disabled />
              </div>
          </div>
           <div className="grid grid-cols-5 gap-4">
              <div className="col-span-3 grid gap-2">
                  <Label htmlFor="citta">Città</Label>
                  <Input id="citta" value={formData.citta} onChange={handleChange} disabled />
              </div>
               <div className="grid gap-2">
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input id="provincia" value={formData.provincia} onChange={handleChange} disabled />
              </div>
               <div className="grid gap-2">
                  <Label htmlFor="cap">CAP</Label>
                  <Input id="cap" value={formData.cap} onChange={handleChange} disabled />
              </div>
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="telefonoPrincipale">Tel. Principale</Label>
              <Input id="telefonoPrincipale" value={formData.telefonoPrincipale} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefonoSecondario">Tel. Secondario</Label>
              <Input id="telefonoSecondario" value={formData.telefonoSecondario} onChange={handleChange} />
            </div>
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
