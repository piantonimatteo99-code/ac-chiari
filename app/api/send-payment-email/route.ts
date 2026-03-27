import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp } from '@/lib/firebase-admin';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface PaymentItem {
  memberName: string;
  raccoltaNome: string;
  phase: string;
  amount: string;
}

interface EmailPayload {
  familyHeadId: string;
  paymentItems: PaymentItem[];
  paymentId?: string;
  receiptUrl?: string;
  paymentMethod: 'bonifico' | 'contanti';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFamilyHeadEmail(uid: string): Promise<{ email: string; displayName: string } | null> {
  const db = admin.firestore();

  // ── Step 1: lookup diretto in users/{uid} ────────────────────────────────
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    const data = userDoc.data()!;
    const email = data.email as string | undefined;
    const displayName = (
      data.displayName ||
      `${data.nome || ''} ${data.cognome || ''}`.trim() ||
      'Genitore'
    ) as string;
    if (email) return { email, displayName };
  }

  // ── Step 2: uid potrebbe essere l'ID del documento "famiglie", non l'UID utente.
  // Le famiglie create da admin possono avere doc-id != uidCapofamiglia.
  // Leggiamo famiglie/{uid}.uidCapofamiglia e riproviamo. ────────────────────
  try {
    const famigliaDoc = await db.collection('famiglie').doc(uid).get();
    if (famigliaDoc.exists) {
      const famigliaData = famigliaDoc.data()!;
      const uidCapofamiglia = famigliaData.uidCapofamiglia as string | undefined;
      if (uidCapofamiglia && uidCapofamiglia !== uid) {
        // Ora cerchiamo il vero capofamiglia
        const capDoc = await db.collection('users').doc(uidCapofamiglia).get();
        if (capDoc.exists) {
          const data = capDoc.data()!;
          const email = data.email as string | undefined;
          const displayName = (
            data.displayName ||
            `${data.nome || ''} ${data.cognome || ''}`.trim() ||
            'Genitore'
          ) as string;
          if (email) return { email, displayName };
        }
        // Fallback Auth per uidCapofamiglia
        try {
          const authUser = await admin.auth().getUser(uidCapofamiglia);
          if (authUser.email) {
            return { email: authUser.email, displayName: authUser.displayName || 'Genitore' };
          }
        } catch {
          console.warn(`[email] Auth lookup fallito per uidCapofamiglia: ${uidCapofamiglia}`);
        }
      }
    }
  } catch (e) {
    console.warn(`[email] Lookup famiglie fallito per uid: ${uid}`, e);
  }

  // ── Step 3: ultimo tentativo — Firebase Auth diretto ─────────────────────
  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.email) {
      return { email: authUser.email, displayName: authUser.displayName || 'Genitore' };
    }
  } catch {
    console.warn(`[email] Auth user non trovato per uid: ${uid}`);
  }

  console.error(`[email] ❌ Impossibile trovare email per uid: ${uid}`);
  return null;
}

function buildEmailHtml(
  displayName: string,
  paymentItems: PaymentItem[],
  paymentMethod: 'bonifico' | 'contanti',
  paymentId?: string,
  receiptUrl?: string
): string {
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const total = paymentItems.reduce((sum, item) => sum + parseFloat(item.amount || '0'), 0);
  const methodLabel = paymentMethod === 'bonifico' ? 'Bonifico Bancario' : 'Pagamento in Contanti';
  const methodIcon = paymentMethod === 'bonifico' ? '🏦' : '💵';

  const rows = paymentItems
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;">${item.memberName}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;">${item.raccoltaNome}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;">${item.phase}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;">€ ${parseFloat(item.amount).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const receiptSection =
    paymentMethod === 'bonifico' && receiptUrl
      ? `<div style="margin-top:20px;padding:16px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;">
           <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:600;">📎 Ricevuta allegata</p>
           <a href="${receiptUrl}" style="color:#16a34a;font-size:13px;word-break:break-all;">${receiptUrl}</a>
         </div>`
      : '';

  const paymentIdSection =
    paymentMethod === 'bonifico' && paymentId
      ? `<p style="margin:4px 0;color:#6b7280;font-size:13px;">ID Pagamento: <strong>${paymentId}</strong> &mdash; Causale: <strong>ACR-${paymentId}</strong></p>`
      : '';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%);padding:32px;color:white;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">AC Chiari</p>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;">✅ Pagamento Confermato</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Ciao <strong>${displayName}</strong>,<br/>
        abbiamo ricevuto un pagamento per i seguenti componenti della tua famiglia:
      </p>
      <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:6px 14px;margin-bottom:20px;">
        <span style="font-size:13px;color:#1d4ed8;font-weight:600;">${methodIcon} ${methodLabel}</span>
      </div>
      ${paymentIdSection}
      <table style="width:100%;border-collapse:collapse;margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Membro</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Progetto</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Fase</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Importo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f9fafb;">
            <td colspan="3" style="padding:12px 16px;font-weight:700;font-size:14px;color:#111827;">Totale</td>
            <td style="padding:12px 16px;font-weight:700;font-size:15px;color:#1d4ed8;text-align:right;">€ ${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${receiptSection}
      <div style="margin-top:24px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#92400e;">ℹ️ Email generata automaticamente dal sistema di AC Chiari. Per domande, contatta il tuo educatore.</p>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} AC Chiari — Sistema Gestione Pagamenti</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    const body: EmailPayload = await request.json();
    const { familyHeadId, paymentItems, paymentId, receiptUrl, paymentMethod } = body;

    if (!familyHeadId || !paymentItems || paymentItems.length === 0) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ── Controlla SMTP ────────────────────────────────────────────────────────
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      console.warn('[email] SMTP non configurato (SMTP_USER / SMTP_PASSWORD mancanti nelle env vars)');
      return NextResponse.json({ success: true, skipped: true, reason: 'SMTP non configurato' });
    }

    // ── Recupera email capofamiglia ───────────────────────────────────────────
    const familyHead = await getFamilyHeadEmail(familyHeadId);
    if (!familyHead) {
      console.warn(`[email] Email non trovata per uid: ${familyHeadId}`);
      return NextResponse.json({ success: true, skipped: true, reason: 'Email capofamiglia non trovata' });
    }

    // ── Invia email ───────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const htmlBody = buildEmailHtml(
      familyHead.displayName,
      paymentItems,
      paymentMethod,
      paymentId,
      receiptUrl
    );

    const subject =
      paymentMethod === 'bonifico'
        ? `✅ Pagamento confermato — ACR-${paymentId}`
        : `✅ Pagamento in contanti registrato`;

    await transporter.sendMail({
      from: `"AC Chiari" <${smtpUser}>`,
      to: familyHead.email,
      subject,
      html: htmlBody,
    });

    console.log(`[email] ✅ Inviata a ${familyHead.email} — ${paymentItems.length} voci`);
    return NextResponse.json({ success: true, sentTo: familyHead.email });

  } catch (err: any) {
    console.error('[email] Errore invio:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
