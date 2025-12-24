'use client';

import DatiUtenteCard from "@/src/components/dati-utente-card";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore } from "@/src/firebase";
import { useUserData } from "@/src/hooks/use-user-data";
import { collection, query, where, getDocs, setDoc, doc, writeBatch } from "firebase/firestore";
import { slugify } from "@/lib/utils";
import { useState } from "react";

export default function DashboardPage() {
  const { user } = useUser();
  const { userData } = useUserData();
  const firestore = useFirestore();
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);

  const handleDataMigration = async () => {
    if (!user || !userData || !firestore) {
      setMigrationMessage("Errore: Utente, dati utente o firestore non disponibili.");
      return;
    }

    if (!userData.via || !userData.citta || !userData.cap) {
      setMigrationMessage("Nessun indirizzo trovato nel tuo profilo. Aggiungine uno prima di sincronizzare.");
      return;
    }

    setMigrationMessage("Sincronizzazione in corso...");

    try {
      // Controlla se esiste già una famiglia per questo utente
      const famigliaQuery = query(collection(firestore, 'famiglie'), where('uidCapofamiglia', '==', user.uid));
      const famigliaSnapshot = await getDocs(famigliaQuery);

      if (!famigliaSnapshot.empty) {
        setMigrationMessage("La tua famiglia è già sincronizzata correttamente.");
        return;
      }

      // Se non esiste, crea la nuova famiglia basandoti sui dati utente
      const famigliaId = slugify(`${userData.via} ${userData.citta} ${userData.cap}`);
      const famigliaDocRef = doc(firestore, 'famiglie', famigliaId);

      const batch = writeBatch(firestore);

      // 1. Crea il documento famiglia
      batch.set(famigliaDocRef, {
        via: userData.via,
        numeroCivico: userData.numeroCivico,
        citta: userData.citta,
        provincia: userData.provincia,
        cap: userData.cap,
        uidCapofamiglia: user.uid,
        emailCapofamiglia: user.email,
      });

      setMigrationMessage("Documento famiglia creato. Ora la pagina 'Nucleo Familiare' dovrebbe funzionare.");
    
      await batch.commit();

    } catch (error: any) {
      console.error("Errore durante la migrazione dei dati:", error);
      setMigrationMessage(`Errore durante la migrazione: ${error.message}`);
    }
  };


  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

       <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle>Azione Richiesta: Sincronizzazione Dati</CardTitle>
          <CardDescription>
            Se riscontri un errore nella pagina &quot;Nucleo Familiare&quot;, potrebbe essere necessario sincronizzare i tuoi dati. Clicca il pulsante qui sotto per allineare la struttura del tuo nucleo familiare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDataMigration}>
            Sincronizza Dati Famiglia
          </Button>
          {migrationMessage && <p className="mt-4 text-sm text-muted-foreground">{migrationMessage}</p>}
        </CardContent>
      </Card>


       <div className="grid gap-4 md:grid-cols-1">
        <DatiUtenteCard />
      </div>
    </div>
  );
}

// Aggiungiamo i componenti Card mancanti che sono usati nel JSX sopra
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
