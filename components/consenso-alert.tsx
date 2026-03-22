'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collectionGroup, query } from 'firebase/firestore';
import { ShieldAlert } from 'lucide-react';
import type { Membro } from '@/app/(app)/nucleo-familiare/page';

interface ConsensoAlertProps {
  /** IDs dei gruppi del progetto */
  groupIds: string[];
  /** Usato solo per compatibilità — il consenso è ora unificato */
  type?: 'foto' | 'social';
}

/**
 * Mostra un alert con l'elenco dei ragazzi che NON hanno
 * il consenso a foto e pubblicazione sui social.
 * Il campo `consenso` è unificato: false = nessun consenso.
 * Backward compat: legge anche i vecchi campi consensoFoto / consensoSocial.
 */
export function ConsensoAlert({ groupIds }: ConsensoAlertProps) {
  const firestore = useFirestore();

  const membriQuery = useMemoFirebase(() => {
    if (!firestore || !groupIds || groupIds.length === 0) return null;
    return query(collectionGroup(firestore, 'membri'));
  }, [firestore, groupIds]);

  const { data: tuttiMembri } = useCollection<Membro>(membriQuery);

  const senzaConsenso = useMemo(() => {
    if (!tuttiMembri || groupIds.length === 0) return [];
    const groupSet = new Set(groupIds);

    return tuttiMembri.filter(m => {
      // Deve appartenere a uno dei gruppi del progetto
      if (!m.groupId || !groupSet.has(m.groupId)) return false;

      // Campo unificato nuovo: consenso === false significa revocato
      if (typeof m.consenso === 'boolean') return !m.consenso;

      // Backward compat: se esistevano i vecchi campi separati
      if (typeof m.consensoFoto === 'boolean' || typeof m.consensoSocial === 'boolean') {
        return !m.consensoFoto || !m.consensoSocial;
      }

      // Se non è mai stato registrato il campo → ha il consenso (default true)
      return false;
    });
  }, [tuttiMembri, groupIds]);

  if (senzaConsenso.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-2">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">
          {senzaConsenso.length}{' '}
          {senzaConsenso.length === 1 ? 'ragazzo' : 'ragazzi'} senza consenso per foto e social
        </p>
      </div>
      <p className="text-xs text-amber-600 dark:text-amber-500">
        Queste famiglie non hanno autorizzato la pubblicazione di foto e contenuti sui social.
        Evita di scattare o pubblicare immagini che li ritraggono.
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
        Il consenso si gestisce da Nucleo Familiare → Modifica membro.
      </p>
    </div>
  );
}
