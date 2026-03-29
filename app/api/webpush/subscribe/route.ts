import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/webpush/subscribe
 * Saves a native Web Push PushSubscription for the authenticated user.
 *
 * Body: { uid: string, subscription: PushSubscriptionJSON }
 */
export async function POST(req: NextRequest) {
  try {
    initAdminApp();
    const { uid, subscription } = await req.json();

    if (!uid || !subscription?.endpoint) {
      return NextResponse.json({ error: 'uid and subscription.endpoint required' }, { status: 400 });
    }

    // Use first 30 chars of endpoint as document key (stable identifier)
    const key = Buffer.from(subscription.endpoint).toString('base64').substring(0, 30);

    await adminDb.collection('users').doc(uid)
      .collection('webPushSubscriptions').doc(key)
      .set({
        subscription,
        endpoint: subscription.endpoint,
        createdAt: Timestamp.now(),
        platform: 'web-push',
      }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[webpush/subscribe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/webpush/subscribe
 * Removes a Web Push subscription for the authenticated user.
 *
 * Body: { uid: string, endpoint: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    initAdminApp();
    const { uid, endpoint } = await req.json();
    if (!uid || !endpoint) {
      return NextResponse.json({ error: 'uid and endpoint required' }, { status: 400 });
    }

    const key = Buffer.from(endpoint).toString('base64').substring(0, 30);
    await adminDb.collection('users').doc(uid)
      .collection('webPushSubscriptions').doc(key)
      .delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[webpush/unsubscribe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
