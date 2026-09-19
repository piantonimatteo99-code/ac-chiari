import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { syncFutureEventsForUser } from '@/lib/google-calendar-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar/migrate-sync-groups
 *
 * One-time admin migration that:
 * 1. Finds every user with Google Calendar connected but syncGroupIds = []
 * 2. Sets syncGroupIds = [userData.groupId] for each of them
 * 3. Pushes all future events for those groups to their Google Calendar
 *
 * Requires an admin Firebase ID token in the Authorization header:
 *   Authorization: Bearer <id-token>
 *
 * Safe to run multiple times — already-configured users are skipped.
 */
export async function POST(request: NextRequest) {
  initAdminApp();

  // ── Auth: admin role required ────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authorization richiesta (Bearer token)' }, { status: 401 });
  }

  try {
    const db = getFirestore();
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const callerDoc = await db.collection('users').doc(decoded.uid).get();
    const callerRoles: string[] = Array.isArray(callerDoc.data()?.roles) ? callerDoc.data()!.roles : [];
    if (!callerRoles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono eseguire la migrazione' }, { status: 403 });
    }
  } catch (authErr: any) {
    return NextResponse.json({ error: `Token non valido: ${authErr.message}` }, { status: 401 });
  }

  // ── Migration ────────────────────────────────────────────────────────────
  const db = getFirestore();

  const subsSnap = await db.collection('calendarSubscriptions')
    .where('connected', '==', true)
    .get();

  let migrated = 0;
  let alreadyConfigured = 0;
  let noGroup = 0;
  const errors: string[] = [];
  const details: { uid: string; groupId: string; pushed: number }[] = [];

  for (const subDoc of subsSnap.docs) {
    const subData = subDoc.data();
    const uid: string = subData.uid;
    const existingSyncGroupIds: string[] = subData.syncGroupIds || [];

    // Skip users who already have groups configured
    if (existingSyncGroupIds.length > 0) {
      alreadyConfigured++;
      continue;
    }

    try {
      // Get the user's personal group
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};
      const groupId: string | undefined = userData.groupId;

      if (!groupId) {
        noGroup++;
        console.log(`[migrate] User ${uid}: no groupId, skipping`);
        continue;
      }

      const newSyncGroupIds = [groupId];

      // Update calendarSubscriptions
      await db.collection('calendarSubscriptions').doc(uid).update({
        syncGroupIds: newSyncGroupIds,
      });

      // Keep private doc consistent (for the UI)
      await db.collection('users').doc(uid).collection('private').doc('google-calendar').set(
        { syncGroupIds: newSyncGroupIds },
        { merge: true }
      );

      // Push future events for their group to their Google Calendar
      let pushed = 0;
      try {
        const syncResult = await syncFutureEventsForUser(uid, newSyncGroupIds);
        pushed = syncResult.pushed;
        if (syncResult.errors.length > 0) {
          errors.push(...syncResult.errors.map(e => `${uid}: ${e}`));
        }
        console.log(`[migrate] User ${uid} → groupId=${groupId}, pushed=${pushed}`);
      } catch (syncErr: any) {
        // GCal sync failure is logged but doesn't fail the migration for this user
        errors.push(`${uid}: GCal sync failed — ${syncErr.message}`);
        console.warn(`[migrate] GCal sync failed for ${uid}:`, syncErr.message);
      }

      details.push({ uid, groupId, pushed });
      migrated++;
    } catch (err: any) {
      errors.push(`${uid}: ${err.message}`);
    }
  }

  return NextResponse.json({
    summary: {
      total: subsSnap.docs.length,
      migrated,
      alreadyConfigured,
      noGroup,
      errors: errors.length,
    },
    migrated: details,
    errors,
  });
}
