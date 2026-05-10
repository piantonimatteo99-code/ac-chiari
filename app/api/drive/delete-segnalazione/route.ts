import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GCS_API = 'https://storage.googleapis.com/storage/v1';

async function getGCSAccessToken(): Promise<string> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY non configurato');
  const cleaned = raw.trim().replace(/^'([\s\S]*)'$/, '$1');
  const sa = JSON.parse(cleaned);
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const header = enc({ alg: 'RS256', typ: 'JWT' });
  const body = enc(payload);
  const unsigned = `${header}.${body}`;
  const { createSign } = await import('crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GCS token error: ${data.error_description || data.error}`);
  return data.access_token as string;
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, storagePath } = body;

    // ── Nuovo flusso: elimina da Firebase Storage via REST API ──
    if (storagePath) {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET non configurato');
      const accessToken = await getGCSAccessToken();
      const encodedPath = encodeURIComponent(storagePath);
      const res = await fetch(`${GCS_API}/b/${bucket}/o/${encodedPath}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // 204 = eliminato, 404 = già non esiste — entrambi ok
      if (!res.ok && res.status !== 204 && res.status !== 404) {
        throw new Error(`Impossibile eliminare il file da Storage: ${res.status}`);
      }
      return NextResponse.json({ success: true });
    }

    // ── Flusso legacy: elimina da Google Drive ──
    if (!fileId) return NextResponse.json({ error: 'fileId o storagePath richiesto' }, { status: 400 });

    const accessToken = await getDriveAccessToken();
    const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Impossibile eliminare il file: ${res.status}`);
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting receipt:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
