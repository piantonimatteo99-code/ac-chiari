import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { headers } from 'next/headers';
import { TENANTS, DEFAULT_TENANT_ID, TenantConfig } from '@/lib/tenants';

function buildApprovalEmailHtml(
  approverName: string,
  requesterName: string,
  requesterEmail: string,
  approvalUrl: string,
  rejectUrl: string,
  tenantConfig: TenantConfig
): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg, ${tenantConfig.colors.primary} 0%, #3b82f6 100%);padding:32px;color:white;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">${tenantConfig.name}</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">👨‍👩‍👧 Richiesta di Collegamento Familiare</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        Ciao <strong>${approverName}</strong>,<br/><br/>
        <strong>${requesterName}</strong> (<a href="mailto:${requesterEmail}" style="color:${tenantConfig.colors.primary};">${requesterEmail}</a>) 
        ha richiesto di essere collegato al tuo nucleo familiare su ${tenantConfig.name}.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
        Se conosci questa persona e fa parte della tua famiglia, clicca <strong>Approva</strong>.
        Altrimenti puoi ignorare questa email o cliccare <strong>Rifiuta</strong>.
      </p>
      <div style="display:flex;gap:12px;justify-content:center;margin:32px 0;">
        <a href="${approvalUrl}" style="display:inline-block;padding:14px 28px;background:#16a34a;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">
          ✅ Approva
        </a>
        <a href="${rejectUrl}" style="display:inline-block;padding:14px 28px;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">
          ❌ Rifiuta
        </a>
      </div>
      <div style="padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#92400e;">⚠️ Questo link scadrà tra 48 ore. Se non riconosci questa richiesta, ignorala.</p>
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

    const body = await request.json();
    const { requesterId, requesterEmail, requesterName, targetFamilyEmail } = body;

    if (!requesterId || !requesterEmail || !requesterName || !targetFamilyEmail) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ── Determina Tenant e Hostname Dinamici ──────────────────────────────────
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || DEFAULT_TENANT_ID;
    const tenantConfig = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];

    const host = headersList.get('host') || 'localhost:3000';
    const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const dynamicBaseUrl = `${proto}://${host}`;

    // Find the target family by email
    const usersSnap = await db.collection('users').where('email', '==', targetFamilyEmail).limit(1).get();
    if (usersSnap.empty) {
      return NextResponse.json({ error: `Nessun utente trovato con email: ${targetFamilyEmail}` }, { status: 404 });
    }

    const targetUserDoc = usersSnap.docs[0];
    const targetUser = targetUserDoc.data();
    const targetFamilyId = targetUserDoc.id; // UID of the family head

    // Find all users belonging to this family (familyId == targetFamilyId OR uid == targetFamilyId)
    const familyMembersSnap = await db.collection('users')
      .where('familyId', '==', targetFamilyId)
      .get();

    // Collect all emails to notify (head + linked members)
    const notifyEmails: { email: string; name: string; uid: string }[] = [];
    
    // Add the family head themselves
    if (targetUser.email) {
      notifyEmails.push({
        email: targetUser.email,
        name: targetUser.displayName || `${targetUser.nome || ''} ${targetUser.cognome || ''}`.trim() || 'Capofamiglia',
        uid: targetFamilyId,
      });
    }
    
    // Add other linked members
    for (const memberDoc of familyMembersSnap.docs) {
      const m = memberDoc.data();
      if (m.email && m.email !== targetUser.email) {
        notifyEmails.push({
          email: m.email,
          name: m.displayName || `${m.nome || ''} ${m.cognome || ''}`.trim() || 'Membro',
          uid: memberDoc.id,
        });
      }
    }

    if (notifyEmails.length === 0) {
      return NextResponse.json({ error: 'Impossibile trovare gli indirizzi email dei familiari' }, { status: 500 });
    }

    // Create the join request document with a secure token (48h expiry)
    const approvalToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 48 * 60 * 60 * 1000));

    if (!adminDb) {
      return NextResponse.json({ error: 'DB admin non disponibile' }, { status: 500 });
    }

    const requestRef = await db.collection('familyJoinRequests').add({
      requesterId,
      requesterEmail,
      requesterName,
      targetFamilyId,
      targetFamilyEmail,
      status: 'pending',
      createdAt: Timestamp.now(),
      approvedBy: [],
      approvalToken,
      tokenExpiresAt: expiresAt,
    });

    // Send approval emails
    const smtpUser = process.env.SMTP_USER;
    const smtpPassword = process.env.SMTP_PASSWORD;

    if (!smtpUser || !smtpPassword) {
      console.warn('[family] SMTP non configurato. Richiesta creata ma email non inviata.');
      return NextResponse.json({ success: true, skipped: true, requestId: requestRef.id });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPassword },
    });

    // Send to each family member
    for (const recipient of notifyEmails) {
      const approvalUrl = `${dynamicBaseUrl}/api/family/approve-join?token=${approvalToken}&action=approve`;
      const rejectUrl = `${dynamicBaseUrl}/api/family/approve-join?token=${approvalToken}&action=reject`;

      const html = buildApprovalEmailHtml(
        recipient.name,
        requesterName,
        requesterEmail,
        approvalUrl,
        rejectUrl,
        tenantConfig
      );

      try {
        await transporter.sendMail({
          from: `"${tenantConfig.name}" <${smtpUser}>`,
          to: recipient.email,
          replyTo: tenantConfig.email,
          subject: `👨‍👩‍👧 ${requesterName} vuole unirsi al tuo nucleo familiare`,
          html,
        });
        console.log(`[family] Email approvazione inviata a ${recipient.email}`);
      } catch (mailErr) {
        console.error(`[family] Errore invio a ${recipient.email}:`, mailErr);
      }
    }

    return NextResponse.json({ success: true, requestId: requestRef.id, notifiedCount: notifyEmails.length });

  } catch (err: any) {
    console.error('[family/request-join] Errore:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
