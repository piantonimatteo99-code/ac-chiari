import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

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

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
