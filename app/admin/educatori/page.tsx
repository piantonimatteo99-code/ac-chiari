'use client'
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/src/hooks/use-user-data";

export default function EducatoriPage() {
  const router = useRouter();
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();

  const isUserAdmin = useMemo(() => adminData?.roles?.includes('admin'), [adminData]);

  useEffect(() => {
    // Reindirizza solo quando il caricamento è finito e l'utente non è admin.
    if (!isAdminDataLoading && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isAdminDataLoading, isUserAdmin, router]);

  // Mostra lo stato di caricamento finché i dati non sono pronti o se l'utente non è admin.
  // Questo previene il rendering prematuro del contenuto della pagina.
  if (isAdminDataLoading || !isUserAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Verifica permessi in corso...</div>;
  }
  
  // Se sei qui, il caricamento è finito E sei un admin.
  return (
    <div>
      <h1 className="text-2xl font-bold">Gestione Educatori</h1>
    </div>
  );
}
