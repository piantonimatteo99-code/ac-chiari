import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp, getFirestoreForTenant } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * POST /api/admin/bootstrap-tenant-smtp
 * Copia la configurazione SMTP del tenant sorgente (default: acchiari) nel tenant destinazione.
 * Protetta da un secret token per evitare abusi.
 * 
 * Body: { targetTenantId: string, secret: string }
 */
export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    const body = await request.json();
    const { targetTenantId, secret } = body;

    // Verifica secret token (usa la stessa variabile FIREBASE_SERVICE_ACCOUNT_KEY come fingerprint)
    const expectedSecret = process.env.BOOTSTRAP_SECRET || 'gemmaflow-bootstrap-2024';
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Secret non valido' }, { status: 403 });
    }

    if (!targetTenantId) {
      return NextResponse.json({ error: 'targetTenantId richiesto' }, { status: 400 });
    }

    // 1. Leggi SMTP dal tenant sorgente (acchiari = default)
    const sourceDb = getFirestoreForTenant('acchiari');
    const smtpDoc = await sourceDb.collection('config').doc('smtp').get();

    let smtpConfig: Record<string, any>;

    if (smtpDoc.exists) {
      smtpConfig = smtpDoc.data()!;
      console.log(`[bootstrap-smtp] Config trovata in acchiari Firestore`);
    } else {
      // Fallback alle variabili d'ambiente
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASSWORD;
      const host = process.env.SMTP_HOST || 'smtp.gmail.com';
      const port = process.env.SMTP_PORT || '587';
      const secure = process.env.SMTP_SECURE === 'true';

      if (!user || !pass) {
        return NextResponse.json({
          error: 'Nessuna configurazione SMTP disponibile (né Firestore né env vars SMTP_USER/SMTP_PASSWORD)',
        }, { status: 500 });
      }

      smtpConfig = { host, port, secure, user, pass };
      console.log(`[bootstrap-smtp] Uso env vars come config SMTP`);
    }

    // 2. Scrivi nel tenant destinazione
    const targetDb = getFirestoreForTenant(targetTenantId);
    await targetDb.collection('config').doc('smtp').set({
      ...smtpConfig,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      copiedFrom: 'acchiari',
      bootstrappedAt: new Date().toISOString(),
    });

    console.log(`[bootstrap-smtp] ✅ Config SMTP copiata in ${targetTenantId}`);

    return NextResponse.json({
      success: true,
      message: `Configurazione SMTP copiata da acchiari → ${targetTenantId}`,
      smtpHost: smtpConfig.host,
      smtpUser: smtpConfig.user,
    });

  } catch (err: any) {
    console.error('[bootstrap-smtp] Errore:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
