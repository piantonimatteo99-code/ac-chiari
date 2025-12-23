'use client';

import { Button } from "@/components/ui/button";
import { useFirestore, useUser } from "@/src/firebase";
import { doc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";

export default function DashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const handleBecomeAdmin = async () => {
    if (!user || !firestore) {
      alert("Utente o database non trovato.");
      return;
    }

    const userDocRef = doc(firestore, "users", user.uid);

    try {
      // Aggiorna il documento per rispecchiare la struttura dell'immagine
      await updateDoc(userDocRef, {
        displayName: user.email,
        role: "admin",
        roles: ["admin", "utente", "educatore"],
      });
      alert("Ruolo e displayName aggiornati con successo! Potrebbe essere necessario ricaricare la pagina per vedere le modifiche.");
    } catch (error) {
      console.error("Errore durante l'aggiornamento del ruolo:", error);
      alert("Si è verificato un errore durante l'aggiornamento del ruolo.");
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="mt-4">
        <Button onClick={handleBecomeAdmin} variant="destructive">
          (Temp) Diventa Admin
        </Button>
        <p className="text-sm text-muted-foreground mt-2">
          Questo pulsante serve solo per scopi di sviluppo.
        </p>
      </div>
    </div>
  );
}
