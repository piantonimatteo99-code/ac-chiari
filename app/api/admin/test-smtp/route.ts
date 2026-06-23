import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp, getFirestoreForTenant } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { DEFAULT_TENANT_ID, TENANTS } from '@/lib/tenants';

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
    const tenantConfig = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];
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

    // ── 3. Estrazione dati dal body ──────────────────────────────────────────
    const body = await request.json();
    const { host, port, secure, user, pass, testRecipient, fromName, replyTo } = body;

    if (!host || !port || !user || !pass || !testRecipient) {
      return NextResponse.json({ error: 'Tutti i campi (Host, Porta, Utente, Password, Email di test) sono obbligatori' }, { status: 400 });
    }

    // ── 4. Configurazione ed invio email di test ─────────────────────────────
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: secure === true || secure === 'true',
      auth: { user, pass },
      connectionTimeout: 10000, // 10s timeout
    });

    const htmlBody = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
    .card { max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { color: #047857; font-size: 20px; font-weight: bold; margin-bottom: 16px; border-bottom: 2px solid #ecfdf5; padding-bottom: 12px; }
    .content { font-size: 14px; color: #374151; line-height: 1.5; }
    .footer { font-size: 11px; color: #9ca3af; margin-top: 32px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">📧 Test Configurazione SMTP — GemmaFlow</div>
    <div class="content">
      <p>Ciao <strong>${userData.displayName || 'Amministratore'}</strong>,</p>
      <p>Questo è un messaggio di test inviato dal sistema <strong>GemmaFlow</strong> per confermare il corretto funzionamento dei parametri SMTP per l'associazione <strong>${tenantConfig.name}</strong>.</p>
      <p>Se hai ricevuto questa email, significa che la configurazione inserita è <strong>corretta e funzionante</strong>!</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} ${tenantConfig.name} — GemmaFlow System
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"${fromName || tenantConfig.name} (Test)" <${user}>`,
      to: testRecipient,
      replyTo: replyTo || tenantConfig.email,
      subject: `📧 GemmaFlow — Test Connessione SMTP per ${tenantConfig.name}`,
      html: htmlBody,
    });

    return NextResponse.json({ success: true, message: 'Email di test inviata con successo!' });

  } catch (err: any) {
    console.error('[test-smtp] Errore:', err);
    return NextResponse.json({ error: err.message || 'Impossibile inviare la mail di test. Verifica i parametri.' }, { status: 500 });
  }
}
