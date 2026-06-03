'use client';
import { useEffect } from 'react';
import { useUser } from '@/src/firebase';
import { useRouter } from 'next/navigation';
import { redirect } from 'next/navigation';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isUserLoading) return;
    if (user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  // Se l'utente non è loggato, mostra la homepage pubblica
  if (!isUserLoading && !user) {
    redirect('/home');
  }

  return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
}
