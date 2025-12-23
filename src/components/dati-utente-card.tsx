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

export default function DatiUtenteCard() {
  const { userData, isLoading } = useUserData();
  const firestore = useFirestore();
  const [formData, setFormData] = useState(initialState);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (userData) {
      setFormData({
        nome: userData.nome || '',
        cognome: userData.cognome || '',
        dataNascita: userData.dataNascita || '',
        codiceFiscale: userData.codiceFiscale || '',
        luogoNascita: userData.luogoNascita || '',
        indirizzo: userData.indirizzo || '',
        telefonoPrincipale: userData.telefonoPrincipale || '',
        telefonoSecondario: userData.telefonoSecondario || '',
      });
      setEmail(userData.email || '');
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
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
        indirizzo: userData.indirizzo || '',
        telefonoPrincipale: userData.telefonoPrincipale || '',
        telefonoSecondario: userData.telefonoSecondario || '',
      });
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
             <div className="grid gap-2">
                <Label htmlFor="indirizzo">Indirizzo</Label>
                <Input id="indirizzo" value={formData.indirizzo} onChange={handleChange} disabled={!isEditing} />
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
