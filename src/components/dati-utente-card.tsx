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
import { doc, updateDoc, setDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { slugify } from '@/lib/utils';


const initialAnagraficaState = {
  nome: '',
  cognome: '',
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

export default function DatiUtenteCard() {
  const { userData, isLoading: isUserLoading } = useUserData();
  const firestore = useFirestore();
  const { user } = useUser();
  const [formData, setFormData] = useState(initialAnagraficaState);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (userData) {
      setFormData({
          nome: userData.nome || '',
          cognome: userData.cognome || '',
          via: userData.via || '',
          numeroCivico: userData.numeroCivico || '',
          citta: userData.citta || '',
          provincia: userData.provincia || '',
          cap: userData.cap || '',
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
    if (!user || !firestore) {
      setError("Dati utente o database non trovati.");
      return;
    }
    setError(null);
    setSuccess(null);

    const { nome, cognome, ...anagraficaData } = formData;

    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await updateDoc(userDocRef, {
        nome,
        cognome,
        displayName: `${nome} ${cognome}`.trim(),
        ...anagraficaData,
      });

      const famigliaQuery = query(collection(firestore, 'famiglie'), where('uidCapofamiglia', '==', user.uid));
      const famigliaSnapshot = await getDocs(famigliaQuery);

      if (!famigliaSnapshot.empty) {
        const famigliaDoc = famigliaSnapshot.docs[0];
        // Family exists, just update it with the latest address data.
        await updateDoc(doc(firestore, 'famiglie', famigliaDoc.id), {
            ...anagraficaData,
            updatedAt: serverTimestamp(),
        });
      } else if (anagraficaData.via && anagraficaData.citta && anagraficaData.cap) {
        // No family exists for this user, but we have address data, so create one.
        // The ID is based on the new address.
        const newFamigliaId = slugify(`${anagraficaData.via} ${anagraficaData.citta} ${anagraficaData.cap}`);
        await setDoc(doc(firestore, 'famiglie', newFamigliaId), {
            ...anagraficaData,
            uidCapofamiglia: user.uid,
            emailCapofamiglia: user.email,
            updatedAt: serverTimestamp(),
        });
      }

      setSuccess("Dati aggiornati con successo!");
       setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Errore durante l'aggiornamento dei dati:", err);
      setError("Si è verificato un errore durante l'aggiornamento.");
    }
  };
  
  const isLoading = isUserLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Dati e Residenza</CardTitle>
        <CardDescription>
          Modifica i tuoi dati. L'indirizzo di residenza è condiviso con tutto il tuo nucleo familiare.
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

            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-medium">Indirizzo del Nucleo Familiare (Condiviso)</p>
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
