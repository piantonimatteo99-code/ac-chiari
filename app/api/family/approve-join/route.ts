import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

// Force dynamic rendering (uses request.url at runtime)
export const dynamic = 'force-dynamic';

function buildConfirmationEmailHtml(requesterName: string, approved: boolean, loginUrl: string): string {
  const color = approved ? '#16a34a' : '#dc2626';
  const icon = approved ? '✅' : '❌';
  const title = approved ? 'Collegamento al Nucleo Approvato!' : 'Richiesta di Collegamento Rifiutata';
  const msg = approved
    ? 'La tua richiesta di collegamento al nucleo familiare è stata approvata. Puoi ora accedere all\'app e vedere il tuo nucleo familiare.'
    : 'La tua richiesta di collegamento al nucleo familiare è stata rifiutata. Se pensi sia un errore, contatta il tuo familiare.';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">AC Chiari</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;">${icon} ${title}</h1>
    </div>
    <div style="padding:32px;text-align:center;">
      <p style="font-size:15px;color:#374151;margin-bottom:24px;">
        Ciao <strong>${requesterName}</strong>,<br/><br/>${msg}
      </p>
      ${approved ? `<a href="${loginUrl}" style="display:inline-block;padding:14px 28px;background:${color};color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">Vai al Login</a>` : ''}
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} AC Chiari — Sistema Gestione</p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    initAdminApp();
    const db = admin.firestore();

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const action = searchParams.get('action'); // 'approve' | 'reject'

    if (!token || !action) {
      return new NextResponse(renderPage('Errore', 'Link non valido o incompleto.', false), {
        headers: { 'Content-Type': 'text/html' },
        status: 400,
      });
    }

    // Find the request document by token
    const snap = await db.collection('familyJoinRequests')
      .where('approvalToken', '==', token)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (snap.empty) {
      return new NextResponse(renderPage(
        'Link non valido',
        'Questo link è già stato utilizzato, è scaduto, o non è valido.',
        false
      ), { headers: { 'Content-Type': 'text/html' } });
    }

    const requestDoc = snap.docs[0];
    const reqData = requestDoc.data();

    // Check expiry
    const expiresAt = reqData.tokenExpiresAt as admin.firestore.Timestamp;
    if (expiresAt.toDate() < new Date()) {
      return new NextResponse(renderPage(
        'Link scaduto',
        'Questo link è scaduto (valido 48 ore). Il richiedente dovrà re-inviare la richiesta.',
        false
      ), { headers: { 'Content-Type': 'text/html' } });
    }

    const approved = action === 'approve';

    // Update the request status
    await requestDoc.ref.update({
      status: approved ? 'approved' : 'rejected',
      resolvedAt: Timestamp.now(),
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://olicachiari.vercel.app');

    if (approved) {
      // Set familyId on the requester's user document
      await db.collection('users').doc(reqData.requesterId).update({
        familyId: reqData.targetFamilyId,
      });
      console.log(`[family/approve] ${reqData.requesterId} collegato a famiglia ${reqData.targetFamilyId}`);
    }

    // Send notification email to the requester
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    if (smtpUser && smtpPassword) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPassword },
      });

      try {
        await transporter.sendMail({
          from: `"AC Chiari" <${smtpUser}>`,
          to: reqData.requesterEmail,
          subject: approved
            ? '✅ Sei stato aggiunto al nucleo familiare su AC Chiari!'
            : '❌ Richiesta di collegamento familiare rifiutata',
          html: buildConfirmationEmailHtml(reqData.requesterName, approved, `${baseUrl}/login`),
        });
      } catch (mailErr) {
        console.error('[family/approve] Errore invio email confermata:', mailErr);
      }
    }

    // Return success page
    return new NextResponse(renderPage(
      approved ? '✅ Richiesta Approvata' : '❌ Richiesta Rifiutata',
      approved
        ? `${reqData.requesterName} è stato collegato al nucleo familiare con successo. Riceverà una email di conferma.`
        : `La richiesta di ${reqData.requesterName} è stata rifiutata. Riceverà una email di notifica.`,
      true,
      `${baseUrl}/dashboard`
    ), { headers: { 'Content-Type': 'text/html' } });

  } catch (err: any) {
    console.error('[family/approve-join] Errore:', err.message);
    return new NextResponse(renderPage('Errore', err.message, false), {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }
}

function renderPage(title: string, message: string, success: boolean, redirectUrl?: string): string {
  const color = success ? '#16a34a' : '#dc2626';
  const bg = success ? '#f0fdf4' : '#fef2f2';
  const border = success ? '#86efac' : '#fca5a5';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — AC Chiari</title>
  ${redirectUrl ? `<meta http-equiv="refresh" content="4;url=${redirectUrl}"/>` : ''}
  <style>body{margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style>
</head>
<body>
  <div style="max-width:480px;width:100%;margin:24px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.10);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1d4ed8,#3b82f6);padding:28px;color:white;text-align:center;">
      <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">AC Chiari</p>
      <h1 style="margin:8px 0 0;font-size:20px;">${title}</h1>
    </div>
    <div style="padding:28px;background:${bg};border:1px solid ${border};border-radius:0 0 16px 16px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">${message}</p>
      ${redirectUrl ? `<p style="margin:0;font-size:13px;color:#6b7280;">Verrai reindirizzato alla dashboard tra pochi secondi...</p>
      <a href="${redirectUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:${color};color:#fff;text-decoration:none;font-weight:600;border-radius:8px;">Vai ora →</a>` : ''}
    </div>
  </div>
</body>
</html>`;
}
