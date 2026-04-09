'use client';

import { Tent, Bus } from 'lucide-react';
import TabPullman from '../tab-pullman';

export default function PullmanPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Bus className="h-8 w-8 text-primary" />
          Pullman
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestione delle aziende di trasporto e pullman per tutti i campi
        </p>
      </div>
      <TabPullman />
    </div>
  );
}
