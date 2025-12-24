'use client';

import { useState, useEffect } from 'react';
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
import { useFirestore, useUser } from "@/src/firebase";
import { doc, updateDoc } from 'firebase/firestore';

const initialState = {
  nome: '',
  cognome: '',
};

const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
};

export default function DatiUtenteCard() {
  const { userData, isLoading: isUserLoading } = useUserData();
  const firestore = useFirestore();
  const { user } = useUser();
  const [formData, setFormData] = useState(initialState);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (userData) {
      setFormData({
          nome: userData.nome || '',
          cognome: userData.cognome || '',
      });
      setEmail(userData.email || '');
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let formattedValue = value;

    switch (id) {
        case 'nome':
        case 'cognome':
            formattedValue = capitalizeWords(value);
            break;
        default:
            break;
    }
    
    setFormData((prev) => ({ ...prev, [id]: formattedValue }));
  };

  const handleSave = async () => {
    if (!user || !firestore) {
      setError("Dati utente o database non trovati.");
      return;
    }
    setError(null);
    setSuccess(null);

    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        ...formData,
        displayName: `${formData.nome} ${formData.cognome}`.trim(),
      });
      setSuccess("Dati aggiornati con successo!");
       setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Si è verificato un errore durante l'aggiornamento.");
    }
  };
  
  const isLoading = isUserLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Dati</CardTitle>
        <CardDescription>
          Modifica i tuoi dati personali. Questi dati sono associati al tuo account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>Caricamento dati...</p>
        ) : (
          <div className="space-y-4">
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
              <Label htmlFor="email">Email (non modificabile)</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
             {error && <p className="text-sm text-destructive">{error}</p>}
             {success && <p className="text-sm text-green-600">{success}</p>}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4 flex justify-end">
         <Button onClick={handleSave} disabled={isLoading}>Salva</Button>
      </CardFooter>
    </Card>
  );
}
