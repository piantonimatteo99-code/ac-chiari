/**
 * Trova l'utente per email in Firebase Auth e crea il documento in acbrescia Firestore.
 * node scratch/fix-missing-user-doc.js kawidi2336@luxudata.com
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
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
    const cleaned = sa.trim().replace(/^'([\s\S]*)'$/, '$1');
    const parsed = JSON.parse(cleaned);
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(parsed), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }
}

async function main() {
  const targetEmail = process.argv[2] || 'kawidi2336@luxudata.com';
  console.log(`\n🔍 Cercando utente con email: ${targetEmail}`);

  initAdmin();
  const app = getApp();
  const auth = getAuth(app);

  // 1. Trova UID da email in Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(targetEmail);
    console.log(`✅ Utente trovato in Firebase Auth:`);
    console.log(`   UID: ${userRecord.uid}`);
    console.log(`   Email: ${userRecord.email}`);
    console.log(`   DisplayName: ${userRecord.displayName || '(non impostato)'}`);
    console.log(`   EmailVerified: ${userRecord.emailVerified}`);
  } catch (err) {
    console.log(`❌ Utente non trovato in Firebase Auth: ${err.message}`);
    process.exit(1);
  }

  const uid = userRecord.uid;

  // 2. Controlla tutti i database tenant
  const tenants = [
    { name: 'acchiari (default)', db: getFirestore(app) },
    { name: 'acbrescia', db: getFirestore(app, 'acbrescia') },
  ];

  for (const { name, db } of tenants) {
    const docRef = db.collection('users').doc(uid);
    const snap = await docRef.get();
    if (snap.exists) {
      console.log(`\n📂 ${name}: documento PRESENTE`);
      console.log('   Data:', JSON.stringify(snap.data(), null, 2));
    } else {
      console.log(`\n📂 ${name}: documento ASSENTE`);
    }
  }

  // 3. Crea il documento in acbrescia se manca
  const acbresciaDb = getFirestore(app, 'acbrescia');
  const userRef = acbresciaDb.collection('users').doc(uid);
  const existing = await userRef.get();

  if (!existing.exists) {
    const displayName = userRecord.displayName || targetEmail.split('@')[0];
    const parts = displayName.split(' ');
    const nome = parts[0] || '';
    const cognome = parts.slice(1).join(' ') || '';

    await userRef.set({
      id: uid,
      nome,
      cognome,
      displayName,
      email: targetEmail,
      roles: ['utente'],
      emailVerified: userRecord.emailVerified,
      createdAt: Timestamp.now(),
    });
    console.log(`\n✅ Documento creato in acbrescia per ${targetEmail} (uid: ${uid})`);
  } else {
    console.log(`\nℹ️  Documento già presente in acbrescia — aggiorno emailVerified...`);
    await userRef.update({ emailVerified: userRecord.emailVerified });
  }

  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
