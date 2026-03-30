import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const ROOT_FOLDER_NAME = 'App AC Chiari';
const CONSIGLIO_FOLDER_NAME = 'Consiglio';
const CONSIGLIO_CONFIG_DOC = 'consiglio'; // document in 'app-config' collection

/**
 * Finds or creates the root "App AC Chiari" folder on Drive.
 */
async function getOrCreateRootFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }
  // Create root folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ROOT_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const folder = await createRes.json();
  return folder.id as string;
}

/**
 * GET /api/drive/consiglio-folder
 * Returns { folderId } from Firestore config, or null if not yet created.
 */
export async function GET() {
  try {
    initAdminApp();
    const db = getFirestore();
    const snap = await db.collection('app-config').doc(CONSIGLIO_CONFIG_DOC).get();
    const folderId = snap.exists ? (snap.data()?.verbali_drive_folder_id ?? null) : null;
    return NextResponse.json({ folderId });
  } catch (err: any) {
    console.error('Error fetching consiglio folder:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/drive/consiglio-folder
 * Creates "App AC Chiari / Consiglio" on Drive, saves folderId to Firestore.
 */
export async function POST(_request: NextRequest) {
  try {
    const accessToken = await getDriveAccessToken();

    // 1. Get / create root folder
    const rootFolderId = await getOrCreateRootFolder(accessToken);

    // 2. Check if Consiglio subfolder already exists under root
    const searchRes = await fetch(
      `${DRIVE_API}/files?q=name='${CONSIGLIO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const searchData = await searchRes.json();

    let folderId: string;
    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id as string;
    } else {
      // Create Consiglio subfolder
      const createRes = await fetch(`${DRIVE_API}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: CONSIGLIO_FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [rootFolderId],
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error?.message || 'Errore nella creazione cartella Drive');
      }
      const folder = await createRes.json();
      folderId = folder.id as string;
    }

    // 3. Save to Firestore
    initAdminApp();
    const db = getFirestore();
    await db.collection('app-config').doc(CONSIGLIO_CONFIG_DOC).set(
      { verbali_drive_folder_id: folderId },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
    });
  } catch (err: any) {
    console.error('Error creating consiglio Drive folder:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
