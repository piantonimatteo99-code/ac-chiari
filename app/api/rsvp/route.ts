import { NextRequest, NextResponse } from 'next/server';
import { adminDb, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/rsvp
 *
 * Body: { eventId: string, risposta: 'presente' | 'assente' }
 * Authorization: Bearer <idToken>
 *
 * Salva la risposta RSVP dell'utente in:
 *   rsvp/{eventId}/risposte/{userId}
 */
export async function POST(req: NextRequest) {
  try {
    initAdminApp();

    // ── Autenticazione ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    let uid: string;
    let nome = '';
    let cognome = '';

    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;

      // Recupera nome/cognome dal documento utente
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data()!;
        nome = data.nome ?? data.displayName ?? '';
        cognome = data.cognome ?? '';
      }
    } catch {
      return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 401 });
    }

    // ── Validazione body ────────────────────────────────────────────────────
    const body = await req.json();
    const { eventId, risposta } = body as { eventId?: string; risposta?: string };

    if (!eventId) {
      return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });
    }
    if (risposta !== 'presente' && risposta !== 'assente') {
      return NextResponse.json({ error: 'risposta deve essere "presente" o "assente"' }, { status: 400 });
    }

    // ── Controlla che l'evento esista e abbia richiedeRsvp ─────────────────
    const eventoDoc = await adminDb.collection('eventi').doc(eventId).get();
    if (!eventoDoc.exists) {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }
    const eventoData = eventoDoc.data()!;
    if (!eventoData.richiedeRsvp) {
      return NextResponse.json({ error: 'Questo evento non richiede RSVP' }, { status: 400 });
    }

    // ── Salva la risposta ───────────────────────────────────────────────────
    const rispostaRef = adminDb
      .collection('rsvp')
      .doc(eventId)
      .collection('risposte')
      .doc(uid);

    await rispostaRef.set({
      userId: uid,
      nome,
      cognome,
      risposta,
      rispostoAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true, risposta });

  } catch (error: any) {
    console.error('[api/rsvp] Errore:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/rsvp?eventId=...
 *
 * Restituisce le risposte RSVP per un evento.
 * Riservato ad utenti autenticati (educatori/admin).
 */
export async function GET(req: NextRequest) {
  try {
    initAdminApp();

    const authHeader = req.headers.get('authorization');
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!idToken) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });
    }

    const risposteSnap = await adminDb
      .collection('rsvp')
      .doc(eventId)
      .collection('risposte')
      .get();

    const risposte = risposteSnap.docs.map(d => ({
      userId: d.id,
      ...d.data(),
      rispostoAt: d.data().rispostoAt?.toDate?.()?.toISOString() ?? null,
    }));

    return NextResponse.json({ risposte });

  } catch (error: any) {
    console.error('[api/rsvp] GET Errore:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
