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

if (getApps().length === 0) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const cleaned = sa.trim().replace(/^'([\s\S]*)'$/, '$1');
  const parsed = JSON.parse(cleaned);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  initializeApp({ credential: cert(parsed), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

const db = getFirestore(getApp(), 'acbrescia');
db.collection('config').doc('smtp').update({
  fromName: 'AC Brescia',
  replyTo: 'gemmaflowsistem@gmail.com',
}).then(() => {
  console.log('✅ fromName="AC Brescia" e replyTo aggiornati in acbrescia!');
  process.exit(0);
}).catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
