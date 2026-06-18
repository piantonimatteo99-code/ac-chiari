import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging, initAdminApp } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getWebpush } from '@/lib/webpush';
import * as admin from 'firebase-admin';

/**
 * POST /api/send-notification
 *
 * Body:
 * {
 *   userId: string | '__broadcast__' | '__admin_broadcast__',
 *   title: string,
 *   body: string,
 *   type: 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback',
 *   href?: string,
 *   eventType?: string,  // used to filter by role when broadcasting
 * }
 */

type NotifRole = 'admin' | 'educatore' | 'genitore';

function userNotifRoles(roles: string[]): NotifRole[] {
  const out: NotifRole[] = [];
  if (roles.includes('admin')) out.push('admin');
  if (roles.includes('educatore')) out.push('educatore');
  if (roles.includes('genitore') || roles.includes('utente')) out.push('genitore');
  return out;
}

export async function POST(req: NextRequest) {
  try {
    initAdminApp();

    // ── 0. Autenticazione ──────────────────────────────────────────────────
    const authorizationHeader = req.headers.get('authorization');
    const idToken = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    let callerUid: string;
    let callerRoles: string[] = [];
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerUid = decoded.uid;
      // Recupera i ruoli dal documento utente
      const callerDoc = await adminDb.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        callerRoles = Array.isArray(callerDoc.data()?.roles) ? callerDoc.data()!.roles : [];
      }
    } catch {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }

    // ── 0.5 Read global system config for programming mode ─────────────────
    let isProgrammingMode = false;
    try {
      const systemConfig = await adminDb.collection('config').doc('sistema').get();
      if (systemConfig.exists) {
        isProgrammingMode = !!systemConfig.data()?.modalitaProgrammazione;
      }
    } catch (e) {
      console.warn('[send-notification] Could not read system config:', e);
    }

    const { userId, title, body, type, href, eventType } = await req.json();

    if (!userId || !title || !body || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Le modalità broadcast sono riservate agli admin
    if (
      (userId === '__broadcast__' || userId === '__admin_broadcast__') &&
      !callerRoles.includes('admin')
    ) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    // ── 1. Read per-role config if eventType is provided ──────────────────
    let enabledFor: { admin: boolean; educatore: boolean; genitore: boolean } | null = null;

    if (eventType && userId === '__broadcast__') {
      try {
        const configDoc = await adminDb.collection('notification-config').doc(eventType).get();
        if (configDoc.exists) {
          const data = configDoc.data()!;
          if (data.enabledFor) {
            enabledFor = data.enabledFor as { admin: boolean; educatore: boolean; genitore: boolean };
          } else if (typeof data.enabled === 'boolean') {
            // Legacy: single boolean → apply to all roles
            enabledFor = { admin: data.enabled, educatore: data.enabled, genitore: data.enabled };
          }
        }
      } catch (e) {
        console.warn('[send-notification] Could not read notification-config:', e);
      }
    }

    // ── 2. Collect target users ───────────────────────────────────────────
    let targetUserIds: string[] = [];

    if (userId === '__broadcast__') {
      const usersSnap = await adminDb.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userRoles: string[] = Array.isArray(userData.roles) ? userData.roles : [];

        // Se la modalità programmazione è attiva e la notifica è di tipo 'evento',
        // escludiamo gli utenti non-admin/non-educatore
        if (isProgrammingMode && type === 'evento') {
          const isAdminOrEducator = userRoles.includes('admin') || userRoles.includes('educatore');
          if (!isAdminOrEducator) continue;
        }

        if (enabledFor) {
          const notifRoles = userNotifRoles(userRoles);
          const shouldReceive = notifRoles.some(r => enabledFor![r]);
          if (!shouldReceive) continue;
        }
        targetUserIds.push(userDoc.id);
      }
    } else if (userId === '__admin_broadcast__') {
      const usersSnap = await adminDb.collection('users').where('roles', 'array-contains', 'admin').get();
      for (const userDoc of usersSnap.docs) {
        targetUserIds.push(userDoc.id);
      }
    } else {
      // Single user
      // Se la modalità programmazione è attiva e la notifica è di tipo 'evento',
      // verifichiamo che l'utente destinatario sia admin o educatore
      let shouldBlock = false;
      if (isProgrammingMode && type === 'evento') {
        try {
          const targetUserDoc = await adminDb.collection('users').doc(userId).get();
          if (targetUserDoc.exists) {
            const targetRoles: string[] = Array.isArray(targetUserDoc.data()?.roles) ? targetUserDoc.data()!.roles : [];
            const isAdminOrEducator = targetRoles.includes('admin') || targetRoles.includes('educatore');
            if (!isAdminOrEducator) {
              shouldBlock = true;
            }
          } else {
            shouldBlock = true;
          }
        } catch {
          shouldBlock = true;
        }
      }

      if (!shouldBlock) {
        targetUserIds.push(userId);
      }
    }

    if (targetUserIds.length === 0) {
       return NextResponse.json({ success: true, message: 'No eligible recipients found' });
    }

    // ── 3. Save to Firestore (In-App notifications) ──────────────────────
    const batches = [];
    let currBatch = adminDb.batch();
    let ops = 0;
    for (const uid of targetUserIds) {
      const notifRef = adminDb.collection('notifiche').doc();
      currBatch.set(notifRef, {
        userId: uid,
        title,
        body,
        type,
        href: href ?? null,
        letta: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      ops++;
      if (ops === 400) { // Limit chunk to safe < 500
        batches.push(currBatch.commit());
        currBatch = adminDb.batch();
        ops = 0;
      }
    }
    if (ops > 0) batches.push(currBatch.commit());
    await Promise.all(batches);

    // ── 4. Collect FCM Tokens & WebPush Subscriptions per user ─────────────
    const getCredentials = async (uid: string) => {
        const tokensSnap = await adminDb.collection('users').doc(uid).collection('fcmTokens').get();
        const fcmTokens = tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
        const wpSnap = await adminDb.collection('users').doc(uid).collection('webPushSubscriptions').get();
        const wpDocs = wpSnap.docs;
        // If user has a native WebPush subscription, prefer it over FCM to avoid duplicates
        const hasWebPush = wpDocs.length > 0;
        return { fcmTokens: hasWebPush ? [] : fcmTokens, wpDocs };
    };

    const credentialsResults = await Promise.all(targetUserIds.map(uid => getCredentials(uid)));
    const allFCMTokens = credentialsResults.flatMap(c => c.fcmTokens);
    const allWPDocs = credentialsResults.flatMap(c => c.wpDocs);

    // ── 5. Send NATIVE Web Push ─────────────────────────────────────────
    const wpPayload = JSON.stringify({ title, body, href: href || '/dashboard' });
    let wpSent = 0;
    if (allWPDocs.length > 0) {
        const wpResults = await Promise.allSettled(
          allWPDocs.map(async (docSnap) => {
            const { subscription } = docSnap.data();
            try {
              await getWebpush().sendNotification(subscription, wpPayload);
            } catch (err: any) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription expired/revoked
                await docSnap.ref.delete();
              }
              throw err;
            }
          })
        );
        wpSent = wpResults.filter(r => r.status === 'fulfilled').length;
    }

    // ── 6. Send FCM Push (only to users WITHOUT a WebPush subscription) ─
    let fcmSentCount = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < allFCMTokens.length; i += BATCH_SIZE) {
      const batch = allFCMTokens.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;
      try {
        const response = await adminMessaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: { href: href ?? '/dashboard', type },
          webpush: {
            notification: {
              icon: '/ac-logo.jpg',
              badge: '/ac-logo.jpg',
              requireInteraction: true,
            },
            fcmOptions: { link: href ?? '/dashboard' },
          },
        });
        fcmSentCount += response.successCount;
        const invalidCount = response.responses.filter(
          r => !r.success && (
            r.error?.code === 'messaging/registration-token-not-registered' ||
            r.error?.code === 'messaging/invalid-registration-token'
          )
        ).length;
        if (invalidCount > 0) console.warn('[send-notification] Invalid FCM tokens:', invalidCount);
      } catch (fcmError) {
        console.error('[send-notification] FCM send error:', fcmError);
      }
    }


    return NextResponse.json({
      success: true,
      recipients: targetUserIds.length,
      fcmSent: fcmSentCount,
      webPushSent: wpSent
    });

  } catch (error: any) {
    console.error('Error in /api/send-notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
