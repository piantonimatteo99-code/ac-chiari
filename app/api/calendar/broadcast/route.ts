import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import { pushEventToUser } from '@/lib/google-calendar-utils';

/**
 * POST /api/calendar/broadcast
 * Pushes an event to ALL users who:
 *  1. Have Google Calendar connected
 *  2. Have at least one of the event's groupIds in their syncGroupIds
 *
 * Body: {
 *   groupIds: string[],      — groups this event belongs to
 *   title: string,
 *   description?: string,
 *   startDate: string,       — ISO string
 *   endDate: string,
 *   allDay: boolean,
 *   creatorUserId?: string,  — excluded if they handled their own sync separately
 * }
 *
 * Returns: { pushed: number, skipped: number, errors: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupIds, title, description, startDate, endDate, allDay, creatorUserId } = body;

    if (!groupIds?.length || !title || !startDate || !endDate) {
      return NextResponse.json({ error: 'groupIds, title, startDate, endDate sono obbligatori' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();

    // Query all users who have Google Calendar connected
    const subsSnap = await db
      .collection('calendarSubscriptions')
      .where('connected', '==', true)
      .get();

    const groupIdSet = new Set<string>(groupIds);
    const event = { title, description, startDate, endDate, allDay };

    let pushed = 0;
    let skipped = 0;
    const errors: string[] = [];

    await Promise.all(
      subsSnap.docs.map(async (docSnap) => {
        const { uid, syncGroupIds } = docSnap.data() as { uid: string; syncGroupIds: string[] };

        // Skip creator (they handle their own sync, or they opted out)
        if (uid === creatorUserId) { skipped++; return; }

        // Check if any of the user's sync groups match the event's groups
        const shouldSync = (syncGroupIds ?? []).some(gid => groupIdSet.has(gid));
        if (!shouldSync) { skipped++; return; }

        try {
          await pushEventToUser(uid, event);
          pushed++;
        } catch (err: any) {
          errors.push(`${uid}: ${err.message}`);
        }
      })
    );

    return NextResponse.json({ pushed, skipped, errors });
  } catch (err: any) {
    console.error('Broadcast error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
