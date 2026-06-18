import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp } from '@/lib/firebase-admin';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

function buildRegistrationEmailHtml(nome: string, displayName: string, verificationLink: string): string {
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
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">AC Chiari</p>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;">👋 Benvenuto in AC Chiari!</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="margin:0 0 20px;font-size:16px;color:#374151;text-align:left;">
        Ciao <strong>${greeting}</strong>,<br/><br/>
        Siamo felici di averti con noi! Per completare la creazione del tuo account e accedere alla piattaforma, ti preghiamo di confermare il tuo indirizzo email cliccando sul pulsante qui sotto.
      </p>

      <div style="margin: 32px 0;">
        <a href="${verificationLink}" style="display:inline-block;padding:14px 32px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;box-shadow:0 4px 12px rgba(29,78,216,0.3);">✉️ Conferma la tua Email</a>
      </div>

      <div style="margin-top:32px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;text-align:left;">
        <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:600;">⚠️ Se il pulsante non funziona, copia e incolla il seguente link nel tuo browser:</p>
        <a href="${verificationLink}" style="color:#b45309;font-size:12px;word-break:break-all;">${verificationLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#374151;font-weight:500;">A presto,<br/><strong>Azione Cattolica Chiari</strong></p>
      <p style="margin:8px 0 0;font-size:11px;color:#9ca3af;">© ${new Date().getFullYear()} AC Chiari — Sistema Gestione</p>
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

    // ── Controlla SMTP ────────────────────────────────────────────────────────
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      console.warn('[email] SMTP non configurato. Salto invio email di registrazione personalizzata.');
      return NextResponse.json({ success: true, skipped: true, reason: 'SMTP non configurato' });
    }

    // Generate Firebase verification link.
    // With handleCodeInApp: false (default), Firebase's hosted page handles the oobCode
    // and then redirects to `url` (our continueUrl). Our /auth/action page then shows
    // a branded success message and redirects to /login.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

    const actionCodeSettings: admin.auth.ActionCodeSettings | undefined = baseUrl
      ? {
          url: `${baseUrl}/auth/action`,
          // handleCodeInApp: false (default) — Firebase hosted page handles the code,
          // then redirects to our continueUrl. handleCodeInApp:true is for mobile apps only.
        }
      : undefined;

    let verificationLink = '';
    try {
      verificationLink = await admin.auth().generateEmailVerificationLink(
        email,
        actionCodeSettings ?? undefined
      );

      // Bypassa la pagina predefinita di Firebase reindirizzando direttamente alla nostra pagina custom /auth/action
      if (verificationLink && baseUrl) {
        verificationLink = verificationLink.replace(
          /https:\/\/[^/]+\/__\/auth\/action/,
          `${baseUrl}/auth/action`
        );
      }
    } catch (firebaseErr: any) {
      console.error('[email] Errore generazione link Firebase:', firebaseErr.message);
      return NextResponse.json({ error: 'Impossibile generare il link di verifica' }, { status: 500 });
    }

    // ── Invia email ───────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const htmlBody = buildRegistrationEmailHtml(nome || '', displayName, verificationLink);

    await transporter.sendMail({
      from: `"AC Chiari" <${smtpUser}>`,
      to: email,
      subject: '👋 Conferma la tua registrazione su AC Chiari',
      html: htmlBody,
    });

    console.log('[email] ✅ Email di registrazione inviata a', email);

    // ── Crea documento utente su Firestore via Admin SDK (affidabile, bypassa le rules) ──
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
          console.log('[email] ✅ Documento utente creato su Firestore per', uid);
        } else {
          // Aggiorna solo nome/cognome se vuoti
          const data = existing.data()!;
          if (!data.nome && !data.cognome) {
            await userRef.update({
              nome: nome || '',
              cognome: cognome || '',
              displayName: displayName,
            });
          }
        }
      } catch (fsErr: any) {
        console.warn('[email] Scrittura documento utente fallita (non bloccante):', fsErr.message);
      }
    }

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
