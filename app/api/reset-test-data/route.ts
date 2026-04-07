import { NextRequest, NextResponse } from 'next/server';
import { adminDb, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Collections to fully wipe (all documents)
const COLLECTIONS_TO_WIPE = [
  'eventi',
  'progetti',
  'gruppi',
  'raccolte',
  'spese',
  'payments',
  'movimenti-contanti',
  'notifiche',
  'imported-members',
  'presenze',
  'magazzino-alimenti',
  'magazzino-categorie-storico',
  'tariffe-tesseramento',
  'famiglie',
  'feedback',
  'generate',
  'ruoli-educatori',
  'page-settings',
];

// Sub-collections to wipe for each user document
const USER_SUBCOLLECTIONS = [
  'fcmTokens',
  'webPushSubscriptions',
  'notificationPreferences',
];

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  batchSize = 400,
) {
  const colRef = db.collection(collectionPath);
  let deleted = 0;

  while (true) {
    const snap = await colRef.limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const docSnap of snap.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

export async function POST(req: NextRequest) {
  try {
    initAdminApp();
    const db = admin.firestore();

    // ── 1. Security: only allow if a secret header matches ──────
    // We check for an Authorization header with a simple pre-shared token
    // stored in env. In dev it can be omitted.
    const authHeader = req.headers.get('x-reset-secret');
    const expectedSecret = process.env.RESET_SECRET;
    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const results: Record<string, number> = {};

    // ── 2. Wipe top-level collections ───────────────────────────
    for (const col of COLLECTIONS_TO_WIPE) {
      try {
        results[col] = await deleteCollection(db, col);
      } catch (e: any) {
        console.warn(`[reset] Could not wipe ${col}:`, e.message);
        results[col] = -1;
      }
    }

    // ── 3. Wipe sub-collections under each user ──────────────────
    const usersSnap = await db.collection('users').get();
    let subDeleted = 0;
    for (const userDoc of usersSnap.docs) {
      for (const sub of USER_SUBCOLLECTIONS) {
        const subSnap = await userDoc.ref.collection(sub).get();
        if (subSnap.empty) continue;
        const batch = db.batch();
        subSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        subDeleted += subSnap.size;
      }
    }
    results['users/subcollections'] = subDeleted;

    // ── 4. Wipe sub-collections of progetti ─────────────────────
    // (messaggi, social-posts, acquisti) — these live under projects
    // which were already deleted, but Firestore orphans can persist.
    const projectSubcols = ['messaggi', 'social-posts', 'acquisti'];
    for (const sub of projectSubcols) {
      try {
        // collectionGroup query to find any orphaned docs
        const snap = await db.collectionGroup(sub).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          results[`progetti/${sub}`] = snap.size;
        }
      } catch (e: any) {
        console.warn(`[reset] Could not wipe orphaned ${sub}:`, e.message);
      }
    }

    // ── 5. Wipe presenze sub-collections (partecipanti) ──────────
    try {
      const partSnap = await db.collectionGroup('partecipanti').get();
      if (!partSnap.empty) {
        const batch = db.batch();
        partSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        results['presenze/partecipanti'] = partSnap.size;
      }
    } catch (e: any) {
      console.warn('[reset] Could not wipe partecipanti:', e.message);
    }

    // ── 6. Wipe famiglie sub-collections (membri) ─────────────────
    try {
      const membriSnap = await db.collectionGroup('membri').get();
      if (!membriSnap.empty) {
        const batch = db.batch();
        membriSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        results['famiglie/membri'] = membriSnap.size;
      }
    } catch (e: any) {
      console.warn('[reset] Could not wipe famiglie/membri:', e.message);
    }

    console.log('[reset-test-data] Completed:', results);

    return NextResponse.json({ success: true, deleted: results });
  } catch (error: any) {
    console.error('[reset-test-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
