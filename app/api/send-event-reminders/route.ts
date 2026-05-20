import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging, initAdminApp } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.WEBPUSH_SUBJECT!,
  process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!,
  process.env.WEBPUSH_PRIVATE_KEY!
);

/**
 * GET  /api/send-event-reminders?type=sera|mezzogiorno
 * POST /api/send-event-reminders  { type: 'sera'|'mezzogiorno', secret: string }
 *
 * Viene chiamata da un cron job Vercel (GET, ore 20:00 e 12:00).
 * Trova gli eventi della finestra temporale corretta e invia un
 * promemoria agli utenti che non l'hanno disattivato nelle preferenze.
 *
 * Autenticazione:
 *  - GET:  header "Authorization: Bearer <CRON_SECRET>" (aggiunto da vercel.json)
 *  - POST: body.secret === CRON_SECRET
 */

/** Shared logic — called by both GET and POST handlers */
async function handleReminder(type: string, secret: string | null) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (type !== 'sera' && type !== 'mezzogiorno') {
    return NextResponse.json({ error: 'type must be "sera" or "mezzogiorno"' }, { status: 400 });
  }

  return null; // auth passed, proceed
}

/** GET handler — used by Vercel cron (no body support) */
export async function GET(req: NextRequest) {
  try {
    initAdminApp();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? '';
    // Vercel sends the secret via the Authorization header: "Bearer <CRON_SECRET>"
    const authHeader = req.headers.get('authorization') ?? '';
    const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : searchParams.get('secret');

    const authError = await handleReminder(type, secret);
    if (authError) return authError;

    return await processReminders(type as 'sera' | 'mezzogiorno');
  } catch (error: any) {
    console.error('[send-event-reminders] GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST handler — for manual testing / non-Vercel callers */
export async function POST(req: NextRequest) {
  try {
    initAdminApp();

    const { type, secret } = await req.json();

    const authError = await handleReminder(type ?? '', secret ?? null);
    if (authError) return authError;

    return await processReminders(type as 'sera' | 'mezzogiorno');
  } catch (error: any) {
    console.error('[send-event-reminders] POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Core reminder logic shared by GET and POST */
async function processReminders(type: 'sera' | 'mezzogiorno'): Promise<NextResponse> {
    const eventTypeId = type === 'sera'
      ? 'evento_promemoria_sera'
      : 'evento_promemoria_mezzogiorno';

    const now = new Date();

    // Calcola la finestra di eventi da cercare
    let windowStart: Date;
    let windowEnd: Date;

    if (type === 'sera') {
      // Sera: cerca eventi che iniziano domani (il giorno dopo)
      windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + 1);
      windowStart.setHours(0, 0, 0, 0);
      windowEnd = new Date(windowStart);
      windowEnd.setHours(23, 59, 59, 999);
    } else {
      // Mezzogiorno: cerca eventi che iniziano oggi
      windowStart = new Date(now);
      windowStart.setHours(0, 0, 0, 0);
      windowEnd = new Date(now);
      windowEnd.setHours(23, 59, 59, 999);
    }

    // ── Trova eventi nella finestra ──────────────────────────────────────────
    const eventiSnap = await adminDb.collection('eventi')
      .where('startDate', '>=', Timestamp.fromDate(windowStart))
      .where('startDate', '<=', Timestamp.fromDate(windowEnd))
      .get();

    if (eventiSnap.empty) {
      return NextResponse.json({ success: true, message: 'Nessun evento trovato per la finestra', sent: 0 });
    }

    // ── Per ogni evento, recupera i gruppi e gli utenti ────────────────────
    let totalSent = 0;

    for (const eventoDoc of eventiSnap.docs) {
      const evento = eventoDoc.data() as any;
      const eventoTitolo: string = evento.title ?? evento.nome ?? 'Evento';
      const eventoStart: Timestamp = evento.startDate;
      const groupIds: string[] = Array.isArray(evento.groupIds)
        ? evento.groupIds
        : evento.groupId
        ? [evento.groupId]
        : [];

      if (groupIds.length === 0) continue;

      // Formatta data/ora per il messaggio
      const eventoDate = eventoStart.toDate();
      const timeStr = eventoDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const dateStr = eventoDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

      const title = type === 'sera'
        ? `🌙 Domani: ${eventoTitolo}`
        : `☀️ Oggi: ${eventoTitolo}`;

      const body = type === 'sera'
        ? `Promemoria: domani, ${dateStr} alle ${timeStr}.`
        : `L'evento inizia oggi alle ${timeStr}. Non dimenticare!`;

      // Trova tutti gli utenti che appartengono a questi gruppi
      const targetUids = new Set<string>();

      for (const gid of groupIds) {
        // Membri del gruppo (subcollection membri)
        const membriSnap = await adminDb.collection('gruppi').doc(gid).collection('membri').get();
        membriSnap.docs.forEach(m => {
          const uid = m.data().userId ?? m.id;
          if (uid) targetUids.add(uid);
        });

        // Educatori del gruppo
        const gruppoDoc = await adminDb.collection('gruppi').doc(gid).get();
        if (gruppoDoc.exists) {
          const educatorIds: string[] = Array.isArray(gruppoDoc.data()?.educatorIds)
            ? gruppoDoc.data()!.educatorIds
            : [];
          educatorIds.forEach(uid => targetUids.add(uid));
        }
      }

      if (targetUids.size === 0) continue;

      // Filtra utenti che hanno disabilitato questo tipo di promemoria
      const eligibleUids: string[] = [];
      for (const uid of Array.from(targetUids)) {
        const prefDoc = await adminDb
          .collection('users').doc(uid)
          .collection('notificationPreferences').doc(eventTypeId)
          .get();

        // Se il documento non esiste → usa default (true = abilitato)
        const enabled = prefDoc.exists ? (prefDoc.data()?.enabled ?? true) : true;
        if (enabled) eligibleUids.push(uid);
      }

      if (eligibleUids.length === 0) continue;

      // Salva notifiche in-app
      const batches: Promise<any>[] = [];
      let currBatch = adminDb.batch();
      let ops = 0;
      for (const uid of eligibleUids) {
        const notifRef = adminDb.collection('notifiche').doc();
        currBatch.set(notifRef, {
          userId: uid,
          title,
          body,
          type: 'evento',
          href: '/calendario',
          letta: false,
          createdAt: FieldValue.serverTimestamp(),
          eventType: eventTypeId,
        });
        ops++;
        if (ops === 400) {
          batches.push(currBatch.commit());
          currBatch = adminDb.batch();
          ops = 0;
        }
      }
      if (ops > 0) batches.push(currBatch.commit());
      await Promise.all(batches);

      // Invio push
      const wpPayload = JSON.stringify({ title, body, href: '/calendario' });

      for (const uid of eligibleUids) {
        // WebPush
        const wpSnap = await adminDb.collection('users').doc(uid).collection('webPushSubscriptions').get();
        const hasWebPush = wpSnap.size > 0;

        if (hasWebPush) {
          await Promise.allSettled(
            wpSnap.docs.map(async d => {
              try {
                await webpush.sendNotification(d.data().subscription, wpPayload);
                totalSent++;
              } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) await d.ref.delete();
              }
            })
          );
        } else {
          // FCM
          const tokensSnap = await adminDb.collection('users').doc(uid).collection('fcmTokens').get();
          const tokens = tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
          if (tokens.length > 0) {
            try {
              const res = await adminMessaging.sendEachForMulticast({
                tokens,
                notification: { title, body },
                data: { href: '/calendario', type: 'evento' },
                webpush: {
                  notification: { icon: '/ac-logo.jpg', badge: '/ac-logo.jpg', requireInteraction: true },
                  fcmOptions: { link: '/calendario' },
                },
              });
              totalSent += res.successCount;
            } catch (e) {
              console.error('[reminders] FCM error for uid', uid, e);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, type, sent: totalSent });
}
