import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { initAdminApp, adminDb, getSMTPOptions } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { TENANTS, DEFAULT_TENANT_ID, TenantConfig } from '@/lib/tenants';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface PersonaAutorizzata {
  nome: string;
  cognome: string;
  telefono?: string;
}

interface MembroData {
  nome: string;
  cognome: string;
  dataNascita?: string;
  codiceFiscale?: string;
  luogoNascita?: string;
  telefonoPrincipale?: string;
  telefonoSecondario?: string;
  allergie?: string;
  consenso?: boolean;
  personaAutorizzata?: PersonaAutorizzata[];
  puoRientrareInAutonomia?: boolean;
}

interface AnagraficaData {
  via?: string;
  numeroCivico?: string;
  citta?: string;
  provincia?: string;
  cap?: string;
}

interface EmailPayload {
  familyHeadId: string;
  membroData: MembroData;
  anagraficaData: AnagraficaData;
  isEdit: boolean;
}

// ─── Helper: recupera email capofamiglia ──────────────────────────────────────

async function getFamilyHeadEmail(uid: string): Promise<{ email: string; displayName: string } | null> {
  const db = adminDb;

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

  try {
    const famigliaDoc = await db.collection('famiglie').doc(uid).get();
    if (famigliaDoc.exists) {
      const famigliaData = famigliaDoc.data()!;
      const uidCapofamiglia = famigliaData.uidCapofamiglia as string | undefined;
      if (uidCapofamiglia && uidCapofamiglia !== uid) {
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
        try {
          const authUser = await admin.auth().getUser(uidCapofamiglia);
          if (authUser.email) {
            return { email: authUser.email, displayName: authUser.displayName || 'Genitore' };
          }
        } catch {
          console.warn(`[member-email] Auth lookup fallito per uidCapofamiglia: ${uidCapofamiglia}`);
        }
      }
    }
  } catch (e) {
    console.warn(`[member-email] Lookup famiglie fallito per uid: ${uid}`, e);
  }

  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.email) {
      return { email: authUser.email, displayName: authUser.displayName || 'Genitore' };
    }
  } catch {
    console.warn(`[member-email] Auth user non trovato per uid: ${uid}`);
  }

  return null;
}

// ─── Helper: formatta data IT ─────────────────────────────────────────────────

