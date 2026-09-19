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
const EVENT_REMINDER_TYPES = new Set(['evento', 'evento_promemoria', 'evento_promemoria_sera', 'evento_promemoria_mezzogiorno']);

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    initAdminApp();

    const now = Date.now();

    // ── Calcola i cutoff come Firestore Timestamp ────────────────────────────
    const cutoffEventReminderRead = Timestamp.fromMillis(now - THRESHOLDS.eventReminderRead);
    const cutoffGenericRead       = Timestamp.fromMillis(now - THRESHOLDS.genericRead);
    const cutoffUnread            = Timestamp.fromMillis(now - THRESHOLDS.unread);

    let deleted = 0;
    const errors: string[] = [];

    // ── Helper: elimina un batch di DocumentReference ───────────────────────
    async function deleteDocs(refs: FirebaseFirestore.DocumentReference[]) {
      const BATCH_LIMIT = 400;
      for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
        const batch = adminDb.batch();
        refs.slice(i, i + BATCH_LIMIT).forEach(ref => batch.delete(ref));
        await batch.commit();
        deleted += Math.min(BATCH_LIMIT, refs.length - i);
      }
    }

    // ── 1. Promemoria evento già letti da più di 2 giorni ───────────────────
    try {
      const snap = await adminDb.collection('notifiche')
        .where('letta', '==', true)
        .where('type', '==', 'evento')
        .where('createdAt', '<=', cutoffEventReminderRead)
        .get();

      // Includi anche quelli con eventType esplicitamente promemoria
      const refs = snap.docs
        .filter(d => {
          const et: string | undefined = d.data().eventType;
          // Se eventType è presente, accettiamo solo i promemoria; se assente accettiamo tutti 'evento'
          return !et || EVENT_REMINDER_TYPES.has(et);
        })
        .map(d => d.ref);

      await deleteDocs(refs);
    } catch (e: any) {
      console.error('[cleanup-notifications] Step 1 error:', e);
      errors.push(`step1: ${e.message}`);
    }

    // ── 2. Notifiche già lette (qualsiasi tipo) da più di 7 giorni ──────────
    try {
      const snap = await adminDb.collection('notifiche')
        .where('letta', '==', true)
        .where('createdAt', '<=', cutoffGenericRead)
        .get();

      await deleteDocs(snap.docs.map(d => d.ref));
    } catch (e: any) {
      console.error('[cleanup-notifications] Step 2 error:', e);
      errors.push(`step2: ${e.message}`);
    }

    // ── 3. Notifiche non lette da più di 60 giorni ──────────────────────────
    try {
      const snap = await adminDb.collection('notifiche')
        .where('letta', '==', false)
        .where('createdAt', '<=', cutoffUnread)
        .get();

      await deleteDocs(snap.docs.map(d => d.ref));
    } catch (e: any) {
      console.error('[cleanup-notifications] Step 3 error:', e);
      errors.push(`step3: ${e.message}`);
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
