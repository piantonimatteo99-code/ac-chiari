'use client';

import DatiUtenteForm from '@/components/dati-utente-form';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
      <DatiUtenteForm />
    </div>
  );
}
