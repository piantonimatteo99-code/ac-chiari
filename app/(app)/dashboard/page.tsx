'use client';

import { Button } from "@/components/ui/button";
import { useFirestore, useUser } from "@/src/firebase";
import { doc, setDoc } from "firebase/firestore";

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
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-4">
        <Button onClick={handleRecreateEducatore} variant="destructive">
          (Temp) Ricrea Utente Educatore
        </Button>
        <p className="text-sm text-muted-foreground mt-2">
          Questo pulsante crea o sovrascrive il tuo documento utente con i permessi di educatore.
        </p>
      </div>
    </div>
  );
}
