import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging, initAdminApp } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import webpush from 'web-push';
import * as admin from 'firebase-admin';

webpush.setVapidDetails(
  process.env.WEBPUSH_SUBJECT!,
  process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!,
  process.env.WEBPUSH_PRIVATE_KEY!
);

/**
 * POST /api/send-custom-notification
 *
 * Invia una notifica personalizzata dall'admin con target flessibile.
 *
 * Body:
 * {
 *   title: string,
 *   body: string,
 *   href?: string,
 *   target: 'all' | 'admin' | 'educatore' | 'utente' | 'specific',
 *   userIds?: string[],   // solo quando target === 'specific'
 * }
 */

export async function POST(req: NextRequest) {
  try {
    initAdminApp();

    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    let callerUid: string;
    let callerRoles: string[] = [];
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerUid = decoded.uid;
      const callerDoc = await adminDb.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        callerRoles = Array.isArray(callerDoc.data()?.roles) ? callerDoc.data()!.roles : [];
      }
    } catch {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }

    if (!callerRoles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono inviare notifiche personalizzate' }, { status: 403 });
    }

    const { title, body, href, target, userIds } = await req.json();

    if (!title || !body || !target) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti: title, body, target' }, { status: 400 });
    }

    // ── Raccolta utenti target ───────────────────────────────────────────────
    let targetUserIds: string[] = [];

    if (target === 'specific') {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return NextResponse.json({ error: 'Specifica almeno un utente' }, { status: 400 });
      }
      targetUserIds = userIds as string[];
    } else {
      const usersSnap = await adminDb.collection('users').get();
      for (const userDoc of usersSnap.docs) {
        const roles: string[] = Array.isArray(userDoc.data()?.roles) ? userDoc.data()!.roles : [];
        if (target === 'all') {
          targetUserIds.push(userDoc.id);
        } else if (target === 'admin' && roles.includes('admin')) {
          targetUserIds.push(userDoc.id);
        } else if (target === 'educatore' && roles.includes('educatore')) {
          targetUserIds.push(userDoc.id);
        } else if (target === 'utente' && (roles.includes('utente') || roles.includes('genitore'))) {
          targetUserIds.push(userDoc.id);
        }
      }
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({ success: true, message: 'Nessun destinatario trovato', recipients: 0 });
    }

    // ── Salva notifiche in Firestore ─────────────────────────────────────────
    const batches: Promise<any>[] = [];
    let currBatch = adminDb.batch();
    let ops = 0;
    for (const uid of targetUserIds) {
      const notifRef = adminDb.collection('notifiche').doc();
      currBatch.set(notifRef, {
        userId: uid,
        title,
        body,
        type: 'generale',
        href: href ?? null,
        letta: false,
        createdAt: FieldValue.serverTimestamp(),
        sentByAdmin: callerUid,
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

    // ── Raccolta FCM / WebPush ────────────────────────────────────────────────
    const getCredentials = async (uid: string) => {
      const tokensSnap = await adminDb.collection('users').doc(uid).collection('fcmTokens').get();
      const fcmTokens = tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
      const wpSnap = await adminDb.collection('users').doc(uid).collection('webPushSubscriptions').get();
      const wpDocs = wpSnap.docs;
      const hasWebPush = wpDocs.length > 0;
      return { fcmTokens: hasWebPush ? [] : fcmTokens, wpDocs };
    };

    const credentialsResults = await Promise.all(targetUserIds.map(uid => getCredentials(uid)));
    const allFCMTokens = credentialsResults.flatMap(c => c.fcmTokens);
    const allWPDocs = credentialsResults.flatMap(c => c.wpDocs);

    // ── Invio Native Web Push ─────────────────────────────────────────────────
    const wpPayload = JSON.stringify({ title, body, href: href || '/dashboard' });
    let wpSent = 0;
    if (allWPDocs.length > 0) {
      const wpResults = await Promise.allSettled(
        allWPDocs.map(async (docSnap) => {
          const { subscription } = docSnap.data();
          try {
            await webpush.sendNotification(subscription, wpPayload);
          } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await docSnap.ref.delete();
            }
            throw err;
          }
        })
      );
      wpSent = wpResults.filter(r => r.status === 'fulfilled').length;
    }

    // ── Invio FCM ────────────────────────────────────────────────────────────
    let fcmSentCount = 0;
    const BATCH_SIZE = 500;
    for (let i = 0; i < allFCMTokens.length; i += BATCH_SIZE) {
      const batch = allFCMTokens.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;
      try {
        const response = await adminMessaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: { href: href ?? '/dashboard', type: 'generale' },
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
      } catch (fcmError) {
        console.error('[send-custom-notification] FCM error:', fcmError);
      }
    }

    return NextResponse.json({
      success: true,
      recipients: targetUserIds.length,
      fcmSent: fcmSentCount,
      webPushSent: wpSent,
    });

  } catch (error: any) {
    console.error('[send-custom-notification] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
