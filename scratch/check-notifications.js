const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
    const notifSnap = await db.collection('notifiche')
      .where('userId', '==', 'j9Qr5yvXKSUjiJw8gB39o1U7Zks2')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
      
    console.log(`Trovate ${notifSnap.size} ultime notifiche per l'utente.`);
    notifSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- Notifica ID: ${doc.id}`);
      console.log(`  Titolo: ${data.title}`);
      console.log(`  Corpo: ${data.body}`);
      console.log(`  Creata il: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
      console.log(`  Tipo: ${data.type}`);
      console.log(`  Evento ID: ${data.eventType}`);
    });
  } catch (error) {
    console.error('Errore:', error);
  }
}

run();
