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
import { useFirestore } from "@/src/firebase";
import { doc, updateDoc } from 'firebase/firestore';

export default function DatiUtenteCard() {
  const { userData, isLoading } = useUserData();
  const firestore = useFirestore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (userData) {
      const nameParts = userData.displayName?.split(' ') || ['', ''];
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
      setEmail(userData.email || '');
    }
  }, [userData]);

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
        displayName: `${firstName} ${lastName}`.trim(),
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
      const nameParts = userData.displayName?.split(' ') || ['', ''];
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' ') || '');
    }
    setIsEditing(false);
    setError(null);
    setSuccess(null);
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
            <div className="grid gap-2">
              <Label htmlFor="first-name">Nome</Label>
              <Input id="first-name" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={!isEditing} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="last-name">Cognome</Label>
              <Input id="last-name" value={lastName} onChange={e => setLastName(e.target.value)} disabled={!isEditing} />
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
