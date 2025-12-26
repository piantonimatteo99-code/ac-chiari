'use client'
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/src/hooks/use-user-data";

export default function EducatoriPage() {
  const router = useRouter();
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();

  const isUserAdmin = useMemo(() => adminData?.roles?.includes('admin'), [adminData]);

  useEffect(() => {
    // Attendi il caricamento, poi controlla.
    // Se il caricamento è finito e l'utente NON è admin, reindirizza.
    if (!isAdminDataLoading && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isAdminDataLoading, isUserAdmin, router]);

  // Mostra il caricamento finché i dati non sono pronti O se non si è admin (in attesa del redirect)
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
