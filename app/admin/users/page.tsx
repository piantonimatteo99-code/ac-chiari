'use client';

import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserData } from '@/src/hooks/use-user-data';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UsersPage() {
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
  
  return (
     <div className="flex flex-col gap-4">
      <Card>
         <CardHeader>
          <CardTitle>Anagrafe Utenti e Familiari</CardTitle>
          <CardDescription>
            Questa tabella mostra sia gli utenti registrati al sistema sia i membri dei nuclei familiari. Pagina in costruzione.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Qui verrà visualizzata la tabella con l'anagrafe completa.</p>
        </CardContent>
      </Card>
    </div>
  );
}
