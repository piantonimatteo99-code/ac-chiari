import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'App AC Chiari';
const PAGAMENTI_FOLDER_NAME = 'Pagamenti';

/**
 * Finds or creates a folder on Drive by name and parent ID.
 */
async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQuery}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!searchRes.ok) {
     throw new Error(`Failed to search folder ${folderName}`);
  }
  
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!createRes.ok) {
      throw new Error(`Failed to create folder ${folderName}`);
  }

  const folder = await createRes.json();
  return folder.id as string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'file richiesto' }, { status: 400 });
    }

    const fileName = name || file.name;
    const accessToken = await getDriveAccessToken();

    // 1. Get or create root folder
    const rootFolderId = await getOrCreateFolder(accessToken, ROOT_FOLDER_NAME);
    
    // 2. Get or create "Pagamenti" folder inside root
    const pagamentiFolderId = await getOrCreateFolder(accessToken, PAGAMENTI_FOLDER_NAME, rootFolderId);

    // 3. Upload file to "Pagamenti" folder
    const metadata = {
      name: fileName,
      parents: [pagamentiFolderId],
    };

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
      `Content-Type: ${file.type || 'application/octet-stream'}`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(fileBuffer).toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    const body = `${metaPart}\r\n${filePart}`;

    const uploadRes = await fetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime`,
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
      throw new Error(err.error?.message || 'Errore nel caricamento del file su Drive');
    }

    const uploadedFile = await uploadRes.json();
    return NextResponse.json({ file: uploadedFile });

  } catch (err: any) {
    console.error('Error uploading file to Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
