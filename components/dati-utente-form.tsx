'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useUserData } from '@/src/hooks/use-user-data';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';
import { useFirestore, useUser } from '@/src/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from './ui/use-toast';

const capitalizeWords = (str: string) => {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
};

export default function DatiUtenteForm() {
  const { userData, isLoading: isUserLoading, error } = useUserData();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    via: '',
    numeroCivico: '',
    citta: '',
    provincia: '',
    cap: '',
  });
  const [isSaving, setIsSaving] = useState(false);

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
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    let formattedValue = value;

    switch (id) {
        case 'provincia':
            formattedValue = value.toUpperCase();
            break;
        case 'nome':
        case 'cognome':
        case 'citta':
        case 'via':
            formattedValue = capitalizeWords(value);
            break;
        default:
            // Prima lettera maiuscola per gli altri campi (es. numeroCivico, cap)
            break;
    }
    setFormData(prev => ({ ...prev, [id]: formattedValue }));
  };

  const handleSave = async () => {
     if (!firestore || !user) {
        toast({
            variant: "destructive",
            title: "Errore",
            description: "Utente o database non disponibile.",
        });
        return;
    }
    if (!formData.via || !formData.citta || !formData.cap) {
        toast({
            variant: "destructive",
            title: "Errore",
            description: "L'indirizzo (via, città, CAP) è obbligatorio.",
        });
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        // 1. Update the user document
        const userDocRef = doc(firestore, 'users', user.uid);
        const userPayload = {
            nome: formData.nome,
            cognome: formData.cognome,
            displayName: `${formData.nome} ${formData.cognome}`,
            via: formData.via,
            numeroCivico: formData.numeroCivico,
            citta: formData.citta,
            provincia: formData.provincia,
            cap: formData.cap,
        };
        batch.update(userDocRef, userPayload);
        
        // 2. Update or create the shared family document
        const famigliaDocRef = doc(firestore, 'famiglie', user.uid);
        const famigliaPayload = {
            uidCapofamiglia: user.uid,
            emailCapofamiglia: user.email,
            via: formData.via,
            numeroCivico: formData.numeroCivico,
            citta: formData.citta,
            provincia: formData.provincia,
            cap: formData.cap,
            updatedAt: serverTimestamp(),
        };
        batch.set(famigliaDocRef, famigliaPayload, { merge: true });

        await batch.commit();

    } catch (err) {
        console.error(err);
         toast({
            variant: "destructive",
            title: "Errore",
            description: "Si è verificato un errore durante il salvataggio.",
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isUserLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>I Miei Dati e Residenza</CardTitle>
          <CardDescription>
            Modifica i tuoi dati. L'indirizzo di residenza è condiviso con tutto il tuo nucleo familiare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Caricamento dati utente...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>I Miei Dati e Residenza</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Si è verificato un errore nel caricamento dei dati.</p>
        </CardContent>
      </Card>
    );
  }

  if (!userData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>I Miei Dati e Residenza</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Nessun dato utente trovato.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Miei Dati e Residenza</CardTitle>
        <CardDescription>
          Modifica i tuoi dati. L'indirizzo di residenza è condiviso con tutto il tuo nucleo familiare.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={formData.nome} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cognome">Cognome</Label>
              <Input id="cognome" value={formData.cognome} onChange={handleChange} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (non modificabile)</Label>
            <Input id="email" defaultValue={userData.email} disabled />
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="font-medium">Indirizzo del Nucleo Familiare (Condiviso)</h4>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-2 md:col-span-3">
              <Label htmlFor="citta">Città</Label>
              <Input id="citta" value={formData.citta} onChange={handleChange} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="provincia">Prov.</Label>
              <Input id="provincia" value={formData.provincia} onChange={handleChange} maxLength={2} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cap">CAP</Label>
              <Input id="cap" value={formData.cap} onChange={handleChange} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-2 md:col-span-5">
              <Label htmlFor="via">Via</Label>
              <Input id="via" value={formData.via} onChange={handleChange} />
            </div>
            <div className="space-y-2 md:col-span-1">
              <Label htmlFor="numeroCivico">N.</Label>
              <Input id="numeroCivico" value={formData.numeroCivico} onChange={handleChange} />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvataggio...' : 'Salva'}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
