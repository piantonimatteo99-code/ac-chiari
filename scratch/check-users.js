const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read env variables
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

function initAdminApp() {
  const serviceAccount = env['FIREBASE_SERVICE_ACCOUNT_KEY'];
  if (serviceAccount) {
    const cleaned = serviceAccount.trim().replace(/^'([\s\S]*)'$/, '$1');
    const parsed = JSON.parse(cleaned);
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    });
  } else {
    admin.initializeApp({
      projectId: env['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    });
  }
}

async function run() {
  try {
    initAdminApp();
    const db = admin.firestore();
    const usersSnap = await db.collection('users').get();
    console.log(`Trovati ${usersSnap.size} utenti nel database.`);

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const uid = doc.id;
      const nome = data.displayName || data.email || uid;
      
      const wpSnap = await db.collection('users').doc(uid).collection('webPushSubscriptions').get();
      const fcmSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
      
      console.log(`- Utente: ${nome} (UID: ${uid})`);
      console.log(`  WebPush Subscriptions: ${wpSnap.size}`);
      console.log(`  FCM Tokens: ${fcmSnap.size}`);
    }
  } catch (error) {
    console.error('Errore:', error);
  }
}

run();
