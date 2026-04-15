import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const ROOT_FOLDER_NAME = 'App AC Chiari';
const CAMPI_SUBFOLDER_NAME = 'campi';

async function getOrCreateFolder(accessToken: string, name: string, parentId: string): Promise<string> {
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${encodeURIComponent(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  const folder = await createRes.json();
  return folder.id as string;
}

async function getOrCreateRootFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const folder = await createRes.json();
  return folder.id as string;
}

/**
 * POST /api/drive/campi-folder
 * Body: { campoId: string, campoName: string }
 * Creates a folder "App AC Chiari / campi / [campoName]" on Drive and saves the folderId to Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept both naming conventions (documentManager sends projectId/projectName)
    const campoId: string = body.campoId ?? body.projectId;
    const campoName: string = body.campoName ?? body.projectName;

    if (!campoId || !campoName) {
      return NextResponse.json({ error: 'campoId e campoName sono obbligatori' }, { status: 400 });
    }

    const accessToken = await getDriveAccessToken();

    // 1. Get or create "App AC Chiari" root folder
    const rootFolderId = await getOrCreateRootFolder(accessToken);

    // 2. Get or create "campi" subfolder inside root
    const campiFolderId = await getOrCreateFolder(accessToken, CAMPI_SUBFOLDER_NAME, rootFolderId);

    // 3. Create the specific campo folder inside "campi"
    const safeName = campoName.replace(/[/\\?%*:|"<>]/g, '-');
    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: safeName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [campiFolderId],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Errore nella creazione cartella Drive');
    }

    const folder = await createRes.json();
    const folderId = folder.id as string;

    // 4. Save folderId to Firestore campo document
    initAdminApp();
    const db = getFirestore();
    await db.collection('campi').doc(campoId).update({
      driveFolderId: folderId,
    });

    return NextResponse.json({
      success: true,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    });

  } catch (err: any) {
    console.error('Error creating Drive folder for campo:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
