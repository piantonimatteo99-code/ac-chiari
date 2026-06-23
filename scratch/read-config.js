/**
 * Legge tutti i documenti in config/ da tutti i database tenant
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function initAdmin() {
  if (getApps().length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (sa) {
      const cleaned = sa.trim().replace(/^'([\s\S]*)'$/, '$1');
      const parsed = JSON.parse(cleaned);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      initializeApp({ credential: cert(parsed), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
  }
}

async function listConfig(db, label) {
  console.log(`\n=== ${label} ===`);
  const snap = await db.collection('config').get();
  if (snap.empty) {
    console.log('  (collezione config vuota)');
    return;
  }
  for (const doc of snap.docs) {
    const data = doc.data();
    // Maschera le password
    const safeData = { ...data };
    if (safeData.pass) safeData.pass = '***';
    if (safeData.password) safeData.password = '***';
    console.log(`  [${doc.id}]:`, JSON.stringify(safeData));
  }
}

async function main() {
  initAdmin();
  const app = getApp();
  
  await listConfig(getFirestore(app), 'acchiari (default)');
  await listConfig(getFirestore(app, 'acbrescia'), 'acbrescia');
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
