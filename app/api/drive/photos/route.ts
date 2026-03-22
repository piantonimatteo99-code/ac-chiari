import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

/**
 * GET /api/drive/photos?folderId=xxx
 * Lists all images in the specified Drive folder.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'folderId è richiesto' }, { status: 400 });
    }

    const accessToken = await getDriveAccessToken();

    const mimeQuery = IMAGE_MIME_TYPES.map(m => `mimeType='${m}'`).join(' or ');
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and (${mimeQuery})`);
    const fields = 'files(id,name,mimeType,webViewLink,thumbnailLink,modifiedTime,size)';

    const res = await fetch(
      `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'Errore nel recupero delle foto');
    }

    const data = await res.json();
    return NextResponse.json({ files: data.files ?? [] });

  } catch (err: any) {
    console.error('Error listing Drive photos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/drive/photos
 * Multipart form: file (image), folderId (string), name (string)
 * Uploads an image to the specified Drive folder and returns the file data.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderId = formData.get('folderId') as string | null;
    const name = formData.get('name') as string | null;

    if (!file || !folderId) {
      return NextResponse.json({ error: 'file e folderId sono richiesti' }, { status: 400 });
    }

    const fileName = name || file.name;
    const accessToken = await getDriveAccessToken();

    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = '-------boundary-photo-upload-314159';
    const fileBuffer = await file.arrayBuffer();

    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
    ].join('\r\n');

    const filePart = [
      `--${boundary}`,
      `Content-Type: ${file.type || 'image/jpeg'}`,
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(fileBuffer).toString('base64'),
      `--${boundary}--`,
    ].join('\r\n');

    const body = `${metaPart}\r\n${filePart}`;

    const uploadRes = await fetch(
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink,modifiedTime`,
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
      throw new Error(err.error?.message || 'Errore nel caricamento della foto');
    }

    const uploadedFile = await uploadRes.json();

    // Make the file publicly readable so thumbnails work in the browser
    await fetch(`${DRIVE_API}/files/${uploadedFile.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });

    return NextResponse.json({ file: uploadedFile });

  } catch (err: any) {
    console.error('Error uploading photo to Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
