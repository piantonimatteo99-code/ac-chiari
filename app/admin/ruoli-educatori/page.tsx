'use client'
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/src/hooks/use-user-data";

export default function RuoliEducatoriPage() {
  const router = useRouter();
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();
  const isUserAdmin = useMemo(() => adminData?.roles?.includes('admin'), [adminData]);

  useEffect(() => {
    // Esegui il reindirizzamento solo quando il caricamento è terminato e l'utente non è admin.
    if (!isAdminDataLoading && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isAdminDataLoading, isUserAdmin, router]);

  // Mostra lo stato di caricamento finché i dati non sono pronti.
  // Questo previene il rendering del contenuto della pagina o di un messaggio di errore prima della verifica.
  if (isAdminDataLoading || !isUserAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Verifica permessi in corso...</div>;
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold">Gestione Ruoli Educatori</h1>
      <p>Questa pagina è dedicata alla gestione dei ruoli degli educatori.</p>
    </div>
  );
}
