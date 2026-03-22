'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';

interface ConsensoAlertProps {
  /** IDs dei gruppi del progetto */
  groupIds: string[];
  /** 'foto' controlla consensoFoto, 'social' controlla consensoSocial */
  type: 'foto' | 'social';
}

/**
 * Mostra un alert con l'elenco dei ragazzi senza consenso
 * che appartengono ai gruppi del progetto.
 */
export function ConsensoAlert({ groupIds, type }: ConsensoAlertProps) {
  const firestore = useFirestore();

  // Query collectionGroup su tutti i 'membri' di tutte le famiglie
  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !groupIds || groupIds.length === 0) return null;
    // Firestore collectionGroup: prende tutti i documenti in qualsiasi
    // sotto-collezione chiamata 'membri'
    return query(collectionGroup(firestore, 'membri'));
  }, [firestore, groupIds]);

  const { data: tuttiMembri } = useCollection<Membro>(membriQuery);

  const senzaConsenso = useMemo(() => {
    if (!tuttiMembri || groupIds.length === 0) return [];
    const groupSet = new Set(groupIds);

    return tuttiMembri.filter(m => {
      // Deve appartenere a uno dei gruppi del progetto
      if (!m.groupId || !groupSet.has(m.groupId)) return false;
      // Deve NON avere il consenso richiesto
      if (type === 'foto') return !m.consensoFoto;
      if (type === 'social') return !m.consensoSocial;
      return false;
    });
  }, [tuttiMembri, groupIds, type]);

  if (senzaConsenso.length === 0) return null;

  const label = type === 'foto'
    ? 'senza autorizzazione foto'
    : 'senza autorizzazione social';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        {type === 'foto' ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <ShieldAlert className="h-4 w-4 shrink-0" />
        )}
        <p className="text-sm font-semibold">
          {senzaConsenso.length}{' '}
          {senzaConsenso.length === 1 ? 'ragazzo' : 'ragazzi'} {label}
        </p>
      </div>
      <p className="text-xs text-amber-600 dark:text-amber-500">
        {type === 'foto'
          ? 'Queste famiglie non hanno autorizzato la raccolta fotografica. Evita di scattare o conservare foto che li ritraggono.'
          : 'Queste famiglie non hanno autorizzato la pubblicazione sui social. Non pubblicare contenuti che li coinvolgono.'}
      </p>
      <ul className="space-y-1">
        {senzaConsenso.map(m => (
          <li key={m.id} className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-medium">{m.nome} {m.cognome}</span>
            {m.groupName && (
              <span className="text-amber-600 dark:text-amber-500">· {m.groupName}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-amber-500 italic pt-1">
        I consensi si aggiornano dalla sezione Nucleo Familiare → Modifica membro.
      </p>
    </div>
  );
}
