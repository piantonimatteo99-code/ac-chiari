import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import {
  pushEventToUser,
  findEventOnUserCalendar,
  updateEventForUser,
  deleteEventForUser
} from '@/lib/google-calendar-utils';

/**
 * POST /api/calendar/broadcast
 * Pushes, updates, or deletes an event on Google Calendars of subscribed users.
 * Requires a valid Firebase ID token with admin or educatore role.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth check ──
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        initAdminApp();
        const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const roles: string[] = Array.isArray(userDoc.data()?.roles) ? userDoc.data()!.roles : [];
        if (!roles.includes('admin') && !roles.includes('educatore')) {
          return NextResponse.json({ error: 'Accesso negato: ruolo insufficiente' }, { status: 403 });
        }
      } catch (authErr: any) {
        console.warn('[broadcast] Auth error (non bloccante):', authErr.message);
        // Token invalido: nega la richiesta
        return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
      }
    }
    // Se non c'è header Authorization lasciamo passare (chiamata interna server-side)

    const body = await request.json();
    const { action, groupIds, title, description, startDate, endDate, allDay, creatorUserId, oldEvent, newEvent } = body;

    initAdminApp();
    const db = getFirestore();

    // Query all users who have Google Calendar connected
    const subsSnap = await db
      .collection('calendarSubscriptions')
      .where('connected', '==', true)
      .get();

    let pushed = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // --- CASE A: DELETE ACTION ---
    if (action === 'delete') {
      if (!groupIds?.length || !title || !startDate) {
        return NextResponse.json({ error: 'groupIds, title, startDate sono obbligatori per delete' }, { status: 400 });
      }

      const groupIdSet = new Set<string>(groupIds);
      const eventToDelete = { title, startDate, allDay: !!allDay };

      await Promise.all(
        subsSnap.docs.map(async (docSnap) => {
          const { uid, syncGroupIds } = docSnap.data() as { uid: string; syncGroupIds: string[] };

          const shouldSync = (syncGroupIds ?? []).some(gid => groupIdSet.has(gid));
          if (!shouldSync) { skipped++; return; }

          try {
            const gcalEventId = await findEventOnUserCalendar(uid, eventToDelete);
            if (gcalEventId) {
              await deleteEventForUser(uid, gcalEventId);
              deleted++;
            } else {
              skipped++;
            }
          } catch (err: any) {
            errors.push(`${uid}: ${err.message}`);
          }
        })
      );

      return NextResponse.json({ deleted, skipped, errors });
    }

    // --- CASE B: UPDATE ACTION ---
    if (action === 'update') {
      if (!oldEvent || !newEvent) {
        return NextResponse.json({ error: 'oldEvent e newEvent sono obbligatori per update' }, { status: 400 });
      }

      const oldGroupIdSet = new Set<string>(oldEvent.groupIds || []);
      const newGroupIdSet = new Set<string>(newEvent.groupIds || []);

      await Promise.all(
        subsSnap.docs.map(async (docSnap) => {
          const { uid, syncGroupIds } = docSnap.data() as { uid: string; syncGroupIds: string[] };

          const wasSynced = (syncGroupIds ?? []).some(gid => oldGroupIdSet.has(gid));
          const shouldSync = (syncGroupIds ?? []).some(gid => newGroupIdSet.has(gid));

          try {
            if (wasSynced && shouldSync) {
              // Action: Update
              const gcalEventId = await findEventOnUserCalendar(uid, oldEvent);
              if (gcalEventId) {
                await updateEventForUser(uid, gcalEventId, newEvent);
                updated++;
              } else {
                // If not found, fall back to push (create)
                await pushEventToUser(uid, newEvent);
                pushed++;
              }
            } else if (wasSynced && !shouldSync) {
              // Action: Delete (un-subscribed from group or group removed from event)
              const gcalEventId = await findEventOnUserCalendar(uid, oldEvent);
              if (gcalEventId) {
                await deleteEventForUser(uid, gcalEventId);
                deleted++;
              } else {
                skipped++;
              }
            } else if (!wasSynced && shouldSync) {
              // Action: Create (subscribed or group added)
              await pushEventToUser(uid, newEvent);
              pushed++;
            } else {
              skipped++;
            }
          } catch (err: any) {
            errors.push(`${uid}: ${err.message}`);
          }
        })
      );

      return NextResponse.json({ pushed, updated, deleted, skipped, errors });
    }

    // --- CASE C: CREATE ACTION (default backward compatible) ---
    if (!groupIds?.length || !title || !startDate || !endDate) {
      return NextResponse.json({ error: 'groupIds, title, startDate, endDate sono obbligatori' }, { status: 400 });
    }

    const groupIdSet = new Set<string>(groupIds);
    const event = { title, description, startDate, endDate, allDay: !!allDay };

    await Promise.all(
      subsSnap.docs.map(async (docSnap) => {
        const { uid, syncGroupIds } = docSnap.data() as { uid: string; syncGroupIds: string[] };

        if (uid === creatorUserId) { skipped++; return; }

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
