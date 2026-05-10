import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const GCS_API = 'https://storage.googleapis.com/storage/v1';

async function getStorageAccessToken(): Promise<string> {
  initAdminApp();
  const credential = admin.app().options.credential as admin.credential.Credential;
  const token = await credential.getAccessToken();
  return token.access_token;
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, storagePath } = body;

    // ── Nuovo flusso: elimina da Firebase Storage via REST API ──
    if (storagePath) {
      const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if (!bucket) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET non configurato');
      const accessToken = await getStorageAccessToken();
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
