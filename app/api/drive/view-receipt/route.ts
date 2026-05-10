import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const firebaseToken = authHeader.slice(7);

  // ── 1. Verifica autenticazione e ruolo ──
  try {
    initAdminApp();
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const roles: string[] = Array.isArray(userDoc.data()?.roles) ? userDoc.data()!.roles : [];
    if (!roles.includes('admin') && !roles.includes('educatore')) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }
  } catch (authErr: any) {
    console.error('[view-receipt] Auth error:', authErr.message);
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fileId = searchParams.get('fileId');
  const storagePath = searchParams.get('storagePath');

  // ── 2a. Firebase Storage (nuovo flusso) ──
  // Usa il Firebase ID token dell'admin per accedere alla Storage REST API
  if (storagePath) {
    try {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET non configurato');

      const encodedPath = encodeURIComponent(storagePath);
      const storageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

      const fileRes = await fetch(storageUrl, {
        headers: { Authorization: `Firebase ${firebaseToken}` },
      });

      if (!fileRes.ok) {
        const errBody = await fileRes.text();
        console.error(`[view-receipt] Firebase Storage ${fileRes.status}:`, errBody);
        if (fileRes.status === 403 || fileRes.status === 401) {
          // Le security rules bloccano — usa accesso admin via Admin SDK
          return await serveWithAdminSDK(storagePath);
        }
        return NextResponse.json({ error: `Storage error: ${fileRes.status}` }, { status: fileRes.status === 404 ? 404 : 500 });
      }

      return new NextResponse(fileRes.body, {
        headers: {
          'Content-Type': fileRes.headers.get('Content-Type') || 'application/octet-stream',
          'Cache-Control': 'private, max-age=120',
          'Content-Disposition': `inline; filename="${storagePath.split('/').pop() || 'ricevuta'}"`,
        },
      });
    } catch (err: any) {
      console.error('[view-receipt] Errore Storage:', err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── 2b. Google Drive (flusso legacy) ──
  if (!fileId) return NextResponse.json({ error: 'fileId o storagePath richiesto' }, { status: 400 });

  try {
    const accessToken = await getDriveAccessToken();
    const metaRes = await fetch(`${DRIVE_API}/files/${fileId}?fields=mimeType,name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
    const meta = await metaRes.json();
    const fileRes = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) return NextResponse.json({ error: 'Download fallito' }, { status: 500 });
    return new NextResponse(fileRes.body, {
      headers: {
        'Content-Type': meta.mimeType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=120',
        'Content-Disposition': `inline; filename="${meta.name || 'ricevuta'}"`,
      },
    });
  } catch (err: any) {
    console.error('[view-receipt] Errore Drive:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Fallback: serve il file usando Firebase Admin SDK (bypassa le security rules) */
async function serveWithAdminSDK(storagePath: string): Promise<NextResponse> {
  try {
    initAdminApp();
    const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
    const [meta] = await file.getMetadata();
    const [contents] = await file.download();
    return new NextResponse(new Uint8Array(contents), {
      headers: {
        'Content-Type': (meta as any).contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=120',
        'Content-Disposition': `inline; filename="${storagePath.split('/').pop() || 'ricevuta'}"`,
      },
    });
  } catch (err: any) {
    console.error('[view-receipt] Errore Admin SDK:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
