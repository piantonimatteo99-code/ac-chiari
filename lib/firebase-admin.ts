import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { headers } from 'next/headers';
import { DEFAULT_TENANT_ID, TENANTS } from './tenants';

let initialized = false;

export function initAdminApp() {
  if (initialized) return;
  
  if (admin.apps.length === 0) {
    // Check if we have service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      // Production: use service account JSON from env variable.
      // Strip surrounding single quotes if copied from .env.local (e.g. ='...')
      const cleaned = serviceAccount.trim().replace(/^'([\s\S]*)'$/, '$1');
      // On Windows/Vercel, env variables often double-escape newlines (\\n → \\n literal).
      // We must convert them back to actual newline characters for PEM parsing.
      const parsed = JSON.parse(cleaned);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      // Development: use Application Default Credentials
      // This works when running locally with `gcloud auth application-default login`
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  }
  
  initialized = true;
}

function getTenantIdFromServer(): string {
  try {
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id');
    return tenantId || DEFAULT_TENANT_ID;
  } catch (e) {
    return DEFAULT_TENANT_ID;
  }
}

export function getDriveRootFolderName(): string {
  try {
    const tenantId = getTenantIdFromServer();
    const config = TENANTS[tenantId];
    return `App ${config?.name || 'AC Chiari'}`;
  } catch (e) {
    return 'App AC Chiari';
  }
}

function getTenantFirestoreInstance(): admin.firestore.Firestore {
  initAdminApp();
  const tenantId = getTenantIdFromServer();
  const databaseId = tenantId === 'acchiari' ? '(default)' : tenantId;
  const app = admin.apps[0];
  return getFirestore(app, databaseId);
}

// Convenience accessors — call initAdminApp() first
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const db = getTenantFirestoreInstance();
    const value = (db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  },
});

export const adminMessaging = new Proxy({} as admin.messaging.Messaging, {
  get(_target, prop) {
    initAdminApp();
    return (admin.messaging() as any)[prop];
  },
});

/**
 * Gets a fresh Google Drive access token using the stored refresh token.
 * The refresh token is saved in Firestore by the OAuth callback.
 */
export async function getDriveAccessToken(): Promise<string> {
  initAdminApp();
  const db = adminDb;
  
  const configDoc = await db.collection('config').doc('google-drive').get();
  
  if (!configDoc.exists) {
    throw new Error('Google Drive non è ancora connesso. Vai su Admin > Configurazione per collegare Google Drive.');
  }
  
  const config = configDoc.data()!;
  const refreshToken: string = config.refreshToken;
  
  if (!refreshToken) {
    throw new Error('Refresh token Google Drive non trovato. Riconnetti Google Drive dalla pagina di configurazione.');
  }
  
  // Exchange refresh token for a fresh access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Errore refresh token Drive: ${data.error_description || data.error}`);
  }
  
  // Optionally update cached access token in Firestore
  await db.collection('config').doc('google-drive').update({
    accessToken: data.access_token,
    updatedAt: new Date(),
  });
  
  return data.access_token as string;
}
