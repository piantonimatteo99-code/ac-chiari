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
  via: '',
  numeroCivico: '',
  citta: '',
  provincia: '',
  cap: '',
  telefonoPrincipale: '',
  telefonoSecondario: '',
};

const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
};

export default function DatiUtenteCard() {
  const { userData, isLoading } = useUserData();
  const firestore = useFirestore();
  const [formData, setFormData] = useState(initialState);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let formattedValue = value;

    switch (id) {
        case 'codiceFiscale':
            formattedValue = value.toUpperCase();
            break;
        case 'nome':
        case 'cognome':
        case 'luogoNascita':
        case 'citta':
        case 'via':
            formattedValue = capitalizeWords(value);
            break;
        case 'provincia':
             formattedValue = value.toUpperCase();
             break;
        default:
            break;
    }
    
    setFormData((prev) => ({ ...prev, [id]: formattedValue }));
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
       setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Si è verificato un errore durante l'aggiornamento.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Dati</CardTitle>
        <CardDescription>
          Visualizza e modifica le tue informazioni personali.
          L'indirizzo di residenza è condiviso con tutto il tuo nucleo familiare.
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
            
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground pt-2">Indirizzo di Residenza</p>
              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-3 grid gap-2">
                      <Label htmlFor="citta">Città</Label>
                      <Input id="citta" value={formData.citta} onChange={handleChange} autoComplete="off"/>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="provincia">Prov.</Label>
                      <Input id="provincia" value={formData.provincia} onChange={handleChange} maxLength={2} />
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="cap">CAP</Label>
                      <Input id="cap" value={formData.cap} onChange={handleChange} />
                  </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                  <div className="col-span-4 grid gap-2">
                      <Label htmlFor="via">Via</Label>
                      <Input id="via" value={formData.via} onChange={handleChange} autoComplete="off" />
                  </div>
                  <div className="col-span-1 grid gap-2">
                      <Label htmlFor="numeroCivico">N.</Label>
                      <Input id="numeroCivico" value={formData.numeroCivico} onChange={handleChange} autoComplete="off" />
                  </div>
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
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
             {error && <p className="text-sm text-destructive">{error}</p>}
             {success && <p className="text-sm text-green-600">{success}</p>}
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t px-6 py-4 flex justify-end">
        <Button onClick={handleSave}>Salva Modifiche</Button>
      </CardFooter>
    </Card>
  );
}
