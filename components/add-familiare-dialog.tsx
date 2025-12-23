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
import type { Familiare as FamiliareBase } from '@/app/(app)/nucleo-familiare/page';
import type { UserData } from '@/src/hooks/use-user-data';

type Familiare = Omit<FamiliareBase, 'id'>;

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familiareToEdit?: FamiliareBase | null;
  userAnagrafica?: UserData | null;
}

const initialFamiliareState: Familiare = {
  nome: '',
  cognome: '',
  dataNascita: '',
  codiceFiscale: '',
  luogoNascita: '',
  telefonoPrincipale: '',
  telefonoSecondario: '',
};

const initialAnagraficaState = {
    via: '',
    numeroCivico: '',
    citta: '',
    provincia: '',
    cap: '',
};

const capitalizeWords = (str: string) => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

export function AddFamiliareDialog({ isOpen, onOpenChange, familiareToEdit, userAnagrafica }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [familiareData, setFamiliareData] = useState(initialFamiliareState);
  const [anagraficaData, setAnagraficaData] = useState(initialAnagraficaState);
  const [error, setError] = useState<string | null>(null);

  const isEditing = familiareToEdit != null;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && familiareToEdit) {
        setFamiliareData({
          nome: familiareToEdit.nome || '',
          cognome: familiareToEdit.cognome || '',
          dataNascita: familiareToEdit.dataNascita || '',
          codiceFiscale: familiareToEdit.codiceFiscale || '',
          luogoNascita: familiareToEdit.luogoNascita || '',
          telefonoPrincipale: familiareToEdit.telefonoPrincipale || '',
          telefonoSecondario: familiareToEdit.telefonoSecondario || '',
        });
      } else {
        setFamiliareData(initialFamiliareState);
      }

      if (userAnagrafica) {
          setAnagraficaData({
              via: userAnagrafica.via || '',
              numeroCivico: userAnagrafica.numeroCivico || '',
              citta: userAnagrafica.citta || '',
              provincia: userAnagrafica.provincia || '',
              cap: userAnagrafica.cap || '',
          });
      } else {
          setAnagraficaData(initialAnagraficaState);
      }

       setError(null);
    }
  }, [familiareToEdit, isEditing, isOpen, userAnagrafica]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let formattedValue = value;
    
    const anagraficaKeys = Object.keys(initialAnagraficaState);
    const isAnagraficaField = anagraficaKeys.includes(id);

    switch (id) {
        case 'codiceFiscale':
        case 'provincia':
            formattedValue = value.toUpperCase();
            break;
        case 'nome':
        case 'cognome':
        case 'luogoNascita':
        case 'citta':
        case 'via':
            formattedValue = capitalizeWords(value);
            break;
        default:
            break;
    }
    
    if (isAnagraficaField) {
        setAnagraficaData((prev) => ({ ...prev, [id]: formattedValue }));
    } else {
        setFamiliareData((prev) => ({ ...prev, [id]: formattedValue as any }));
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!firestore || !user) {
      setError('Utente o database non disponibile.');
      return;
    }

    if (!familiareData.nome || !familiareData.cognome || !familiareData.dataNascita) {
      setError('Nome, cognome e data di nascita del familiare sono obbligatori.');
      return;
    }

    try {
      // 1. Save anagrafica data to the user's document
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        ...anagraficaData
      });

      // 2. Save familiare data
      if (isEditing && familiareToEdit) {
        const docRef = doc(firestore, 'familiari', familiareToEdit.id);
        await updateDoc(docRef, {
            ...familiareData,
        });
      } else {
        const familiariCollection = collection(firestore, 'familiari');
        await addDoc(familiariCollection, {
            ...familiareData,
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
          <DialogTitle>{isEditing ? 'Modifica Dati Familiare' : 'Aggiungi Familiare'}</DialogTitle>
          <DialogDescription>
            {isEditing 
                ? 'Aggiorna i dati del membro del nucleo familiare. L\'indirizzo qui sotto è condiviso con tutto il nucleo.'
                : 'Inserisci i dati del nuovo membro. L\'indirizzo è condiviso con tutto il nucleo familiare.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={familiareData.nome} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cognome">Cognome</Label>
              <Input id="cognome" value={familiareData.cognome} onChange={handleChange} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dataNascita">Data di Nascita</Label>
            <Input id="dataNascita" type="date" value={familiareData.dataNascita} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
            <Input id="codiceFiscale" value={familiareData.codiceFiscale} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="luogoNascita">Luogo di Nascita</Label>
            <Input id="luogoNascita" value={familiareData.luogoNascita} onChange={handleChange} />
          </div>

          <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground pt-2 border-t">Indirizzo di Residenza Familiare</p>
              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-3 grid gap-2">
                      <Label htmlFor="citta">Città</Label>
                      <Input id="citta" value={anagraficaData.citta} onChange={handleChange} autoComplete="off"/>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="provincia">Prov.</Label>
                      <Input id="provincia" value={anagraficaData.provincia} onChange={handleChange} maxLength={2} />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="cap">CAP</Label>
                      <Input id="cap" value={anagraficaData.cap} onChange={handleChange} />
                  </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-4 grid gap-2">
                      <Label htmlFor="via">Via</Label>
                      <Input id="via" value={anagraficaData.via} onChange={handleChange} autoComplete="off" />
                  </div>
                  <div className="col-span-1 grid gap-2">
                      <Label htmlFor="numeroCivico">N.</Label>
                      <Input id="numeroCivico" value={anagraficaData.numeroCivico} onChange={handleChange} autoComplete="off" />
                  </div>
              </div>
            </div>
          
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="grid gap-2">
              <Label htmlFor="telefonoPrincipale">Tel. Principale</Label>
              <Input id="telefonoPrincipale" value={familiareData.telefonoPrincipale} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefonoSecondario">Tel. Secondario</Label>
              <Input id="telefonoSecondario" value={familiareData.telefonoSecondario} onChange={handleChange} />
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
