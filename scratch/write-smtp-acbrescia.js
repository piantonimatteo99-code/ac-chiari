/**
 * Scrive la config SMTP direttamente nel database acbrescia.
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
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
    console.log('✅ Firebase Admin inizializzato');
  }
}

async function main() {
  initAdmin();
  const app = getApp();
  const dbAcbrescia = getFirestore(app, 'acbrescia');

  const smtpConfig = {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: env.SMTP_PORT || '587',
    secure: env.SMTP_SECURE === 'true' ? true : false,
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
    updatedAt: Timestamp.now(),
    copiedFrom: 'env-local (acchiari credentials)',
  };

  console.log('\n📤 Scrittura config SMTP in acbrescia...');
  console.log('   Host:', smtpConfig.host);
  console.log('   Port:', smtpConfig.port);
  console.log('   User:', smtpConfig.user);
  console.log('   Pass:', smtpConfig.pass ? '✅' : '❌');

  await dbAcbrescia.collection('config').doc('smtp').set(smtpConfig);
  console.log('\n✅ Config SMTP scritta con successo in acbrescia!');
  
  // Verifica
  const verify = await dbAcbrescia.collection('config').doc('smtp').get();
  const d = verify.data();
  console.log('\n🔍 Verifica:', { host: d.host, port: d.port, user: d.user, pass: d.pass ? '✅' : '❌' });
  
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
