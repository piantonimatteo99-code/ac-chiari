'use client';
import { useUser } from '@/src/firebase';
import { redirect } from 'next/navigation';

export default function Home() {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  if (user) {
    return redirect('/dashboard');
  } else {
    return redirect('/login');
  }
}
