import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging, initAdminApp } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getWebpush } from '@/lib/webpush';

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

    // Helper function to parse long offset (e.g. GMT+02:00 or GMT-05:00) into minutes
    function parseOffset(tzName: string): number {
      if (tzName === 'GMT') return 0;
      const match = tzName.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
      if (!match) return 0;
      const sign = match[1] === '+' ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      return sign * (hours * 60 + minutes);
    }

    // Helper function to construct a UTC date that represents the given local components in Rome time
    function getRomeTimeInUTC(year: number, month: number, day: number, hours: number, minutes: number, seconds: number, ms: number = 0): Date {
      const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));
      const tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Rome',
        timeZoneName: 'longOffset'
      });
      const parts = tzFormatter.formatToParts(utcDate);
      const tzName = parts.find(p => p.type === 'timeZoneName')!.value;
      const offsetMinutes = parseOffset(tzName);
      return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
    }

    // Helper to get Rome current date components
    function getRomeCurrentDateComponents(): { year: number, month: number, day: number } {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      });
      const parts = formatter.formatToParts(new Date());
      const year = parseInt(parts.find(p => p.type === 'year')!.value);
      const month = parseInt(parts.find(p => p.type === 'month')!.value);
      const day = parseInt(parts.find(p => p.type === 'day')!.value);
      return { year, month, day };
    }

    let targetYear: number;
    let targetMonth: number;
    let targetDay: number;

    if (type === 'sera') {
      const todayComp = getRomeCurrentDateComponents();
      const todayUTC = new Date(Date.UTC(todayComp.year, todayComp.month - 1, todayComp.day));
      const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);
      targetYear = tomorrowUTC.getUTCFullYear();
      targetMonth = tomorrowUTC.getUTCMonth() + 1;
      targetDay = tomorrowUTC.getUTCDate();
    } else {
      const todayComp = getRomeCurrentDateComponents();
      targetYear = todayComp.year;
      targetMonth = todayComp.month;
      targetDay = todayComp.day;
    }

    const windowStart = getRomeTimeInUTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
    const windowEnd = getRomeTimeInUTC(targetYear, targetMonth, targetDay, 23, 59, 59, 999);

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
                await getWebpush().sendNotification(d.data().subscription, wpPayload);
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
