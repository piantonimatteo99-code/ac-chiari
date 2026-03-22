import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

// Google Docs MIME types
const DOC_TYPES: Record<string, { mimeType: string; label: string }> = {
  document: {
    mimeType: 'application/vnd.google-apps.document',
    label: 'Documento',
  },
  spreadsheet: {
    mimeType: 'application/vnd.google-apps.spreadsheet',
    label: 'Foglio di calcolo',
  },
  presentation: {
    mimeType: 'application/vnd.google-apps.presentation',
    label: 'Presentazione',
  },
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  modifiedTime: string;
  iconLink?: string;
}

/**
 * GET /api/drive/documents?folderId=xxx
 * Lists all Google Drive files in the specified folder.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'folderId è richiesto' }, { status: 400 });
    }

    const accessToken = await getDriveAccessToken();

    const query = encodeURIComponent(
      `'${folderId}' in parents and trashed=false and not mimeType contains 'image/'`
    );
    const fields = 'files(id,name,mimeType,webViewLink,modifiedTime,iconLink)';

    const res = await fetch(
      `${DRIVE_API}/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Errore nel recupero dei documenti Drive');
    }

    const data = await res.json();
    return NextResponse.json({ files: data.files as DriveFile[] });

  } catch (err: any) {
    console.error('Error listing Drive documents:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/drive/documents
 * Body: { folderId: string, name: string, type: 'document' | 'spreadsheet' | 'presentation' }
 * Creates a new Google Docs/Sheets/Slides file in the specified folder.
 */
export async function POST(request: NextRequest) {
  try {
    const { folderId, name, type } = await request.json();

    if (!folderId || !name || !type) {
      return NextResponse.json({ error: 'folderId, name e type sono richiesti' }, { status: 400 });
    }

    const docType = DOC_TYPES[type];
    if (!docType) {
      return NextResponse.json(
        { error: `Tipo non valido. Usa: ${Object.keys(DOC_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    const accessToken = await getDriveAccessToken();

    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: docType.mimeType,
        parents: [folderId],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Errore nella creazione del documento');
    }

    const file = await createRes.json();

    // Fetch the full file details including webViewLink
    const detailsRes = await fetch(
      `${DRIVE_API}/files/${file.id}?fields=id,name,mimeType,webViewLink,modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const details = await detailsRes.json();

    return NextResponse.json({ file: details as DriveFile });

  } catch (err: any) {
    console.error('Error creating Drive document:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
