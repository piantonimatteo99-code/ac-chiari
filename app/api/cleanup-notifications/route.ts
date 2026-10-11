import { NextRequest, NextResponse } from 'next/server';
import { adminDb, initAdminApp } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cleanup-notifications
 *
 * Cron job notturno che rimuove le notifiche obsolete dalla collezione `notifiche`.
 * Riduce il numero di documenti in Firestore, abbassando i costi di lettura (listener
 * real-time) e di storage.
 *
 * Regole di eliminazione (in ordine di priorità):
 *  1. Promemoria evento (tipo 'evento') già letti  → eliminati dopo 2 giorni
 *  2. Qualsiasi notifica già letta                 → eliminata dopo 7 giorni
 *  3. Qualsiasi notifica non letta                 → eliminata dopo 60 giorni
 *
 * Autenticazione: header "Authorization: Bearer <CRON_SECRET>"
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const THRESHOLDS = {
  /** Promemoria evento già letti: conservati 2 giorni */
  eventReminderRead: 2 * MS_PER_DAY,
  /** Notifiche generali già lette: conservate 7 giorni */
  genericRead: 7 * MS_PER_DAY,
  /** Notifiche non lette: conservate 60 giorni (poi probabilmente non verranno mai lette) */
  unread: 60 * MS_PER_DAY,
} as const;

/** Tipi di notifica considerati "promemoria evento" — scadono prima */
const EVENT_REMINDER_TYPES = new Set([
  'evento',
  'evento_promemoria',
  'evento_promemoria_sera',
  'evento_promemoria_mezzogiorno',
]);

/** Elimina un array di DocumentReference in batch da 400 */
async function deleteDocs(refs: FirebaseFirestore.DocumentReference[]): Promise<number> {
  const BATCH_LIMIT = 400;
  let deleted = 0;
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    const chunk = refs.slice(i, i + BATCH_LIMIT);
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    initAdminApp();

    const now = Date.now();

    // ── Calcola i cutoff come millisecondi ───────────────────────────────────
    const cutoffEventReminderRead = Timestamp.fromMillis(now - THRESHOLDS.eventReminderRead);
    const cutoffGenericReadMs     = now - THRESHOLDS.genericRead;
    const cutoffUnreadMs          = now - THRESHOLDS.unread;

    let deleted = 0;
    const errors: string[] = [];

    // ── Query senza indici compositi ─────────────────────────────────────────
    // Usiamo un solo filtro `createdAt <= cutoffEventReminderRead` (2 giorni fa).
    // Questo usa l'indice automatico predefinito di Firestore per singolo campo,
    // garantendo l'esecuzione affidabile senza richiedere indici compositi manuali.
    try {
      const snap = await adminDb.collection('notifiche')
        .where('createdAt', '<=', cutoffEventReminderRead)
        .get();

      const refsToDelete: FirebaseFirestore.DocumentReference[] = [];

      snap.docs.forEach(d => {
        const data = d.data();
        const createdMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
        if (!createdMs) return;

        const isLetta = data.letta === true;
        const type = data.type || '';
        const eventType = data.eventType;

        // Regola 1: Notifiche non lette più vecchie di 60 giorni
        if (!isLetta && createdMs <= cutoffUnreadMs) {
          refsToDelete.push(d.ref);
          return;
        }

        // Regola 2: Notifiche lette generiche più vecchie di 7 giorni
        if (isLetta && createdMs <= cutoffGenericReadMs) {
          refsToDelete.push(d.ref);
          return;
        }

        // Regola 3: Promemoria evento già letti più vecchi di 2 giorni
        if (isLetta && (type === 'evento' || EVENT_REMINDER_TYPES.has(eventType || type))) {
          refsToDelete.push(d.ref);
          return;
        }
      });

      if (refsToDelete.length > 0) {
        deleted = await deleteDocs(refsToDelete);
      }
    } catch (e: any) {
      console.error('[cleanup-notifications] Error during cleanup:', e);
      errors.push(e.message);
    }

    console.log(`[cleanup-notifications] Done. Deleted: ${deleted}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: true,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      ranAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[cleanup-notifications] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
