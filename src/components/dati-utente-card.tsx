'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserData } from "@/src/hooks/use-user-data";
import { useFirestore } from "@/src/firebase";
import { doc, updateDoc } from 'firebase/firestore';
import { useDebounce } from 'use-debounce';

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

export default function DatiUtenteCard() {
  const { userData, isLoading } = useUserData();
  const firestore = useFirestore();
  const [formData, setFormData] = useState(initialState);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [addressQuery, setAddressQuery] = useState('');
  const [debouncedAddressQuery] = useDebounce(addressQuery, 500);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (userData) {
      setFormData({
        nome: userData.nome || '',
        cognome: userData.cognome || '',
        dataNascita: userData.dataNascita || '',
        codiceFiscale: userData.codiceFiscale || '',
        luogoNascita: userData.luogoNascita || '',
        via: userData.via || '',
        numeroCivico: userData.numeroCivico || '',
        citta: userData.citta || '',
        provincia: userData.provincia || '',
        cap: userData.cap || '',
        telefonoPrincipale: userData.telefonoPrincipale || '',
        telefonoSecondario: userData.telefonoSecondario || '',
      });
      setEmail(userData.email || '');
    }
  }, [userData]);

  // Effect for fetching address suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedAddressQuery.length < 3 || !isEditing) {
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
  }, [debouncedAddressQuery, isEditing]);
  
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
    if (isEditing && addressFields.includes(id)) {
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

  const handleSave = async () => {
    if (!userData || !firestore) {
      setError("Dati utente o database non trovati.");
      return;
    }
    setError(null);
    setSuccess(null);

    try {
      const userDocRef = doc(firestore, 'users', userData.id);
      await updateDoc(userDocRef, {
        ...formData,
        displayName: `${formData.nome} ${formData.cognome}`.trim(),
      });
      setSuccess("Dati aggiornati con successo!");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError("Si è verificato un errore durante l'aggiornamento.");
    }
  };
  
  const handleCancel = () => {
    if(userData) {
      setFormData({
        nome: userData.nome || '',
        cognome: userData.cognome || '',
        dataNascita: userData.dataNascita || '',
        codiceFiscale: userData.codiceFiscale || '',
        luogoNascita: userData.luogoNascita || '',
        via: userData.via || '',
        numeroCivico: userData.numeroCivico || '',
        citta: userData.citta || '',
        provincia: userData.provincia || '',
        cap: userData.cap || '',
        telefonoPrincipale: userData.telefonoPrincipale || '',
        telefonoSecondario: userData.telefonoSecondario || '',
      });
    }
    setIsEditing(false);
    setError(null);
    setSuccess(null);
    setSuggestions([]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Dati</CardTitle>
        <CardDescription>Visualizza e modifica le tue informazioni personali.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Caricamento dati...</p>
        ) : (
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={formData.nome} onChange={handleChange} disabled={!isEditing} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cognome">Cognome</Label>
                <Input id="cognome" value={formData.cognome} onChange={handleChange} disabled={!isEditing} />
              </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="dataNascita">Data di Nascita</Label>
                <Input id="dataNascita" type="date" value={formData.dataNascita} onChange={handleChange} disabled={!isEditing} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
                <Input id="codiceFiscale" value={formData.codiceFiscale} onChange={handleChange} disabled={!isEditing} />
            </div>
             <div className="grid gap-2">
                <Label htmlFor="luogoNascita">Luogo di Nascita</Label>
                <Input id="luogoNascita" value={formData.luogoNascita} onChange={handleChange} disabled={!isEditing} />
            </div>
            
            <div className="relative space-y-4" ref={suggestionsRef}>
              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-3 grid gap-2">
                      <Label htmlFor="citta">Città</Label>
                      <Input id="citta" value={formData.citta} onChange={handleChange} disabled={!isEditing} autoComplete="off"/>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="provincia">Prov.</Label>
                      <Input id="provincia" value={formData.provincia} onChange={handleChange} disabled={!isEditing} />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="cap">CAP</Label>
                      <Input id="cap" value={formData.cap} onChange={handleChange} disabled={!isEditing} />
                  </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-4 grid gap-2">
                      <Label htmlFor="via">Via</Label>
                      <Input id="via" value={formData.via} onChange={handleChange} disabled={!isEditing} autoComplete="off" />
                  </div>
                  <div className="col-span-1 grid gap-2">
                      <Label htmlFor="numeroCivico">N.</Label>
                      <Input id="numeroCivico" value={formData.numeroCivico} onChange={handleChange} disabled={!isEditing} autoComplete="off" />
                  </div>
              </div>
              {isEditing && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-background border border-border rounded-md shadow-lg z-10">
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
                    <Input id="telefonoPrincipale" value={formData.telefonoPrincipale} onChange={handleChange} disabled={!isEditing} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="telefonoSecondario">Tel. Secondario</Label>
                    <Input id="telefonoSecondario" value={formData.telefonoSecondario} onChange={handleChange} disabled={!isEditing} />
                </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
             {error && <p className="text-sm text-destructive">{error}</p>}
             {success && <p className="text-sm text-green-600">{success}</p>}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        {isEditing ? (
            <div className="flex justify-end gap-2 w-full">
                <Button variant="outline" onClick={handleCancel}>Annulla</Button>
                <Button onClick={handleSave}>Salva</Button>
            </div>
        ) : (
            <Button onClick={() => { setIsEditing(true); setSuccess(null); }}>Modifica</Button>
        )}
      </CardFooter>
    </Card>
  );
}
