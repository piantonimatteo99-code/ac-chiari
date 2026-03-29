import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp } from '@/lib/firebase-admin';

function buildPasswordResetEmailHtml(resetLink: string): string {
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">AC Chiari</p>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;">🔒 Reimposta la tua password</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="margin:0 0 20px;font-size:16px;color:#374151;text-align:left;">
        Ciao,<br/><br/>
        Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su AC Chiari. Se non sei stato tu a farne richiesta, puoi ignorare in sicurezza questa email.
      </p>
      
      <div style="margin: 32px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:14px 32px;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;border-radius:8px;box-shadow:0 4px 12px rgba(29,78,216,0.3);">Reimposta la tua Password</a>
      </div>
      
      <div style="margin-top:32px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;text-align:left;">
        <p style="margin:0 0 8px;font-size:13px;color:#92400e;font-weight:600;">⚠️ Se il pulsante non funziona, copia e incolla il seguente link nel tuo browser:</p>
        <a href="${resetLink}" style="color:#b45309;font-size:12px;word-break:break-all;">${resetLink}</a>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} AC Chiari — Sistema Gestione</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email mancante' }, { status: 400 });
    }

    // Controlla se utente esiste
    try {
      await admin.auth().getUserByEmail(email);
    } catch (userErr: any) {
      return NextResponse.json({ error: 'Nessun utente trovato', code: 'auth/user-not-found' }, { status: 404 });
    }

    // Controlla SMTP
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      console.warn('[email] SMTP non configurato. Salto invio email di reset personalizzata.');
      return NextResponse.json({ success: true, skipped: true, reason: 'SMTP non configurato' });
    }

    const actionCodeSettings = {
      url: process.env.NEXT_PUBLIC_BASE_URL 
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/login` 
        : 'https://azionecattolicachiari.vercel.app/login',
      handleCodeInApp: false
    };

    let resetLink = '';
    try {
      resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    } catch (firebaseErr: any) {
      console.error('[email] Errore generazione link reset Password:', firebaseErr.message);
      return NextResponse.json({ error: 'Impossibile generare il link di reset' }, { status: 500 });
    }

    // Invia email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const htmlBody = buildPasswordResetEmailHtml(resetLink);

    await transporter.sendMail({
      from: `"AC Chiari" <${smtpUser}>`,
      to: email,
      subject: '🔒 Reimposta la tua password su AC Chiari',
      html: htmlBody,
    });

    console.log('[email] ✅ Email di reset password inviata a', email);
    return NextResponse.json({ success: true, sentTo: email });

  } catch (err: any) {
    console.error('[email] Errore invio reset password:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
