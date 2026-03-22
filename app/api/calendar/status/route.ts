import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

/**
 * GET /api/calendar/status?userId=xxx
 * Returns whether the user has Google Calendar connected
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ connected: false }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    const tokenDoc = await db
      .collection('users')
      .doc(userId)
      .collection('private')
      .doc('google-calendar')
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json({ connected: false });
    }

    const data = tokenDoc.data()!;
    return NextResponse.json({ connected: data.connected === true && !!data.refreshToken });
  } catch (err: any) {
    return NextResponse.json({ connected: false, error: err.message });
  }
}
