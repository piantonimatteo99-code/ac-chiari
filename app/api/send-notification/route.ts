import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/send-notification
 *
 * Body:
 * {
 *   userId: string | '__broadcast__',
 *   title: string,
 *   body: string,
 *   type: 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback',
 *   href?: string,
 *   eventType?: string,  // used to filter by role when broadcasting
 * }
 */

type NotifRole = 'admin' | 'educatore' | 'genitore';

/** Maps a user's roles[] array to the three notification roles */
function userNotifRoles(roles: string[]): NotifRole[] {
  const out: NotifRole[] = [];
  if (roles.includes('admin')) out.push('admin');
  if (roles.includes('educatore')) out.push('educatore');
  if (roles.includes('genitore') || roles.includes('utente')) out.push('genitore');
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, type, href, eventType } = await req.json();

    if (!userId || !title || !body || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
    let tokens: string[] = [];
    let targetUserIds: string[] = [];

    if (userId === '__broadcast__') {
      const usersSnap = await adminDb.collection('users').get();

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();

        // Role filtering
        if (enabledFor) {
          const userRoles: string[] = Array.isArray(userData.roles) ? userData.roles : [];
          const notifRoles = userNotifRoles(userRoles);
          const shouldReceive = notifRoles.some(r => enabledFor![r]);
          if (!shouldReceive) continue;
        }

        targetUserIds.push(userDoc.id);
      }

      // Collect FCM tokens for filtered users
      const tokenPromises = targetUserIds.map(async uid => {
        const tokensSnap = await adminDb.collection('users').doc(uid).collection('fcmTokens').get();
        return tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
      });
      const allTokenArrays = await Promise.all(tokenPromises);
      tokens = allTokenArrays.flat();

      // Save in-app notification for each target user
      const notifBatch = adminDb.batch();
      for (const uid of targetUserIds) {
        const notifRef = adminDb.collection('notifiche').doc();
        notifBatch.set(notifRef, {
          userId: uid,
          title,
          body,
          type,
          href: href ?? null,
          letta: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await notifBatch.commit();

    } else {
      // Single user
      const tokensSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('fcmTokens')
        .get();
      tokens = tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);

      await adminDb.collection('notifiche').add({
        userId,
        title,
        body,
        type,
        href: href ?? null,
        letta: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 3. Send FCM push in batches of 500 ───────────────────────────────
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
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
      recipients: userId === '__broadcast__' ? targetUserIds.length : 1,
      fcmTokens: tokens.length,
    });

  } catch (error: any) {
    console.error('Error in /api/send-notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
