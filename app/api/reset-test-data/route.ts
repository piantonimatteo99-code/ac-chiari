import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// ── Email da proteggere (non verrà mai eliminata) ────────────────────────────
const PROTECTED_EMAIL = 'piantonimatteo.99@gmail.com';

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
  'feedback',
  'generate',
  'ruoli-educatori',
  'page-settings',
  'campi',
  'familyJoinPins',
  'familyJoinRequests',
  'calendarSubscriptions',
];

// Sub-collections to wipe under every user doc (incluso admin)
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
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

export async function POST(req: NextRequest) {
  try {
    initAdminApp();
    const db = admin.firestore();
    const auth = admin.auth();

    // ── 0. Security ───────────────────────────────────────────────────────────
    // Accetta DUE percorsi di autenticazione (uno dei due deve passare):
    // A) x-reset-secret: segreto fisso per script/CI
    // B) x-admin-token: Firebase ID token con ruolo admin (usato dal pulsante UI)
    const secretHeader = req.headers.get('x-reset-secret');
    const expectedSecret = process.env.RESET_SECRET;
    const secretOk = !!expectedSecret && secretHeader === expectedSecret;

    let tokenOk = false;
    const adminTokenHeader = req.headers.get('x-admin-token');
    if (!secretOk && adminTokenHeader) {
      try {
        const decoded = await auth.verifyIdToken(adminTokenHeader);
        const callerDoc = await db.collection('users').doc(decoded.uid).get();
        const roles: string[] = callerDoc.exists && Array.isArray(callerDoc.data()?.roles)
          ? callerDoc.data()!.roles
          : [];
        tokenOk = roles.includes('admin');
      } catch {
        // Token non valido — tokenOk rimane false
      }
    }

    if (!secretOk && !tokenOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const results: Record<string, number> = {};

    // ── 1. Trova UID protetto dal suo email ───────────────────────────────────
    let protectedUid: string | null = null;
    try {
      const protectedUser = await auth.getUserByEmail(PROTECTED_EMAIL);
      protectedUid = protectedUser.uid;
    } catch {
      console.warn('[reset] Protected user not found by email, proceeding without protection');
    }

    // ── 2. Elimina tutti gli utenti Firebase Auth tranne il protetto ──────────
    let authDeleted = 0;
    let pageToken: string | undefined;
    const uidsToDelete: string[] = [];

    do {
      const listResult = await auth.listUsers(1000, pageToken);
      for (const u of listResult.users) {
        if (u.uid !== protectedUid) uidsToDelete.push(u.uid);
      }
      pageToken = listResult.pageToken;
    } while (pageToken);

    // Firebase Auth deleteUsers accetta max 1000 per chiamata
    for (let i = 0; i < uidsToDelete.length; i += 1000) {
      const chunk = uidsToDelete.slice(i, i + 1000);
      const res = await auth.deleteUsers(chunk);
      authDeleted += res.successCount;
      if (res.errors.length > 0) {
        console.warn('[reset] Some auth users could not be deleted:', res.errors);
      }
    }
    results['auth/users_deleted'] = authDeleted;

    // ── 3. Elimina documenti Firestore in `users` tranne il protetto ──────────
    const usersSnap = await db.collection('users').get();
    let firestoreUsersDeleted = 0;
    let subCollectionsDeleted = 0;

    for (const userDoc of usersSnap.docs) {
      // Cancella sempre le sotto-collezioni (fcmTokens, ecc.) per tutti i doc
      for (const sub of USER_SUBCOLLECTIONS) {
        const subSnap = await userDoc.ref.collection(sub).get();
        if (!subSnap.empty) {
          const batch = db.batch();
          subSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          subCollectionsDeleted += subSnap.size;
        }
      }

      // Per l'admin protetto: rimuovi familyId e gruppoId (puntano a dati cancellati)
      if (userDoc.id === protectedUid) {
        await userDoc.ref.update({
          familyId: admin.firestore.FieldValue.delete(),
          gruppoId: admin.firestore.FieldValue.delete(),
        }).catch(() => {});
        // Svuota tokens google-calendar nella sotto-collezione private
        const privateSnap = await userDoc.ref.collection('private').get();
        if (!privateSnap.empty) {
          const batch = db.batch();
          privateSnap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          subCollectionsDeleted += privateSnap.size;
        }
      } else {
        // Cancella il documento utente
        await userDoc.ref.delete();
        firestoreUsersDeleted++;
      }
    }
    results['users/docs_deleted'] = firestoreUsersDeleted;
    results['users/subcollections_deleted'] = subCollectionsDeleted;

    // ── 4. Elimina tutta la collezione `famiglie` (incluso il nucleo admin) ───
    // Prima svuota tutte le sotto-collezioni `membri`
    try {
      const membriSnap = await db.collectionGroup('membri').get();
      if (!membriSnap.empty) {
        const batch = db.batch();
        membriSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        results['famiglie/membri'] = membriSnap.size;
      } else {
        results['famiglie/membri'] = 0;
      }
    } catch (e: any) {
      console.warn('[reset] Could not wipe famiglie/membri:', e.message);
    }
    // Poi i documenti radice di famiglie
    results['famiglie'] = await deleteCollection(db, 'famiglie');

    // ── 5. Wipe top-level collections ────────────────────────────────────────
    for (const col of COLLECTIONS_TO_WIPE) {
      try {
        results[col] = await deleteCollection(db, col);
      } catch (e: any) {
        console.warn(`[reset] Could not wipe ${col}:`, e.message);
        results[col] = -1;
      }
    }

    // ── 6. Orphaned sub-collections di progetti ───────────────────────────────
    for (const sub of ['messaggi', 'social-posts', 'acquisti']) {
      try {
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

    // ── 7b. Sotto-collezioni orfane di campi (dati) ───────────────────────────
    try {
      const datiSnap = await db.collectionGroup('dati').get();
      if (!datiSnap.empty) {
        const batch = db.batch();
        datiSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        results['campi/dati'] = datiSnap.size;
      }
    } catch (e: any) {
      console.warn('[reset] Could not wipe campi/dati:', e.message);
    }

    // ── 7. Orphaned partecipanti di presenze ──────────────────────────────────
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

    console.log('[reset-test-data] Completed:', results);
    return NextResponse.json({ success: true, deleted: results });

  } catch (error: any) {
    console.error('[reset-test-data] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
