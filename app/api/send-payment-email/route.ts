import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp } from '@/lib/firebase-admin';

// ─── Tipi ────────────────────────────────────────────────────────────────────

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

interface PendingEmail {
  items: PaymentItem[];
  timer: NodeJS.Timeout;
  paymentMethod: 'bonifico' | 'contanti';
  paymentId?: string;
  receiptUrl?: string;
}

// ─── Debounce state (module-level, persiste tra le richieste) ─────────────────

const DEBOUNCE_MS = 30_000; // 30 secondi

/** Una entry per ogni capofamiglia: accumula i pagamenti e resetta il timer */
const pendingEmails = new Map<string, PendingEmail>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getFamilyHeadEmail(uid: string): Promise<{ email: string; displayName: string } | null> {
  const db = admin.firestore();

  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    const data = userDoc.data()!;
    const email = data.email as string | undefined;
    const displayName = (data.displayName || `${data.nome || ''} ${data.cognome || ''}`.trim() || 'Genitore') as string;
    if (email) return { email, displayName };
  }

  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.email) {
      return { email: authUser.email, displayName: authUser.displayName || 'Genitore' };
    }
  } catch {
    console.warn(`Could not get Firebase Auth user for uid: ${uid}`);
  }

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
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.memberName}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.raccoltaNome}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${item.phase}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: right; font-weight: 600;">€ ${parseFloat(item.amount).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const receiptSection =
    paymentMethod === 'bonifico' && receiptUrl
      ? `
      <div style="margin-top: 20px; padding: 16px; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #166534; font-weight: 600;">📎 Ricevuta allegata</p>
        <a href="${receiptUrl}" style="color: #16a34a; font-size: 13px; word-break: break-all;">${receiptUrl}</a>
      </div>`
      : '';

  const paymentIdSection =
    paymentMethod === 'bonifico' && paymentId
      ? `<p style="margin: 4px 0; color: #6b7280; font-size: 13px;">ID Pagamento: <strong>${paymentId}</strong> &mdash; Causale: <strong>ACR - ${paymentId}</strong></p>`
      : '';

  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0; padding:0; background-color:#f9fafb; font-family: Inter, Arial, sans-serif;">
  <div style="max-width:600px; margin:40px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); padding: 32px 32px 24px; color: white;">
      <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">AC Chiari</p>
      <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700;">✅ Pagamento Confermato</h1>
      <p style="margin: 0; font-size: 14px; opacity: 0.85;">${today}</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="margin: 0 0 20px; font-size: 15px; color: #374151;">
        Ciao <strong>${displayName}</strong>,<br/>
        abbiamo ricevuto un pagamento per i seguenti componenti della tua famiglia:
      </p>

      <!-- Method badge -->
      <div style="display:inline-block; background-color:#eff6ff; border:1px solid #bfdbfe; border-radius:20px; padding:6px 14px; margin-bottom:20px;">
        <span style="font-size:13px; color:#1d4ed8; font-weight:600;">${methodIcon} ${methodLabel}</span>
      </div>

      ${paymentIdSection}

      <!-- Table -->
      <table style="width:100%; border-collapse:collapse; margin-top:16px; border-radius:8px; overflow:hidden; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background-color:#f3f4f6;">
            <th style="padding:10px 16px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Membro</th>
            <th style="padding:10px 16px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Progetto</th>
            <th style="padding:10px 16px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Fase</th>
            <th style="padding:10px 16px; text-align:right; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Importo</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background-color:#f9fafb;">
            <td colspan="3" style="padding:12px 16px; font-weight:700; font-size:14px; color:#111827;">Totale</td>
            <td style="padding:12px 16px; font-weight:700; font-size:15px; color:#1d4ed8; text-align:right;">€ ${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      ${receiptSection}

      <!-- Info box -->
      <div style="margin-top:24px; padding:16px; background-color:#fefce8; border:1px solid #fde68a; border-radius:8px;">
        <p style="margin:0; font-size:13px; color:#92400e;">
          ℹ️ Questa email è generata automaticamente dal sistema di AC Chiari. 
          Per qualsiasi domanda, contatta il tuo educatore di riferimento.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb; text-align:center;">
      <p style="margin:0; font-size:12px; color:#9ca3af;">© ${new Date().getFullYear()} AC Chiari — Sistema Gestione Pagamenti</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(familyHeadId: string, pending: PendingEmail): Promise<void> {
  const smtpUser = process.env.SMTP_USER!;
  const smtpPassword = process.env.SMTP_PASSWORD!;

  const familyHead = await getFamilyHeadEmail(familyHeadId);
  if (!familyHead) {
    console.warn(`Email del capofamiglia non trovata per uid: ${familyHeadId}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPassword },
  });

  const htmlBody = buildEmailHtml(
    familyHead.displayName,
    pending.items,
    pending.paymentMethod,
    pending.paymentId,
    pending.receiptUrl
  );

  const subject =
    pending.paymentMethod === 'bonifico'
      ? `✅ Pagamento confermato — ACR-${pending.paymentId}`
      : `✅ ${pending.items.length > 1 ? `${pending.items.length} pagamenti registrati` : 'Pagamento registrato'}`;

  await transporter.sendMail({
    from: `"AC Chiari" <${smtpUser}>`,
    to: familyHead.email,
    subject,
    html: htmlBody,
  });

  console.log(`[email] Inviata a ${familyHead.email} — ${pending.items.length} voci per familyHeadId=${familyHeadId}`);
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

    // Se SMTP non configurato, salta silenziosamente
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;
    if (!smtpUser || !smtpPassword) {
      console.warn('SMTP non configurato — email non inviata.');
      return NextResponse.json({ success: true, skipped: true, reason: 'SMTP non configurato' });
    }

    // ── Debounce: accorpa pagamenti della stessa famiglia entro 30 secondi ──
    const existing = pendingEmails.get(familyHeadId);

    if (existing) {
      // Cancella il timer precedente e aggiungi i nuovi pagamenti
      clearTimeout(existing.timer);
      existing.items.push(...paymentItems);
      // Aggiorna receipt/paymentId se arriva un bonifico
      if (paymentMethod === 'bonifico') {
        existing.paymentMethod = 'bonifico';
        if (paymentId) existing.paymentId = paymentId;
        if (receiptUrl) existing.receiptUrl = receiptUrl;
      }
      console.log(`[email] Pagamento aggiunto alla coda di ${familyHeadId} (${existing.items.length} voci totali) — timer azzerato`);
    } else {
      // Prima voce per questa famiglia: crea la entry
      const entry: PendingEmail = {
        items: [...paymentItems],
        paymentMethod,
        paymentId,
        receiptUrl,
        timer: null as any,
      };
      pendingEmails.set(familyHeadId, entry);
      console.log(`[email] Nuova coda per ${familyHeadId} — attesa ${DEBOUNCE_MS / 1000}s prima dell'invio`);
    }

    // (Re)imposta il timer a 30 secondi
    const pending = pendingEmails.get(familyHeadId)!;
    pending.timer = setTimeout(async () => {
      pendingEmails.delete(familyHeadId);
      try {
        await sendEmail(familyHeadId, pending);
      } catch (err: any) {
        console.error(`[email] Errore invio per ${familyHeadId}:`, err.message);
      }
    }, DEBOUNCE_MS);

    return NextResponse.json({
      success: true,
      queued: true,
      queueSize: pendingEmails.get(familyHeadId)?.items.length ?? paymentItems.length,
      willSendIn: `${DEBOUNCE_MS / 1000}s`,
    });

  } catch (err: any) {
    console.error('Errore API send-payment-email:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
