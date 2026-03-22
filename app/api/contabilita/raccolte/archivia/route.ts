import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, initAdminApp } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import JSZip from 'jszip';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'App AC Chiari';
const PAGAMENTI_FOLDER_NAME = 'Pagamenti';

async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const searchRes = await fetch(
    `${DRIVE_API}/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQuery}&fields=files(id,name)`,
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
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    }),
  });

  const folder = await createRes.json();
  return folder.id as string;
}


export async function POST(request: NextRequest) {
  try {
    const { raccoltaId } = await request.json();

    if (!raccoltaId) {
      return NextResponse.json({ error: 'raccoltaId è richiesto' }, { status: 400 });
    }

    initAdminApp();
    const db = getFirestore();
    const storage = getStorage();

    const raccoltaDoc = await db.collection('raccolte').doc(raccoltaId).get();
    if (!raccoltaDoc.exists) {
      return NextResponse.json({ error: 'Raccolta non trovata' }, { status: 404 });
    }

    const raccoltaData = raccoltaDoc.data();
    const raccoltaNome = raccoltaData?.nome || 'Sconosciuto';
    const paymentDetails = raccoltaData?.paymentDetails || {};

    const zip = new JSZip();
    const filesToDelete: { path: string, dbPath: string }[] = [];
    let fileAddedToZip = false;

    // Helper to process a phase
    const processPhase = async (phase: string) => {
      const phaseData = paymentDetails[phase];
      if (!phaseData) return;

      for (const memberId of Object.keys(phaseData)) {
        const payment = phaseData[memberId];
        if (payment && payment.receiptUrl) {
          try {
            // Fetch the file from the download URL
            const res = await fetch(payment.receiptUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              
              // Try to find the original extension or fallback to pdf
              const urlParts = payment.receiptUrl.split('?')[0].split('%2F');
              const lastPart = urlParts[urlParts.length - 1] || '';
              const ext = lastPart.includes('.png') ? 'png' : lastPart.includes('.jpg') ? 'jpg' : lastPart.includes('.jpeg') ? 'jpeg' : 'pdf';
              
              const filename = `${phase}_${memberId}_${payment.paymentId || 'doc'}.${ext}`;
              zip.file(filename, arrayBuffer);
              fileAddedToZip = true;

              // Extract storage path to delete later
              // Format usually: https://firebasestorage.googleapis.com/.../o/receipts%2Fsome%2Fpath.jpg
              const pathMatch = payment.receiptUrl.match(/\/o\/(.+?)\?/);
              if (pathMatch && pathMatch[1]) {
                const storagePath = decodeURIComponent(pathMatch[1]);
                filesToDelete.push({ path: storagePath, dbPath: `paymentDetails.${phase}.${memberId}.receiptUrl` });
              }
            } else {
                console.warn(`Could not fetch receipt for ${memberId} in ${phase}`);
            }
          } catch (e) {
            console.error(`Error processing file for member ${memberId}:`, e);
          }
        }
      }
    };

    await processPhase('caparra');
    await processPhase('saldo');
    await processPhase('tesseramento');

    if (fileAddedToZip) {
      // Fetch spese associated with this raccolta
      const speseSnapshot = await db.collection('spese').where('raccoltaId', '==', raccoltaId).get();
      for (const spesaDoc of speseSnapshot.docs) {
          const spesa = spesaDoc.data();
          if (spesa.receiptUrl) {
               try {
                   const res = await fetch(spesa.receiptUrl);
                   if (res.ok) {
                       const arrayBuffer = await res.arrayBuffer();
                       
                       const urlParts = spesa.receiptUrl.split('?')[0].split('%2F');
                       const lastPart = urlParts[urlParts.length - 1] || '';
                       const ext = lastPart.includes('.png') ? 'png' : lastPart.includes('.jpg') ? 'jpg' : lastPart.includes('.jpeg') ? 'jpeg' : 'pdf';
                       
                       const filename = `Spesa_${spesaDoc.id}_${spesa.descrizione?.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 15) || 'doc'}.${ext}`;
                       zip.file(filename, arrayBuffer);
                       
                       const pathMatch = spesa.receiptUrl.match(/\/o\/(.+?)\?/);
                       if (pathMatch && pathMatch[1]) {
                             const storagePath = decodeURIComponent(pathMatch[1]);
                             // For spese, dbPath is simply 'receiptUrl'
                             filesToDelete.push({ path: storagePath, dbPath: `SPESA:${spesaDoc.id}` });
                       }
                   }
               } catch (e) {
                   console.error(`Error processing expense receipt for ${spesaDoc.id}:`, e);
               }
          }
      }

      // Generate Zip
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      
      const accessToken = await getDriveAccessToken();
      const rootFolderId = await getOrCreateFolder(accessToken, ROOT_FOLDER_NAME);
      const pagamentiFolderId = await getOrCreateFolder(accessToken, PAGAMENTI_FOLDER_NAME, rootFolderId);
      
      const zipName = `Raccolta_${raccoltaNome}_Archivio.zip`;

      const metadata = {
        name: zipName,
        parents: [pagamentiFolderId],
      };

      const boundary = '-------314159265358979323846';
      
      const metaPart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
      ].join('\r\n');

      const filePart = [
        `--${boundary}`,
        `Content-Type: application/zip`,
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(zipBuffer).toString('base64'),
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
        throw new Error(err.error?.message || 'Errore nel caricamento dello ZIP su Drive');
      }

      // If upload succeeded, delete all files from storage and update DB
      const bucket = storage.bucket();
      const dbUpdates: { [key: string]: any } = {};

      for (const item of filesToDelete) {
        try {
          const fileRef = bucket.file(item.path);
          await fileRef.delete();
          
          if (item.dbPath.startsWith('SPESA:')) {
              const spesaId = item.dbPath.split(':')[1];
              await db.collection('spese').doc(spesaId).update({
                  receiptUrl: null,
                  archivedToDrive: true
              });
          } else {
             // Nullify the url in the DB so it doesn't give a broken link
             dbUpdates[item.dbPath] = null;
             dbUpdates[item.dbPath.replace('.receiptUrl', '.archivedToDrive')] = true;
          }
        } catch (e: any) {
             console.error(`Failed to delete storage file ${item.path}:`, e?.message || e);
             // It might be already deleted, continue
        }
      }

      if (Object.keys(dbUpdates).length > 0) {
        await db.collection('raccolte').doc(raccoltaId).update(dbUpdates);
      }
    }

    // Set as archived
    await db.collection('raccolte').doc(raccoltaId).update({ archived: true });

    return NextResponse.json({ success: true, processed: filesToDelete.length });

  } catch (err: any) {
    console.error('Error archiving raccolta:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
