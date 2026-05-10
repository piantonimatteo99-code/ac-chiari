import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── 1. Auth: richiede Firebase ID token nell'header Authorization ──
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    initAdminApp();
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);

    // Verifica ruolo educatore o admin
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const roles: string[] = Array.isArray(userDoc.data()?.roles) ? userDoc.data()!.roles : [];
    if (!roles.includes('admin') && !roles.includes('educatore')) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fileId = searchParams.get('fileId');
  const storagePath = searchParams.get('storagePath');

  // ── 2a. Firebase Storage path (nuovo flusso — nessun file su Drive) ──
  if (storagePath) {
    try {
      initAdminApp();
      const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
      const fileRef = bucket.file(storagePath);

      const [exists] = await fileRef.exists();
      if (!exists) {
        return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
      }

      const [metadata] = await fileRef.getMetadata();
      const contentType = metadata.contentType || 'application/octet-stream';
      const fileName = storagePath.split('/').pop() || 'ricevuta';

      const [fileBuffer] = await fileRef.download();

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=120',
          'Content-Disposition': `inline; filename="${fileName}"`,
        },
      });
    } catch (err: any) {
      console.error('[view-receipt] Errore Storage:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── 2b. Google Drive file ID (flusso legacy) ──
  if (!fileId) {
    return NextResponse.json({ error: 'fileId o storagePath richiesto' }, { status: 400 });
  }

  try {
    const accessToken = await getDriveAccessToken();

    // Metadata (content-type, nome)
    const metaRes = await fetch(
      `${DRIVE_API}/files/${fileId}?fields=mimeType,name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) {
      return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
    }
    const meta = await metaRes.json();

    // Contenuto file
    const fileRes = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Download fallito' }, { status: 500 });
    }

    const contentType = meta.mimeType || 'application/octet-stream';

    return new NextResponse(fileRes.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=120',
        'Content-Disposition': `inline; filename="${meta.name || 'ricevuta'}"`,
      },
    });
  } catch (err: any) {
    console.error('[view-receipt] Errore Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
