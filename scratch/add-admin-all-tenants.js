/**
 * Script: add-admin-all-tenants.js
 * Aggiunge piantonimatteo.99@gmail.com come admin in TUTTI i database tenant.
 * Esecuzione: node scratch/add-admin-all-tenants.js
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

// Carica .env.local
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
  console.log('✅ .env.local caricato');
}

const UID = 'j9Qr5yvXKSUjiJw8gB39o1U7Zks2'; // piantonimatteo.99@gmail.com
const EMAIL = 'piantonimatteo.99@gmail.com';

const TENANTS = [
  { tenantId: 'acchiari',  databaseId: null },          // database default
  { tenantId: 'acbrescia', databaseId: 'acbrescia' },   // database named
];

function initAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccount) {
      const cleaned = serviceAccount.trim().replace(/^'([\s\S]*)'$/, '$1');
      const parsed = JSON.parse(cleaned);
      if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      initializeApp({ credential: cert(parsed), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    } else {
      initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
    }
    console.log('✅ Firebase Admin inizializzato');
  }
}

async function setAdminInDatabase(tenantId, databaseId) {
  const app = getApp();
  const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

  const userRef = db.collection('users').doc(UID);
  const snapshot = await userRef.get();

  if (!snapshot.exists) {
    console.log(`  ➡️  Utente non trovato, creo documento...`);
    await userRef.set({
      id: UID,
      nome: 'Matteo',
      cognome: 'Piantoni',
      displayName: 'Matteo Piantoni',
      email: EMAIL,
      roles: ['admin', 'utente'],
      createdAt: Timestamp.now(),
    });
    console.log(`  ✅ Documento creato con ruolo admin`);
  } else {
    const data = snapshot.data();
    const roles = data.roles || [];
    if (!roles.includes('admin')) {
      await userRef.update({ roles: [...roles, 'admin'] });
      console.log(`  ✅ Ruolo admin aggiunto (era: [${roles.join(', ')}])`);
    } else {
      console.log(`  ℹ️  Già admin (roles: [${roles.join(', ')}])`);
    }
  }
}

async function main() {
  try {
    initAdmin();
    for (const { tenantId, databaseId } of TENANTS) {
      console.log(`\n📂 Tenant: ${tenantId} → Database: "${databaseId || 'default'}"`);
      await setAdminInDatabase(tenantId, databaseId);
    }
    console.log('\n✅ Completato!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Errore:', err.message);
    process.exit(1);
  }
}

main();
