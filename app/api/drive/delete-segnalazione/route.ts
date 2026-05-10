import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, storagePath } = body;

    // ── Nuovo flusso: elimina da Firebase Storage ──
    if (storagePath) {
      initAdminApp();
      const bucket = admin.storage().bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
      try {
        await bucket.file(storagePath).delete();
      } catch (e: any) {
        // Se il file non esiste, non è un errore critico
        if (e?.code !== 404) throw e;
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

    // 204 No Content = eliminato con successo
    if (!res.ok && res.status !== 204) {
      throw new Error(`Impossibile eliminare il file: ${res.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting receipt:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
