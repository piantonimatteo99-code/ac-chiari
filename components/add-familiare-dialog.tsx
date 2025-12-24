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
import { useFirestore } from '@/src/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import type { Membro as MembroBase } from '@/app/(app)/nucleo-familiare/page';
import { User } from 'firebase/auth';
import { slugify } from '@/lib/utils';


type Membro = Omit<MembroBase, 'id'>;

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  membroToEdit?: MembroBase | null;
  user: User;
  famigliaId: string | null;
}

const initialMembroState: Membro = {
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

export function AddFamiliareDialog({ isOpen, onOpenChange, membroToEdit, user, famigliaId: initialFamigliaId }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  
  const [membroData, setMembroData] = useState(initialMembroState);
  const [anagraficaData, setAnagraficaData] = useState(initialAnagraficaState);
  const [error, setError] = useState<string | null>(null);

  const isEditing = membroToEdit != null;

  useEffect(() => {
    async function fetchFamilyData() {
        if (initialFamigliaId && firestore) {
            const famigliaDocRef = doc(firestore, 'famiglie', initialFamigliaId);
            const famigliaDocSnap = await getDoc(famigliaDocRef);
            if (famigliaDocSnap.exists()) {
                const data = famigliaDocSnap.data();
                setAnagraficaData({
                    via: data.via || '',
                    numeroCivico: data.numeroCivico || '',
                    citta: data.citta || '',
                    provincia: data.provincia || '',
                    cap: data.cap || '',
                });
            }
        } else {
             setAnagraficaData(initialAnagraficaState);
        }
    }

    if (isOpen) {
      if (isEditing && membroToEdit) {
        setMembroData({
          nome: membroToEdit.nome || '',
          cognome: membroToEdit.cognome || '',
          dataNascita: membroToEdit.dataNascita || '',
          codiceFiscale: membroToEdit.codiceFiscale || '',
          luogoNascita: membroToEdit.luogoNascita || '',
          telefonoPrincipale: membroToEdit.telefonoPrincipale || '',
          telefonoSecondario: membroToEdit.telefonoSecondario || '',
        });
      } else {
        setMembroData(initialMembroState);
      }
      fetchFamilyData();
      setError(null);
    }
  }, [membroToEdit, isEditing, isOpen, initialFamigliaId, firestore]);
  
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
        setMembroData((prev) => ({ ...prev, [id]: formattedValue as any }));
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

    if (!membroData.nome || !membroData.cognome || !membroData.dataNascita) {
      setError('Nome, cognome e data di nascita del membro sono obbligatori.');
      return;
    }
    
    if (!anagraficaData.via || !anagraficaData.citta || !anagraficaData.cap) {
        setError('L\'indirizzo della famiglia (via, città, CAP) è obbligatorio.');
        return;
    }

    const newFamigliaId = slugify(`${anagraficaData.via} ${anagraficaData.citta} ${anagraficaData.cap}`);

    try {
      // 1. Save family data (address)
      const famigliaDocRef = doc(firestore, 'famiglie', newFamigliaId);
      await setDoc(famigliaDocRef, {
        ...anagraficaData,
        uidCapofamiglia: user.uid,
        emailCapofamiglia: user.email,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // 2. Save membro data
      if (isEditing && membroToEdit && initialFamigliaId) {
        const membroDocRef = doc(firestore, 'famiglie', initialFamigliaId, 'membri', membroToEdit.id);
        await updateDoc(membroDocRef, {
            ...membroData,
        });
      } else {
        const membriCollectionRef = collection(firestore, 'famiglie', newFamigliaId, 'membri');
        await addDoc(membriCollectionRef, {
            ...membroData,
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
          <DialogTitle>{isEditing ? 'Modifica Dati Membro' : 'Aggiungi Membro Familiare'}</DialogTitle>
          <DialogDescription>
            {isEditing 
                ? "Aggiorna i dati di questo membro della famiglia."
                : "Inserisci i dati del nuovo membro e l'indirizzo condiviso del nucleo familiare."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm font-medium">Dati del Membro</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={membroData.nome} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cognome">Cognome</Label>
              <Input id="cognome" value={membroData.cognome} onChange={handleChange} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dataNascita">Data di Nascita</Label>
            <Input id="dataNascita" type="date" value={membroData.dataNascita} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
            <Input id="codiceFiscale" value={membroData.codiceFiscale} onChange={handleChange} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="luogoNascita">Luogo di Nascita</Label>
            <Input id="luogoNascita" value={membroData.luogoNascita} onChange={handleChange} />
          </div>

          <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium">Indirizzo del Nucleo Familiare</p>
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
              <Input id="telefonoPrincipale" value={membroData.telefonoPrincipale} onChange={handleChange} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefonoSecondario">Tel. Secondario</Label>
              <Input id="telefonoSecondario" value={membroData.telefonoSecondario} onChange={handleChange} />
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
