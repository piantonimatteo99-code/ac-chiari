import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/send-notification
 * 
 * Body:
 * {
 *   userId: string | '__broadcast__',  // '__broadcast__' to send to all users
 *   title: string,
 *   body: string,
 *   type: 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback',
 *   href?: string,  // optional link to navigate to on click
 * }
 * 
 * This endpoint:
 * 1. Saves the notification to Firestore
 * 2. Sends FCM push notifications to all registered device tokens
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, type, href } = await req.json();

    if (!userId || !title || !body || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Save notification to Firestore
    const notifRef = await adminDb.collection('notifiche').add({
      userId,
      title,
      body,
      type,
      href: href ?? null,
      letta: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Send FCM push notification
    // Collect all FCM tokens for the target user(s)
    let tokens: string[] = [];

    if (userId === '__broadcast__') {
      // Get all FCM tokens from all users
      const usersSnap = await adminDb.collection('users').get();
      const tokenPromises = usersSnap.docs.map(async (userDoc) => {
        const tokensSnap = await userDoc.ref.collection('fcmTokens').get();
        return tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
      });
      const allTokenArrays = await Promise.all(tokenPromises);
      tokens = allTokenArrays.flat();
    } else {
      // Get tokens for a specific user
      const tokensSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('fcmTokens')
        .get();
      tokens = tokensSnap.docs.map(t => t.data().token as string).filter(Boolean);
    }

    // Send FCM messages in batches of 500
    const BATCH_SIZE = 500;
    const fcmResults = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      try {
        const response = await adminMessaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          data: {
            notificationId: notifRef.id,
            href: href ?? '/dashboard',
            type,
          },
          webpush: {
            notification: {
              icon: '/ac-logo.jpg',
              badge: '/ac-logo.jpg',
              requireInteraction: true,
            },
            fcmOptions: {
              link: href ?? '/dashboard',
            },
          },
        });
        fcmResults.push(response);

        // Clean up invalid tokens
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && (
            resp.error?.code === 'messaging/registration-token-not-registered' ||
            resp.error?.code === 'messaging/invalid-registration-token'
          )) {
            invalidTokens.push(batch[idx]);
          }
        });

        // Remove invalid tokens from Firestore
        if (invalidTokens.length > 0) {
          // For simplicity, we won't delete them here in this version
          console.warn('Invalid FCM tokens detected:', invalidTokens.length);
        }
      } catch (fcmError) {
        console.error('FCM send error:', fcmError);
      }
    }

    return NextResponse.json({
      success: true,
      notificationId: notifRef.id,
      fcmSent: tokens.length,
    });

  } catch (error: any) {
    console.error('Error in /api/send-notification:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
