'use client';

import { Home } from 'lucide-react';
import TabCase from '../tab-case';

export default function CasePage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Home className="h-8 w-8 text-primary" />
          Case
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestione degli alloggi e delle case per tutti i campi
        </p>
      </div>
      <TabCase />
    </div>
  );
}
