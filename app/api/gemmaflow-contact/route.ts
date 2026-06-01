import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// ─── CORS headers per gemmaflow.it ───────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://gemmaflow.it',
  'https://www.gemmaflow.it',
  'http://localhost:3000', // sviluppo locale
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ─── Preflight OPTIONS ────────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Campi obbligatori mancanti' },
        { status: 400, headers }
      );
    }

    // ── Controlla SMTP ──────────────────────────────────────────────────────
    const smtpUser = process.env.GEMMAFLOW_SMTP_USER;
    const smtpPassword = process.env.GEMMAFLOW_SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      console.error('[gemmaflow-contact] SMTP non configurato');
      return NextResponse.json(
        { success: false, error: 'Configurazione server mancante' },
        { status: 500, headers }
      );
    }

    // ── Invia email ─────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const today = new Date().toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const htmlBody = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:32px;color:white;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">gemmaflow.it</p>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;">✉️ Nuova richiesta di contatto</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:600;width:140px;">Nome e Cognome</td>
          <td style="padding:10px 0;font-size:15px;color:#111827;">${name}</td>
        </tr>
        <tr style="border-top:1px solid #f3f4f6;">
          <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:600;">Email di contatto</td>
          <td style="padding:10px 0;font-size:15px;color:#111827;"><a href="mailto:${email}" style="color:#1d4ed8;">${email}</a></td>
        </tr>
        <tr style="border-top:1px solid #f3f4f6;">
          <td style="padding:10px 0;font-size:13px;color:#6b7280;font-weight:600;vertical-align:top;">Messaggio</td>
          <td style="padding:10px 0;font-size:15px;color:#111827;line-height:1.6;">${message.replace(/\n/g, '<br/>')}</td>
        </tr>
      </table>
      <div style="margin-top:24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#1d4ed8;">💡 Puoi rispondere direttamente a questa email — il client risponderà a <strong>${email}</strong></p>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} gemmaflow.it — Modulo di contatto</p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
      from: `"gemmaflow.it" <${smtpUser}>`,
      to: smtpUser,   // piantonimatteo.99@gmail.com riceve a se stesso
      replyTo: email,
      subject: `[gemmaflow.it] Nuova richiesta di contatto da ${name}`,
      html: htmlBody,
    });

    console.log(`[gemmaflow-contact] ✅ Email inviata da ${name} <${email}>`);
    return NextResponse.json({ success: true }, { headers });

  } catch (err: any) {
    console.error('[gemmaflow-contact] Errore:', err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500, headers }
    );
  }
}
