import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import { syncFutureEventsForUser } from '@/lib/google-calendar-utils';

/**
 * GET /api/calendar/sync-settings?userId=xxx
 * Returns the list of groupIds the user has opted into syncing.
 */
export async function GET(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) return NextResponse.json({ syncGroupIds: [] }, { status: 400 });

  try {
    initAdminApp();
    const db = getFirestore();
    const doc = await db.collection('users').doc(userId).collection('private').doc('google-calendar').get();
    const syncGroupIds: string[] = doc.exists ? (doc.data()?.syncGroupIds ?? []) : [];
    return NextResponse.json({ syncGroupIds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/calendar/sync-settings
 * Body: { userId, syncGroupIds: string[] }
 * Saves the user's group sync preferences.
 * Also mirrors to calendarSubscriptions/{userId} for efficient broadcast querying.
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, syncGroupIds } = await request.json();
    if (!userId || !Array.isArray(syncGroupIds)) {
      return NextResponse.json({ error: 'userId e syncGroupIds sono obbligatori' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Read the current syncGroupIds BEFORE updating (to detect newly added groups)
    const oldPrivateDoc = await db
      .collection('users').doc(userId)
      .collection('private').doc('google-calendar').get();
    const oldSyncGroupIds: string[] = oldPrivateDoc.exists
      ? (oldPrivateDoc.data()?.syncGroupIds ?? [])
      : [];

    // Save on the user's private google-calendar doc
    await db.collection('users').doc(userId).collection('private').doc('google-calendar').set(
      { syncGroupIds },
      { merge: true }
    );

    // Mirror to top-level collection for efficient broadcast queries
    const calDoc = await db.collection('users').doc(userId).collection('private').doc('google-calendar').get();
    const connected = calDoc.exists && calDoc.data()?.connected === true;
    await db.collection('calendarSubscriptions').doc(userId).set(
      { uid: userId, connected, syncGroupIds },
      { merge: true }
    );

    // For every newly added group, push future events to the user's Google Calendar
    // This runs fire-and-forget so the API response is immediate
    if (connected) {
      const newlyAdded = (syncGroupIds as string[]).filter(gid => !oldSyncGroupIds.includes(gid));
      if (newlyAdded.length > 0) {
        syncFutureEventsForUser(userId, newlyAdded).catch(err =>
          console.warn(`[sync-settings] Partial initial sync failed for ${userId}:`, err)
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
