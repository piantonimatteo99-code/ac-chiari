'use client'
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUserData } from "@/src/hooks/use-user-data";

export default function EducatoriPage() {
  const router = useRouter();
  const { userData: adminData, isLoading: isAdminDataLoading } = useUserData();

  const isUserAdmin = useMemo(() => adminData?.roles?.includes('admin'), [adminData]);

  useEffect(() => {
    if (!isAdminDataLoading && !isUserAdmin) {
      router.push('/dashboard');
    }
  }, [isAdminDataLoading, isUserAdmin, router]);

  if (isAdminDataLoading) {
    return <div className="flex items-center justify-center min-h-screen">Verifica permessi in corso...</div>;
  }
  
  if (!isUserAdmin) {
    // This will be shown briefly before redirection
    return <div className="flex items-center justify-center min-h-screen">Accesso non autorizzato. Reindirizzamento...</div>;
  }
  
  return (
    <div>
      <h1 className="text-2xl font-bold">Gestione Educatori</h1>
    </div>
  );
}
