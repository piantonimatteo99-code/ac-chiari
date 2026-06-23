import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp, adminDb, getSMTPOptions } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { TENANTS, DEFAULT_TENANT_ID, TenantConfig } from '@/lib/tenants';

function buildRegistrationEmailHtml(nome: string, displayName: string, verificationLink: string, tenantConfig: TenantConfig): string {
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  // Usa il nome breve (solo il primo nome) per il saluto, altrimenti il displayName completo
  const greeting = nome?.trim() || displayName;

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg, ${tenantConfig.colors.primary} 0%, #3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">${tenantConfig.name}</p>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;">👋 Benvenuto in ${tenantConfig.name}!</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="margin:0 0 20px;font-size:16px;color:#374151;text-align:left;">
        Ciao <strong>${greeting}</strong>,<br/><br/>
        Siamo felici di averti con noi! Per completare la creazione del tuo account e accedere alla piattaforma, ti preghiamo di confermare il tuo indirizzo email cliccando sul pulsante qui sotto.
      </p>

      <div style="margin: 32px 0;">
        <a href="${verificationLink}" style="display:inline-block;padding:14px 32px;background:${tenantConfig.colors.primary};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;box-shadow:0 4px 12px rgba(29,78,216,0.3);">✉️ Conferma la tua Email</a>
      </div>

      <div style="margin-top:32px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;text-align:left;">
        <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:600;">⚠️ Se il pulsante non funziona, copia e incolla il seguente link nel tuo browser:</p>
        <a href="${verificationLink}" style="color:#b45309;font-size:12px;word-break:break-all;">${verificationLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:500;">A presto,<br/><strong>Azione Cattolica ${tenantConfig.name}</strong></p>
      <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} ${tenantConfig.name} — Sistema Gestione</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    const body = await request.json();
    const { email, displayName, nome, cognome, uid } = body;

    if (!email || !displayName) {
      return NextResponse.json({ error: 'Dati mancanti (email o displayName)' }, { status: 400 });
    }

    // ── Determina Tenant e Hostname Dinamici ──────────────────────────────────
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || DEFAULT_TENANT_ID;
    const tenantConfig = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];

    console.log(`[email] Tenant rilevato: ${tenantId}`);

    const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000';
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const dynamicBaseUrl = `${proto}://${host}`;

    // ── Crea documento utente su Firestore PRIMA di qualsiasi altra cosa ──────
    // (garantisce che l'utente esista nel database corretto del tenant anche se SMTP fallisce)
    if (uid && adminDb) {
      try {
        const userRef = adminDb.collection('users').doc(uid);
        const existing = await userRef.get();
        if (!existing.exists) {
          await userRef.set({
            id: uid,
            nome: nome || '',
            cognome: cognome || '',
            displayName: displayName,
            email: email,
            roles: ['utente'],
            createdAt: Timestamp.now(),
          });
          console.log(`[email] ✅ Documento utente creato su Firestore (tenant: ${tenantId}) per uid: ${uid}`);
        } else {
          const data = existing.data()!;
          if (!data.nome && !data.cognome) {
            await userRef.update({
              nome: nome || '',
              cognome: cognome || '',
              displayName: displayName,
            });
          }
          console.log(`[email] ℹ️ Documento utente già esistente in Firestore (tenant: ${tenantId})`);
        }
      } catch (fsErr: any) {
        console.warn('[email] Scrittura documento utente fallita (non bloccante):', fsErr.message);
      }
    }

    // ── Controlla SMTP ────────────────────────────────────────────────────────
    const smtpOptions = await getSMTPOptions(tenantId);

    if (!smtpOptions.auth.user || !smtpOptions.auth.pass) {
      console.warn('[email] SMTP non configurato per il tenant', tenantId, '. Ritorno fallback per usare Firebase email verification.');
      return NextResponse.json({ 
        error: 'SMTP non configurato', 
        fallback: true, 
        userDocCreated: !!uid 
      }, { status: 500 });
    }

    // ── Genera link di verifica ──────────────────────────────────────────────
    // NOTA: NON usiamo continueUrl nelle ActionCodeSettings perché richiede che
    // il dominio sia autorizzato in Firebase Console (Authentication > Settings).
    // Generiamo il link senza continueUrl, poi sostituiamo il dominio base
    // con quello del tenant corrente nel link generato.
    let verificationLink = '';
    try {
      // Genera il link senza continueUrl (funziona su tutti i domini)
      verificationLink = await admin.auth().generateEmailVerificationLink(email);
      console.log('[email] ✅ Link di verifica generato per:', email);

      // Sostituisce il dominio __/auth/action di Firebase con la nostra pagina custom
      // es: https://ac-chiari-import-2024.firebaseapp.com/__/auth/action?... 
      //  → https://acbrescia.gemmaflow.it/auth/action?...
      if (verificationLink) {
        verificationLink = verificationLink.replace(
          /https:\/\/[^/]+\/__\/auth\/action/,
          `${dynamicBaseUrl}/auth/action`
        );
      }
    } catch (firebaseErr: any) {
      console.error('[email] Errore generazione link di verifica Firebase:', firebaseErr.message);
      return NextResponse.json({ 
        error: 'Impossibile generare il link di verifica', 
        detail: firebaseErr.message 
      }, { status: 500 });
    }

    // ── Invia email ───────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport(smtpOptions);

    const htmlBody = buildRegistrationEmailHtml(nome || '', displayName, verificationLink, tenantConfig);

    await transporter.sendMail({
      from: `"${tenantConfig.name}" <${smtpOptions.auth.user}>`,
      to: email,
      replyTo: tenantConfig.email,
      subject: `👋 Conferma la tua registrazione su ${tenantConfig.name}`,
      html: htmlBody,
    });

    console.log('[email] ✅ Email di registrazione inviata a', email);

    // (Il documento utente è già stato creato prima del controllo SMTP)

    // ── Notifica admin: nuovo utente registrato ───────────────────────────────
    try {
      if (adminDb) {
        await adminDb.collection('notifiche').add({
          userId: '__admin__',
          title: `🆕 Nuovo utente registrato`,
          body: `${displayName} (${email}) si è appena registrato.`,
          type: 'generale',
          href: '/admin/gestione-utenti',
          letta: false,
          eventType: 'nuovo_utente',
          createdAt: Timestamp.now(),
        });
      }
    } catch (notifErr) {
      console.warn('[email] Notifica admin fallita (non bloccante):', notifErr);
    }

    return NextResponse.json({ success: true, sentTo: email });

  } catch (err: any) {
    console.error('[email] Errore invio registrazione:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
