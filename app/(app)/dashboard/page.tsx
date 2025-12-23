'use client';

import { Button } from "@/components/ui/button";
import { useFirestore, useUser } from "@/src/firebase";
import { doc, setDoc } from "firebase/firestore";
import DatiUtenteCard from "@/src/components/dati-utente-card";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const handleRecreateEducatore = async () => {
    if (!user || !firestore) {
      alert("Utente o database non trovato.");
      return;
    }

    const userDocRef = doc(firestore, "users", user.uid);

    try {
      // Usa setDoc per creare o sovrascrivere il documento
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email,
        displayName: user.email,
        roles: ["utente", "educatore"],
      });
      alert("Documento utente ricreato/aggiornato con successo come educatore!");
    } catch (error) {
      console.error("Errore durante la creazione/aggiornamento del documento:", error);
      alert("Si è verificato un errore durante l'operazione.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div>
            <Button onClick={handleRecreateEducatore} variant="destructive">
              (Temp) Ricrea Utente Educatore
            </Button>
        </div>
      </div>
       <div className="grid gap-4 md:grid-cols-2">
        <DatiUtenteCard />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mt-2">
          Questo pulsante crea o sovrascrive il tuo documento utente con i permessi di educatore.
        </p>
      </div>
    </div>
  );
}
