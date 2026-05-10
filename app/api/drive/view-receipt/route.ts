import { NextRequest, NextResponse } from 'next/server';
import { initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export const dynamic = 'force-dynamic';

/** Genera un access token per GCS usando JWT del service account */
async function getGCSAccessToken(): Promise<string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY non configurato');
  const cleaned = raw.trim().replace(/^'([\s\S]*)'$/, '$1');
  const sa = JSON.parse(cleaned);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');

  // JWT claim set
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_only https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Encode header + payload
  const enc = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = enc({ alg: 'RS256', typ: 'JWT' });
  const body = enc(payload);
  const unsigned = `${header}.${body}`;

  // Sign with private key using crypto
  const { createSign } = await import('crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  // Exchange JWT for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GCS token error: ${data.error_description || data.error}`);
  return data.access_token as string;
}

export async function GET(request: NextRequest) {
  // ── 1. Auth: richiede Firebase ID token ──
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    initAdminApp();
    const token = authHeader.slice(7);
    const decoded = await admin.auth().verifyIdToken(token);
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

  // ── 2a. Firebase Storage (nuovo flusso) ──
  if (storagePath) {
    try {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucket) throw new Error('Storage bucket non configurato');
      const accessToken = await getGCSAccessToken();
      const encodedPath = encodeURIComponent(storagePath);

      // Metadata
      const metaRes = await fetch(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodedPath}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!metaRes.ok) return NextResponse.json({ error: 'File non trovato' }, { status: 404 });
      const meta = await metaRes.json();

      // Contenuto
      const fileRes = await fetch(
        `https://storage.googleapis.com/download/storage/v1/b/${bucket}/o/${encodedPath}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!fileRes.ok) return NextResponse.json({ error: 'Download fallito' }, { status: 500 });

      return new NextResponse(fileRes.body, {
        headers: {
          'Content-Type': meta.contentType || 'application/octet-stream',
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
    const { getDriveAccessToken } = await import('@/lib/firebase-admin');
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
