import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export async function DELETE(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    if (!fileId) return NextResponse.json({ error: 'fileId richiesto' }, { status: 400 });

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
    console.error('Error deleting segnalazione from Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
