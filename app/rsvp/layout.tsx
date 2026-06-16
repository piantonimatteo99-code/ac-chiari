import { Suspense } from 'react';
import RsvpPage from './page';

export const metadata = {
  title: 'Conferma partecipazione — AC Chiari',
};

export default function RsvpLayout() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Caricamento…</p>
      </div>
    }>
      <RsvpPage />
    </Suspense>
  );
}
