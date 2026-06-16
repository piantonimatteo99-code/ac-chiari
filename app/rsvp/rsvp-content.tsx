'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

type Stato = 'caricamento' | 'non-autenticato' | 'in-corso' | 'successo' | 'errore';

export default function RsvpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const eventId = searchParams.get('eventId');
  const response = searchParams.get('response') as 'presente' | 'assente' | null;

  const [stato, setStato] = useState<Stato>('caricamento');
  const [messaggio, setMessaggio] = useState('');

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) {
        setStato('non-autenticato');
        return;
      }

      if (!eventId || (response !== 'presente' && response !== 'assente')) {
        setStato('errore');
        setMessaggio('Parametri mancanti o non validi.');
        return;
      }

      setStato('in-corso');

      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ eventId, risposta: response }),
        });

        const data = await res.json();

        if (res.ok) {
          setStato('successo');
          setMessaggio(
            response === 'presente'
              ? 'Partecipazione confermata! A presto 🎉'
              : 'Assenza registrata. Ci mancherai! 👋'
          );
        } else {
          setStato('errore');
          setMessaggio(data.error ?? 'Errore durante la registrazione della risposta.');
        }
      } catch {
        setStato('errore');
        setMessaggio('Errore di rete. Riprova più tardi.');
      }
    });

    return () => unsubscribe();
  }, [eventId, response]);

  const emoji = stato === 'successo'
    ? (response === 'presente' ? '✅' : '👋')
    : stato === 'errore' ? '❌'
    : stato === 'non-autenticato' ? '🔒'
    : '⏳';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        {/* Icona */}
        <div className="text-5xl">{emoji}</div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {stato === 'caricamento' && 'Caricamento…'}
          {stato === 'non-autenticato' && 'Accesso richiesto'}
          {stato === 'in-corso' && 'Registrazione risposta…'}
          {stato === 'successo' && (response === 'presente' ? 'Ci sarò!' : 'Non ci sarò')}
          {stato === 'errore' && 'Errore'}
        </h1>

        {messaggio && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{messaggio}</p>
        )}

        {stato === 'non-autenticato' && (
          <button
            onClick={() =>
              router.push(
                `/login?redirect=${encodeURIComponent(`/rsvp?eventId=${eventId}&response=${response}`)}`
              )
            }
            className="mt-2 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg py-2 px-4 text-sm font-semibold hover:opacity-90 transition"
          >
            Accedi per confermare
          </button>
        )}

        {(stato === 'successo' || stato === 'errore') && (
          <button
            onClick={() => router.push('/calendario')}
            className="mt-2 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg py-2 px-4 text-sm font-semibold hover:opacity-90 transition"
          >
            Vai al calendario
          </button>
        )}
      </div>
    </div>
  );
}
