'use client';

import { useState, useEffect, useRef } from 'react';
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
import { useDebounce } from 'use-debounce';

interface AddFamiliareDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  familiareToEdit?: Familiare | null;
}

const initialState: Omit<Familiare, 'id'> = {
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

interface AddressSuggestion {
  description: string;
  place_id: string;
}

interface ParsedAddress {
    via: string;
    numeroCivico: string;
    citta: string;
    provincia: string;
    cap: string;
}


export function AddFamiliareDialog({ isOpen, onOpenChange, familiareToEdit }: AddFamiliareDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState<string | null>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [debouncedAddressQuery] = useDebounce(addressQuery, 500);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const isEditing = familiareToEdit != null;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && familiareToEdit) {
        setFormData({
          nome: familiareToEdit.nome || '',
          cognome: familiareToEdit.cognome || '',
          dataNascita: familiareToEdit.dataNascita || '',
          codiceFiscale: familiareToEdit.codiceFiscale || '',
          luogoNascita: familiareToEdit.luogoNascita || '',
          via: familiareToEdit.via || '',
          numeroCivico: familiareToEdit.numeroCivico || '',
          citta: familiareToEdit.citta || '',
          provincia: familiareToEdit.provincia || '',
          cap: familiareToEdit.cap || '',
          telefonoPrincipale: familiareToEdit.telefonoPrincipale || '',
          telefonoSecondario: familiareToEdit.telefonoSecondario || '',
        });
      } else {
        setFormData(initialState);
      }
       setError(null);
       setSuggestions([]);
       setAddressQuery('');
    }
  }, [familiareToEdit, isEditing, isOpen]);
  
  // Effect for fetching address suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedAddressQuery.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`/api/places?input=${debouncedAddressQuery}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching address suggestions:', error);
        setSuggestions([]);
      }
    };

    fetchSuggestions();
  }, [debouncedAddressQuery]);
  
  // Click outside handler for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));

    // Update address query for suggestions
    const addressFields = ['via', 'numeroCivico', 'citta'];
    if (addressFields.includes(id)) {
        const newQueryParts = {
            citta: id === 'citta' ? value : formData.citta,
            via: id === 'via' ? value : formData.via,
            numeroCivico: id === 'numeroCivico' ? value : formData.numeroCivico
        };
        const newQuery = `${newQueryParts.via} ${newQueryParts.numeroCivico}, ${newQueryParts.citta}`.trim();
        setAddressQuery(newQuery);
    }
  };

  const handleSelectSuggestion = async (placeId: string) => {
    setSuggestions([]);
    try {
        const response = await fetch(`/api/places?placeId=${placeId}`);
        if(!response.ok) throw new Error('Failed to fetch place details');
        const data: ParsedAddress = await response.json();
        setFormData(prev => ({
            ...prev,
            ...data
        }));
    } catch(error) {
        console.error('Error fetching place details:', error);
    }
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

          <div className="relative" ref={suggestionsRef}>
             <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 grid gap-2">
                    <Label htmlFor="citta">Città</Label>
                    <Input id="citta" value={formData.citta} onChange={handleChange} autoComplete="off" />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="provincia">Prov.</Label>
                    <Input id="provincia" value={formData.provincia} onChange={handleChange} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="cap">CAP</Label>
                    <Input id="cap" value={formData.cap} onChange={handleChange} />
                </div>
              </div>
            <div className="grid grid-cols-5 gap-4 mt-4">
                <div className="col-span-4 grid gap-2">
                    <Label htmlFor="via">Via</Label>
                    <Input id="via" value={formData.via} onChange={handleChange} autoComplete="off" />
                </div>
                <div className="col-span-1 grid gap-2">
                    <Label htmlFor="numeroCivico">N.</Label>
                    <Input id="numeroCivico" value={formData.numeroCivico} onChange={handleChange} autoComplete="off" />
                </div>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-background border border-border rounded-md shadow-lg z-50">
                <ul className="py-1">
                  {suggestions.map((suggestion) => (
                    <li
                      key={suggestion.place_id}
                      className="px-3 py-2 cursor-pointer hover:bg-accent"
                      onMouseDown={() => handleSelectSuggestion(suggestion.place_id)}
                    >
                      {suggestion.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
