import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, getDriveRootFolderName } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SEGNALAZIONI_FOLDER_NAME = 'segnalazioni';

async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQuery}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!searchRes.ok) throw new Error(`Failed to search folder ${folderName}`);
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id as string;

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });
  if (!createRes.ok) throw new Error(`Failed to create folder ${folderName}`);
  const folder = await createRes.json();
  return folder.id as string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file) return NextResponse.json({ error: 'file richiesto' }, { status: 400 });

    const fileName = name || `segnalazione_${Date.now()}_${file.name}`;
    const accessToken = await getDriveAccessToken();
    const rootFolderName = getDriveRootFolderName();

    const rootFolderId = await getOrCreateFolder(accessToken, rootFolderName);
    const segnalazioniFolderId = await getOrCreateFolder(accessToken, SEGNALAZIONI_FOLDER_NAME, rootFolderId);

    const metadata = { name: fileName, parents: [segnalazioniFolderId] };
    const boundary = '-------314159265358979323846';
    const fileBuffer = await file.arrayBuffer();

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
    ].join('\r\n');

    const filePart = [
      `--${boundary}`,
      `Content-Type: ${file.type || 'image/png'}`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(fileBuffer).toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    const body = `${metaPart}\r\n${filePart}`;

    const uploadRes = await fetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': String(Buffer.byteLength(body)),
        },
        body,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      throw new Error(err.error?.message || 'Errore nel caricamento su Drive');
    }

    const uploadedFile = await uploadRes.json();

    // Rendi il file accessibile a chiunque abbia il link
    await fetch(`${DRIVE_API}/files/${uploadedFile.id}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return NextResponse.json({ file: uploadedFile });
  } catch (err: any) {
    console.error('Error uploading segnalazione to Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
