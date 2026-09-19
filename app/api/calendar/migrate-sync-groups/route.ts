import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { syncFutureEventsForUser } from '@/lib/google-calendar-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar/migrate-sync-groups
 * Body (optional): { targetEmail?: string; force?: boolean }
 *
 * - Without body: migrates ALL connected users who have syncGroupIds = [].
 * - With targetEmail: migrates only that specific user (useful for testing).
 *   When force=true the user is migrated even if syncGroupIds is already set.
 *
 * Requires an admin Firebase ID token in the Authorization header.
 * Safe to run multiple times — already-configured users are skipped
 * unless force=true is passed.
 */
export async function POST(request: NextRequest) {
  initAdminApp();

  // ── Auth: admin role required ────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authorization richiesta (Bearer token)' }, { status: 401 });
  }

  // Optional body params for single-user test mode
  let targetEmail: string | null = null;
  let force = false;
  try {
    const body = await request.json();
    targetEmail = body.targetEmail ?? null;
    force = body.force === true;
  } catch { /* empty body — fine, migrate all */ }

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

  let migrated = 0;
  let alreadyConfigured = 0;
  let noGroup = 0;
  const errors: string[] = [];
  const details: { uid: string; email?: string; groupId: string; syncGroupIds: string[]; pushed: number }[] = [];

  // ── Single-user test mode ─────────────────────────────────────────────────
  if (targetEmail) {
    let targetUid: string;
    try {
      const userRecord = await admin.auth().getUserByEmail(targetEmail);
      targetUid = userRecord.uid;
    } catch (err: any) {
      return NextResponse.json({ error: `Utente non trovato: ${targetEmail} — ${err.message}` }, { status: 404 });
    }

    const userDoc = await db.collection('users').doc(targetUid).get();
    const userData = userDoc.data() || {};
    const groupId: string | undefined = userData.groupId;

    if (!groupId) {
      return NextResponse.json({ error: `L'utente ${targetEmail} non ha un groupId assegnato.` }, { status: 400 });
    }

    const subDoc = await db.collection('calendarSubscriptions').doc(targetUid).get();
    const existingSyncGroupIds: string[] = subDoc.data()?.syncGroupIds || [];
    const isConnected: boolean = subDoc.data()?.connected === true;

    if (!isConnected) {
      return NextResponse.json({ error: `L'utente ${targetEmail} non ha Google Calendar collegato.` }, { status: 400 });
    }

    if (existingSyncGroupIds.length > 0 && !force) {
      return NextResponse.json({
        summary: { total: 1, migrated: 0, alreadyConfigured: 1, noGroup: 0, errors: 0 },
        migrated: [],
        errors: [],
        note: `${targetEmail} ha già syncGroupIds configurati: ${JSON.stringify(existingSyncGroupIds)}. Passa force=true per forzare la risincronizzazione.`,
      });
    }

    const newSyncGroupIds = [groupId];

    await db.collection('calendarSubscriptions').doc(targetUid).set(
      { uid: targetUid, syncGroupIds: newSyncGroupIds },
      { merge: true }
    );
    await db.collection('users').doc(targetUid).collection('private').doc('google-calendar').set(
      { syncGroupIds: newSyncGroupIds },
      { merge: true }
    );

    let pushed = 0;
    try {
      const syncResult = await syncFutureEventsForUser(targetUid, newSyncGroupIds);
      pushed = syncResult.pushed;
      if (syncResult.errors.length > 0) errors.push(...syncResult.errors);
    } catch (syncErr: any) {
      errors.push(`GCal sync failed: ${syncErr.message}`);
    }

    details.push({ uid: targetUid, email: targetEmail, groupId, syncGroupIds: newSyncGroupIds, pushed });
    migrated = 1;

    return NextResponse.json({
      summary: { total: 1, migrated, alreadyConfigured: 0, noGroup: 0, errors: errors.length },
      migrated: details,
      errors,
    });
  }

  // ── All-users mode ────────────────────────────────────────────────────────
  const subsSnap = await db.collection('calendarSubscriptions')
    .where('connected', '==', true)
    .get();

  for (const subDoc of subsSnap.docs) {
    const subData = subDoc.data();
    const uid: string = subData.uid;
    const existingSyncGroupIds: string[] = subData.syncGroupIds || [];

    // Skip users who already have groups configured (unless force=true)
    if (existingSyncGroupIds.length > 0 && !force) {
      alreadyConfigured++;
      continue;
    }

    try {
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};
      const groupId: string | undefined = userData.groupId;

      if (!groupId) {
        noGroup++;
        console.log(`[migrate] User ${uid}: no groupId, skipping`);
        continue;
      }

      const newSyncGroupIds = [groupId];

      await db.collection('calendarSubscriptions').doc(uid).update({ syncGroupIds: newSyncGroupIds });
      await db.collection('users').doc(uid).collection('private').doc('google-calendar').set(
        { syncGroupIds: newSyncGroupIds },
        { merge: true }
      );

      let pushed = 0;
      try {
        const syncResult = await syncFutureEventsForUser(uid, newSyncGroupIds);
        pushed = syncResult.pushed;
        if (syncResult.errors.length > 0) errors.push(...syncResult.errors.map(e => `${uid}: ${e}`));
        console.log(`[migrate] User ${uid} → groupId=${groupId}, pushed=${pushed}`);
      } catch (syncErr: any) {
        errors.push(`${uid}: GCal sync failed — ${syncErr.message}`);
      }

      details.push({ uid, groupId, syncGroupIds: newSyncGroupIds, pushed });
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
