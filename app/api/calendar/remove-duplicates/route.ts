import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { removeDuplicateEventsForUser } from '@/lib/google-calendar-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/calendar/remove-duplicates
 * Body (optional): { targetEmail?: string }
 *
 * - Without body: scans all connected users with syncGroupIds configured.
 * - With targetEmail: scans only that specific user (useful for testing).
 *
 * For each user, fetches future Google Calendar events, groups by (title + date),
 * and deletes all but the earliest-created copy of each duplicate group.
 *
 * Requires an admin Firebase ID token in the Authorization header.
 */
export async function POST(request: NextRequest) {
  initAdminApp();

  // ── Auth: admin role required ────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authorization richiesta (Bearer token)' }, { status: 401 });
  }

  // Optional body
  let targetEmail: string | null = null;
  try {
    const body = await request.json();
    targetEmail = body.targetEmail ?? null;
  } catch { /* empty body — process all users */ }

  const db = getFirestore();

  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
    const callerDoc = await db.collection('users').doc(decoded.uid).get();
    const callerRoles: string[] = Array.isArray(callerDoc.data()?.roles) ? callerDoc.data()!.roles : [];
    if (!callerRoles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono eseguire questa operazione' }, { status: 403 });
    }
  } catch (authErr: any) {
    return NextResponse.json({ error: `Token non valido: ${authErr.message}` }, { status: 401 });
  }

  // ── Single-user mode ─────────────────────────────────────────────────────
  if (targetEmail) {
    let targetUid: string;
    try {
      const userRecord = await admin.auth().getUserByEmail(targetEmail);
      targetUid = userRecord.uid;
    } catch (err: any) {
      return NextResponse.json({ error: `Utente non trovato: ${targetEmail}` }, { status: 404 });
    }

    const subDoc = await db.collection('calendarSubscriptions').doc(targetUid).get();
    if (!subDoc.data()?.connected) {
      return NextResponse.json({ error: `${targetEmail} non ha Google Calendar collegato.` }, { status: 400 });
    }

    try {
      const result = await removeDuplicateEventsForUser(targetUid);
      return NextResponse.json({
        summary: { usersProcessed: 1, totalChecked: result.checked, totalRemoved: result.removed, errors: result.errors.length },
        details: [{ uid: targetUid, email: targetEmail, ...result }],
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── All-users mode ────────────────────────────────────────────────────────
  const subsSnap = await db.collection('calendarSubscriptions')
    .where('connected', '==', true)
    .get();

  let totalChecked = 0;
  let totalRemoved = 0;
  const allErrors: string[] = [];
  const details: { uid: string; checked: number; removed: number; errors: number }[] = [];

  for (const subDoc of subsSnap.docs) {
    const uid: string = subDoc.data().uid;
    const syncGroupIds: string[] = subDoc.data().syncGroupIds || [];

    // Only process users who have groups configured (they received events)
    if (!syncGroupIds.length) continue;

    try {
      const result = await removeDuplicateEventsForUser(uid);
      totalChecked += result.checked;
      totalRemoved += result.removed;
      if (result.errors.length > 0) allErrors.push(...result.errors.map(e => `${uid}: ${e}`));
      if (result.removed > 0 || result.errors.length > 0) {
        details.push({ uid, checked: result.checked, removed: result.removed, errors: result.errors.length });
      }
      console.log(`[remove-duplicates] ${uid}: checked=${result.checked}, removed=${result.removed}`);
    } catch (err: any) {
      allErrors.push(`${uid}: ${err.message}`);
      console.warn(`[remove-duplicates] Failed for ${uid}:`, err.message);
    }
  }

  return NextResponse.json({
    summary: {
      usersProcessed: subsSnap.docs.length,
      totalChecked,
      totalRemoved,
      errors: allErrors.length,
    },
    details,
    errors: allErrors,
  });
}