function formatDateIT(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Builder HTML email ───────────────────────────────────────────────────────

function buildMemberSummaryHtml(
  recipientName: string,
  membro: MembroData,
  anagrafica: AnagraficaData,
  isEdit: boolean,
  tenantConfig: TenantConfig
): string {
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const fullName = `${membro.nome || ''} ${membro.cognome || ''}`.trim();
  const action = isEdit ? 'aggiornati' : 'registrati';
  const actionTitle = isEdit ? '✏️ Dati Membro Aggiornati' : '✅ Nuovo Membro Registrato';
  const headerColor = isEdit
    ? 'linear-gradient(135deg,#0f766e 0%,#14b8a6 100%)'
    : `linear-gradient(135deg, ${tenantConfig.colors.primary} 0%, #3b82f6 100%)`;

  const addressParts = [
    anagrafica.via && anagrafica.numeroCivico
      ? `${anagrafica.via} ${anagrafica.numeroCivico}`
      : anagrafica.via || '',
    [anagrafica.cap, anagrafica.citta].filter(Boolean).join(' '),
    anagrafica.provincia ? `(${anagrafica.provincia})` : '',
  ].filter(Boolean);
  const addressStr = addressParts.join(', ') || '—';

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#6b7280;font-weight:600;white-space:nowrap;width:40%;background:#f9fafb;border-bottom:1px solid #f0f0f0;">${label}</td>
      <td style="padding:10px 14px;font-size:13px;color:#111827;border-bottom:1px solid #f0f0f0;">${value || '—'}</td>
    </tr>`;

  // Sezione persone autorizzate (solo se presenti)
  let pickupSection = '';
  if (membro.personaAutorizzata && membro.personaAutorizzata.length > 0) {
    const personeRows = membro.personaAutorizzata.map((p, i) => `
      <div style="padding:10px 14px;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:12px;color:#6b7280;font-weight:600;">Persona ${i + 1}</span><br/>
        <span style="font-size:13px;color:#111827;font-weight:500;">${p.nome} ${p.cognome}</span>
        ${p.telefono ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">📞 ${p.telefono}</span>` : ''}
      </div>`).join('');

    const autonomiaLabel = membro.puoRientrareInAutonomia
      ? '<span style="color:#16a34a;font-weight:600;">✅ Sì</span>'
      : '<span style="color:#dc2626;font-weight:600;">❌ No</span>';

    pickupSection = `
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">🚶 Ritiro al termine degli incontri</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${row('Rientro autonomo', autonomiaLabel)}
            </tbody>
          </table>
          <p style="margin:12px 14px 6px;font-size:12px;color:#6b7280;font-weight:600;">Persone autorizzate al ritiro</p>
          ${personeRows}
        </div>
      </div>`;
  } else if (membro.puoRientrareInAutonomia !== undefined) {
    // Minorenne ma senza persone aggiunte
    const autonomiaLabel = membro.puoRientrareInAutonomia
      ? '<span style="color:#16a34a;font-weight:600;">✅ Sì</span>'
      : '<span style="color:#dc2626;font-weight:600;">❌ No</span>';
    pickupSection = `
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">🚶 Ritiro al termine degli incontri</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${row('Rientro autonomo', autonomiaLabel)}
            </tbody>
          </table>
          <p style="margin:10px 14px;font-size:12px;color:#9ca3af;font-style:italic;">Nessuna persona autorizzata indicata.</p>
        </div>
      </div>`;
  }

  const consensoLabel = membro.consenso
    ? '<span style="color:#16a34a;">✅ Autorizzato</span>'
    : '<span style="color:#dc2626;">❌ Non autorizzato</span>';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:${headerColor};padding:32px;color:white;">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;opacity:.8;">${tenantConfig.name}</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">${actionTitle}</h1>
      <p style="margin:0;font-size:14px;opacity:.85;">${today}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Ciao <strong>${recipientName}</strong>,<br/>
        di seguito trovi il riepilogo dei dati ${action} per il membro <strong>${fullName}</strong>.
      </p>

      <!-- Dati anagrafici -->
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">📋 Dati Anagrafici</p>
      <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${row('Nome', membro.nome || '')}
            ${row('Cognome', membro.cognome || '')}
            ${row('Data di nascita', formatDateIT(membro.dataNascita))}
            ${row('Luogo di nascita', membro.luogoNascita || '')}
            ${row('Codice Fiscale', membro.codiceFiscale || '')}
          </tbody>
        </table>
      </div>

      <!-- Indirizzo -->
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">🏠 Indirizzo</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>${row('Indirizzo', addressStr)}</tbody>
          </table>
        </div>
      </div>

      <!-- Contatti -->
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">📞 Contatti</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${row('Tel. principale', membro.telefonoPrincipale || '')}
              ${row('Tel. secondario', membro.telefonoSecondario || '')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Salute -->
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">⚕️ Salute</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${row('Allergie / Intolleranze', membro.allergie || 'Nessuna')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Consensi -->
      <div style="margin-top:24px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">📸 Foto & Social</p>
        <div style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <table style="width:100%;border-collapse:collapse;">
            <tbody>
              ${row('Consenso Foto & Social', consensoLabel)}
            </tbody>
          </table>
        </div>
      </div>

      ${pickupSection}

      <div style="margin-top:24px;padding:16px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;">
        <p style="margin:0;font-size:13px;color:#92400e;">ℹ️ Questa email è stata generata automaticamente dal sistema ${tenantConfig.name} a seguito di una modifica anagrafica. Per domande, contatta il tuo educatore o la segreteria.</p>
      </div>
    </div>
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} ${tenantConfig.name} — Sistema Gestione Anagrafica</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    initAdminApp();

    // ── Autenticazione ────────────────────────────────────────────────────────
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }

    const body: EmailPayload = await request.json();
    const { familyHeadId, membroData, anagraficaData, isEdit } = body;

    if (!familyHeadId || !membroData?.nome) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ── Determina Tenant Dinamico ────────────────────────────────────────────
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || DEFAULT_TENANT_ID;
    const tenantConfig = TENANTS[tenantId] || TENANTS[DEFAULT_TENANT_ID];

    // ── Controlla SMTP ────────────────────────────────────────────────────────
    const smtpOptions = await getSMTPOptions(tenantId);

    if (!smtpOptions.auth.user || !smtpOptions.auth.pass) {
      console.warn('[member-email] SMTP non configurato — salto invio.');
      return NextResponse.json({ success: true, skipped: true, reason: 'SMTP non configurato' });
    }

    // ── Recupera destinatari (capofamiglia + membri collegati) ────────────────
    const familyHead = await getFamilyHeadEmail(familyHeadId);

    const db = adminDb;
    const linkedSnap = await db.collection('users')
      .where('familyId', '==', familyHeadId)
      .get();

    const recipients: { email: string; displayName: string }[] = [];
    if (familyHead) recipients.push(familyHead);
    for (const memberDoc of linkedSnap.docs) {
      const m = memberDoc.data();
      if (m.email && m.email !== familyHead?.email) {
        recipients.push({
          email: m.email,
          displayName: m.displayName || `${m.nome || ''} ${m.cognome || ''}`.trim() || 'Membro',
        });
      }
    }

    if (recipients.length === 0) {
      console.warn(`[member-email] Nessun destinatario per familyId: ${familyHeadId}`);
      return NextResponse.json({ success: true, skipped: true, reason: 'Nessun destinatario trovato' });
    }

    // ── Invia ────────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport(smtpOptions);

    const fullName = `${membroData.nome} ${membroData.cognome}`.trim();
    const subject = isEdit
      ? `✏️ Dati aggiornati — ${fullName}`
      : `✅ Nuovo membro registrato — ${fullName}`;

    const sentTo: string[] = [];
    for (const recipient of recipients) {
      const html = buildMemberSummaryHtml(recipient.displayName, membroData, anagraficaData, isEdit, tenantConfig);
      try {
        await transporter.sendMail({
          from: `"${tenantConfig.name}" <${smtpOptions.auth.user}>`,
          to: recipient.email,
          replyTo: tenantConfig.email,
          subject,
          html,
        });
        sentTo.push(recipient.email);
        console.log(`[member-email] ✅ Inviata a ${recipient.email}`);
      } catch (mailErr: any) {
        console.error(`[member-email] Errore invio a ${recipient.email}:`, mailErr.message);
      }
    }

    return NextResponse.json({ success: true, sentTo, count: sentTo.length });

  } catch (err: any) {
    console.error('[member-email] Errore:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 200 });
  }
}
