'use client';

import DatiUtenteCard from "@/src/components/dati-utente-card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>
       <div className="grid gap-4 md:grid-cols-1">
        <DatiUtenteCard />
      </div>
    </div>
  );
}
