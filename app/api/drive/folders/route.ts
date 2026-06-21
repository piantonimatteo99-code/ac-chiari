import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp, getDriveRootFolderName, adminDb } from '@/lib/firebase-admin';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Finds or creates the root folder on Drive.
 */
async function getOrCreateRootFolder(accessToken: string, rootFolderName: string): Promise<string> {
  // Search for existing root folder
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  // Create root folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: rootFolderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const folder = await createRes.json();
  return folder.id as string;
}

/**
 * POST /api/drive/folders
 * Body: { projectId: string, projectName: string }
 * Creates a folder on Drive and saves the folderId to Firestore.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, projectName } = await request.json();

    if (!projectId || !projectName) {
      return NextResponse.json({ error: 'projectId e projectName sono richiesti' }, { status: 400 });
    }

    const accessToken = await getDriveAccessToken();
    const rootFolderName = getDriveRootFolderName();

    // 1. Get or create root folder
    const rootFolderId = await getOrCreateRootFolder(accessToken, rootFolderName);

    // 2. Create project subfolder
    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || 'Errore nella creazione cartella Drive');
    }

    const folder = await createRes.json();
    const folderId = folder.id as string;

    // 3. Save folderId to Firestore project document
    initAdminApp();
    const db = adminDb;
    await db.collection('progetti').doc(projectId).update({
      driveFolderId: folderId,
    });

    return NextResponse.json({ 
      success: true, 
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    });

  } catch (err: any) {
    console.error('Error creating Drive folder:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
