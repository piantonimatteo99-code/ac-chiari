import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/firebase-admin';

const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * POST /api/drive/upload
 * Uploads a PDF file to a specific Drive folder.
 * Expects a multipart form with: file (Blob), folderId (string), name (string)
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

    // Use multipart upload: metadata + file content
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = '-------314159265358979323846';
    const fileBuffer = await file.arrayBuffer();

    // Build multipart body
    const metaPart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
    ].join('\r\n');

    const filePart = [
      `--${boundary}`,
      `Content-Type: ${file.type || 'application/pdf'}`,
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
      throw new Error(err.error?.message || 'Errore nel caricamento del PDF');
    }

    const uploadedFile = await uploadRes.json();
    return NextResponse.json({ file: uploadedFile });

  } catch (err: any) {
    console.error('Error uploading file to Drive:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
