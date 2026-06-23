import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdminApp, getFirestoreForTenant } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { DEFAULT_TENANT_ID } from '@/lib/tenants';

export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    // ── 0. Autenticazione ────────────────────────────────────────────────────
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }

    // ── 1. Determina Tenant ──────────────────────────────────────────────────
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || DEFAULT_TENANT_ID;
    const tenantDb = getFirestoreForTenant(tenantId);

    // ── 2. Verifica permessi admin nel tenant ────────────────────────────────
    const userDoc = await tenantDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Utente non trovato nel database del tenant' }, { status: 403 });
    }
    const userData = userDoc.data()!;
    if (!userData.roles?.includes('admin')) {
      return NextResponse.json({ error: 'Permessi insufficienti. Richiesto ruolo Admin.' }, { status: 403 });
    }

    // ── 3. Validazione dati ──────────────────────────────────────────────────
    const body = await request.json();
    const { host, port, secure, user, pass, fromName, replyTo } = body;

    if (!host || !user || !pass) {
      return NextResponse.json({ error: 'Host, utente e password sono obbligatori' }, { status: 400 });
    }

    // ── 4. Salvataggio su Firestore (config/smtp) ────────────────────────────
    await tenantDb.collection('config').doc('smtp').set({
      host,
      port: port || '587',
      secure: secure === true || secure === 'true',
      user,
      pass,
      fromName: fromName || null,
      replyTo: replyTo || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: decodedToken.uid,
    });

    console.log(`[save-smtp] Configurazione salvata per tenant "${tenantId}" da uid: ${decodedToken.uid}`);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[save-smtp] Errore:', err);
    return NextResponse.json({ error: err.message || 'Errore nel salvataggio' }, { status: 500 });
  }
}
