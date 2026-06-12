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
    const gruppiSnap = await db.collection('gruppi').get();
    console.log(`Trovati ${gruppiSnap.size} gruppi.`);

    for (const doc of gruppiSnap.docs) {
      const data = doc.data();
      const gid = doc.id;
      console.log(`- Gruppo: ${data.nome} (ID: ${gid})`);
      const educatori = data.educatorIds || [];
      console.log(`  Educatori: ${educatori.join(', ')}`);
      
      const membriSnap = await db.collection('gruppi').doc(gid).collection('membri').get();
      console.log(`  Membri (${membriSnap.size}):`);
      membriSnap.docs.forEach(m => {
        console.log(`    * ${m.data().userId ?? m.id} (${m.data().nome || 'Senza Nome'})`);
      });
    }
  } catch (error) {
    console.error('Errore:', error);
  }
}

run();
