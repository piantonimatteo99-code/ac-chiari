/**
 * Test: verifica se le Firestore Security Rules bloccano la lettura su acbrescia.
 * Usa l'Admin SDK (bypassa rules) per confermare che il documento esiste,
 * poi mostra cosa succederebbe con un client autenticato.
 * 
 * node scratch/check-rules-acbrescia.js kawidi2336@luxudata.com
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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
  initAdmin();
  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app, 'acbrescia');

  // 1. Trova utente
  let user;
  try {
    user = await auth.getUserByEmail(targetEmail);
    console.log(`✅ Utente in Firebase Auth: uid=${user.uid}, emailVerified=${user.emailVerified}`);
  } catch (e) {
    console.log('❌ Utente non trovato in Auth:', e.message);
    process.exit(1);
  }

  // 2. Leggi documento con Admin SDK (bypassa rules)
  const userRef = db.collection('users').doc(user.uid);
  const snap = await userRef.get();
  
  if (snap.exists) {
    const data = snap.data();
    console.log(`\n✅ Documento utente presente in acbrescia Firestore:`);
    console.log(`   roles: [${data.roles?.join(', ')}]`);
    console.log(`   email: ${data.email}`);
    console.log(`   emailVerified: ${data.emailVerified}`);
  } else {
    console.log('\n❌ Documento utente NON presente in acbrescia!');
    process.exit(1);
  }

  // 3. Simula un custom token per testare le rules
  console.log('\n🔑 Genero un custom token per simulare il login...');
  try {
    const customToken = await auth.createCustomToken(user.uid);
    console.log('✅ Custom token generato');
    console.log('\n💡 SUGGERIMENTO: Le Security Rules per acbrescia potrebbero non essere state deploiate.');
    console.log('   Prova a deployarle con: npx firebase-tools deploy --only firestore:rules');
    console.log('\n   Oppure verifica su Firebase Console:');
    console.log('   https://console.firebase.google.com/project/ac-chiari-import-2024/firestore/databases/acbrescia/rules');
  } catch (e) {
    console.log('❌ Errore custom token:', e.message);
  }

  // 4. Verifica anche il documento in acchiari per confronto
  const dbDefault = getFirestore(app);
  const snapDefault = await dbDefault.collection('users').doc(user.uid).get();
  console.log(`\n📊 Documento in acchiari (default): ${snapDefault.exists ? '✅ presente' : '❌ assente'}`);

  console.log('\n🔧 AZIONE RICHIESTA:');
  console.log('   Vai su Firebase Console → Firestore → Database: acbrescia → Rules');
  console.log('   URL: https://console.firebase.google.com/project/ac-chiari-import-2024/firestore/databases/-acbrescia-/rules');
  console.log('   Verifica che le rules siano state publicate correttamente.');

  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
