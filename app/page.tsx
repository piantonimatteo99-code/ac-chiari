'use client';
import { useEffect } from 'react';
import { useUser } from '@/src/firebase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) {
      return; // Attendi che il caricamento dell'utente sia completato
    }

    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  // Mostra un caricatore mentre useEffect decide dove reindirizzare
  return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
}
