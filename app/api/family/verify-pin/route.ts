import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp, adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    initAdminApp();
    const db = adminDb;

    const body = await request.json();
    const { requesterId, pin } = body;

    if (!requesterId || !pin) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
    }

    // ── Load the PIN document ─────────────────────────────────────────────────
    const pinDoc = await db.collection('familyJoinPins').doc(requesterId).get();
    if (!pinDoc.exists) {
      return NextResponse.json({ error: 'Nessuna richiesta trovata. Richiedi un nuovo codice.' }, { status: 404 });
    }

    const data = pinDoc.data()!;

    if (data.used) {
      return NextResponse.json({ error: 'Questo codice è già stato utilizzato.' }, { status: 400 });
    }

    // Check expiry
    const expiresAt = data.expiresAt as FirebaseFirestore.Timestamp;
    if (expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Il codice è scaduto. Richiedi un nuovo codice.' }, { status: 400 });
    }

    // Verify PIN hash
    const inputHash = crypto.createHash('sha256').update(String(pin).trim()).digest('hex');
    if (inputHash !== data.pinHash) {
      return NextResponse.json({ error: 'Codice non corretto. Ricontrolla e riprova.' }, { status: 401 });
    }

    // ── PIN correct → link the user to the family ─────────────────────────────
    const userUpdatePayload: Record<string, any> = {
      familyId: data.targetFamilyId,
      familyLinkedAt: Timestamp.now(),
    };

    // Save personal data onto the user's profile
    const pd = data.personalData ?? {};
    const personalFields = ['codiceFiscale', 'dataNascita', 'luogoNascita', 'telefonoPrincipale',
      'telefonoSecondario', 'allergie', 'via', 'numeroCivico', 'citta', 'provincia', 'cap'];
    for (const field of personalFields) {
      if (pd[field] !== undefined && pd[field] !== '') {
        userUpdatePayload[field] = pd[field];
      }
    }

    await db.collection('users').doc(requesterId).update(userUpdatePayload);

    // Mark PIN as used
    await pinDoc.ref.update({ used: true, usedAt: Timestamp.now() });

    // Also add this user as a member of the linked family's 'membri' subcollection
    // so they appear in the family roster
    if (pd.nome && pd.cognome) {
      const membriRef = db.collection('famiglie').doc(data.targetFamilyId).collection('membri');
      // Check if a member with same CF already exists to avoid duplicates
      const existing = pd.codiceFiscale
        ? await membriRef.where('codiceFiscale', '==', pd.codiceFiscale).limit(1).get()
        : { empty: true };

      if (existing.empty) {
        await membriRef.add({
          nome: pd.nome ?? '',
          cognome: pd.cognome ?? '',
          dataNascita: pd.dataNascita ?? '',
          codiceFiscale: pd.codiceFiscale ?? '',
          luogoNascita: pd.luogoNascita ?? '',
          telefonoPrincipale: pd.telefonoPrincipale ?? '',
          telefonoSecondario: pd.telefonoSecondario ?? '',
          allergie: pd.allergie ?? '',
          consenso: true,
          linkedUserId: requesterId,
          createdAt: Timestamp.now(),
        });
      }
    }

    console.log(`[family/verify-pin] ${requesterId} collegato a famiglia ${data.targetFamilyId}`);
    return NextResponse.json({ success: true, familyId: data.targetFamilyId });

  } catch (err: any) {
    console.error('[family/verify-pin] Errore:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
