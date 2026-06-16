'use client';

import { Suspense } from 'react';
import RsvpContent from './rsvp-content';

export default function RsvpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <p className="text-slate-500">Caricamento…</p>
      </div>
    }>
      <RsvpContent />
    </Suspense>
  );
}
