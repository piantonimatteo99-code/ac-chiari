import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { TENANTS, DEFAULT_TENANT_ID, TenantConfig } from '@/lib/tenants';

export const dynamic = 'force-dynamic';

const PIN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function buildPinEmailHtml(
  recipientName: string,
  requesterName: string,
  requesterEmail: string,
  pin: string,
  tenantConfig: TenantConfig
): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${tenantConfig.colors.primary} 0%,#3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">${tenantConfig.name}</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">🔐 Richiesta di Collegamento Familiare</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;color:#374151;margin:0 0 16px;">
        Ciao <strong>${recipientName}</strong>,<br/><br/>
        <strong>${requesterName}</strong> (<a href="mailto:${requesterEmail}" style="color:${tenantConfig.colors.primary};">${requesterEmail}</a>)
        vuole unirsi al tuo nucleo familiare su ${tenantConfig.name}.
      </p>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">
        Se conosci questa persona e fa parte della tua famiglia, <strong>comunica il seguente codice</strong> a ${requesterName}.
        Il codice scade tra <strong>1 ora</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <div style="display:inline-block;background:#f0f9ff;border:2px solid #bae6fd;border-radius:16px;padding:20px 40px;">
          <p style="margin:0 0 8px;font-size:12px;color:#0369a1;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Codice di accesso</p>
          <p style="margin:0;font-size:42px;font-weight:900;color:#0c4a6e;letter-spacing:8px;font-family:monospace;">${pin}</p>
        </div>
      </div>
      <div style="padding:16px;background:#fef9c3;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          ⚠️ Non condividere questo codice con estranei. Se non riconosci ${requesterName}, ignora questa email.
        </p>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} ${tenantConfig.name} — Sistema Gestione</p>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  try {
    initAdminApp();
    const db = adminDb;

    // ── Determina Tenant ───────────────────────────────────────────────────────
    const tenantId = request.headers.get('x-tenant-id') || DEFAULT_TENANT_ID;
    const tenantConfig = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];

    const body = await request.json();
    const {
      requesterId,
      requesterEmail,
      requesterName,
      targetMemberNome,
      targetMemberCognome,
      // Personal data to save on the requester's user doc when approved
      personalData,
    } = body;

    if (!requesterId || !requesterEmail || !requesterName || !targetMemberNome || !targetMemberCognome) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ── Search for a family member matching nome+cognome ─────────────────────
    const membriQuery = await db.collectionGroup('membri')
      .where('nome', '==', targetMemberNome)
      .where('cognome', '==', targetMemberCognome)
      .limit(5)
      .get();

    if (membriQuery.empty) {
      return NextResponse.json({
        error: `Nessun membro trovato con nome "${targetMemberNome} ${targetMemberCognome}". Controlla nome e cognome.`,
      }, { status: 404 });
    }

    // Get the family ID (parent of 'membri' subcollection)
    const memberDoc = membriQuery.docs[0];
    const familyId = memberDoc.ref.parent.parent?.id;
    if (!familyId) {
      return NextResponse.json({ error: 'Famiglia non trovata' }, { status: 404 });
    }

    // Don't allow linking to own family
    if (familyId === requesterId) {
      return NextResponse.json({ error: 'Sei già il capofamiglia di questo nucleo.' }, { status: 400 });
    }

    // ── Collect emails of all registered family members ───────────────────────
    const notifyEmails: { email: string; name: string }[] = [];

    const headDoc = await db.collection('users').doc(familyId).get();
    if (headDoc.exists) {
      const d = headDoc.data()!;
      if (d.email) notifyEmails.push({ email: d.email, name: d.displayName || `${d.nome || ''} ${d.cognome || ''}`.trim() || 'Capofamiglia' });
    }

    const linkedSnap = await db.collection('users').where('familyId', '==', familyId).get();
    for (const doc of linkedSnap.docs) {
      const m = doc.data();
      if (m.email && !notifyEmails.some(e => e.email === m.email)) {
        notifyEmails.push({ email: m.email, name: m.displayName || `${m.nome || ''} ${m.cognome || ''}`.trim() || 'Membro' });
      }
    }

    if (notifyEmails.length === 0) {
      return NextResponse.json({
        error: 'Nessun membro della famiglia ha un account registrato. Il codice non può essere inviato.',
      }, { status: 400 });
    }

    // ── Generate 6-digit PIN ──────────────────────────────────────────────────
    const pin = crypto.randomInt(100000, 999999).toString().padStart(6, '0');
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + PIN_EXPIRY_MS));

    // Store PIN (hashed) in Firestore, keyed by requesterId
    await db.collection('familyJoinPins').doc(requesterId).set({
      requesterId,
      requesterEmail,
      requesterName,
      targetFamilyId: familyId,
      pinHash,
      expiresAt,
      createdAt: Timestamp.now(),
      used: false,
      personalData: personalData ?? {},
    });

    // ── Send PIN emails ───────────────────────────────────────────────────────
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      // Dev mode — return PIN in response so you can test locally
      console.warn(`[family/send-pin] SMTP non configurato. PIN (DEV ONLY): ${pin}`);
      return NextResponse.json({
        success: true,
        devPin: pin,
        familyId,
        familyMemberFound: `${targetMemberNome} ${targetMemberCognome}`,
        notifiedCount: 0,
      });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    let sentCount = 0;
    for (const recipient of notifyEmails) {
      try {
        await transporter.sendMail({
          from: `"${tenantConfig.name}" <${smtpUser}>`,
          to: recipient.email,
          replyTo: tenantConfig.email,
          subject: `🔐 Codice di collegamento familiare — ${requesterName}`,
          html: buildPinEmailHtml(recipient.name, requesterName, requesterEmail, pin, tenantConfig),
        });
        sentCount++;
        console.log(`[family/send-pin] PIN inviato a ${recipient.email}`);
      } catch (mailErr) {
        console.error(`[family/send-pin] Errore invio a ${recipient.email}:`, mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      familyId,
      familyMemberFound: `${targetMemberNome} ${targetMemberCognome}`,
      notifiedCount: sentCount,
    });

  } catch (err: any) {
    console.error('[family/send-pin] Errore:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
