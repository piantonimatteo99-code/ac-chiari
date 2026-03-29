import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';

webpush.setVapidDetails(
  process.env.WEBPUSH_SUBJECT!,
  process.env.NEXT_PUBLIC_WEBPUSH_PUBLIC_KEY!,
  process.env.WEBPUSH_PRIVATE_KEY!
);

/**
 * POST /api/webpush/send
 * Sends a native Web Push notification to:
 *   - a specific user (userId), or
 *   - all users ('__broadcast__')
 *
 * Body: { userId: string, title: string, body: string, href?: string }
 */
export async function POST(req: NextRequest) {
  try {
    initAdminApp();
    const { userId, title, body, href } = await req.json();

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'userId, title, body required' }, { status: 400 });
    }

    const payload = JSON.stringify({ title, body, href: href || '/dashboard' });

    let subscriptionsQuery;
    if (userId === '__broadcast__') {
      // Get all subscriptions across all users using collectionGroup
      subscriptionsQuery = adminDb.collectionGroup('webPushSubscriptions');
    } else {
      subscriptionsQuery = adminDb
        .collection('users').doc(userId)
        .collection('webPushSubscriptions');
    }

    const snapshot = await subscriptionsQuery.get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions found' });
    }

    const results = await Promise.allSettled(
      snapshot.docs.map(async (docSnap) => {
        const { subscription, endpoint } = docSnap.data();
        try {
          await webpush.sendNotification(subscription, payload);
        } catch (err: any) {
          // 410 Gone = subscription expired/revoked — clean it up
          if (err.statusCode === 410 || err.statusCode === 404) {
            await docSnap.ref.delete();
          }
          throw err;
        }
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({ success: true, sent, failed });
  } catch (err: any) {
    console.error('[webpush/send]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
