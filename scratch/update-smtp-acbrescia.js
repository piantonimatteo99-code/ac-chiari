/**
 * Aggiorna la config SMTP di acbrescia con le credenziali GemmaFlow.
 */
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
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
  initAdmin();
  const db = getFirestore(getApp(), 'acbrescia');

  const smtpConfig = {
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    user: 'gemmaflowsistem@gmail.com',
    pass: 'plcd ynmm upse zznh',
    updatedAt: Timestamp.now(),
    updatedBy: 'admin-script',
  };

  await db.collection('config').doc('smtp').set(smtpConfig);
  console.log('✅ Config SMTP acbrescia aggiornata!');
  console.log('   User:', smtpConfig.user);
  console.log('   Host:', smtpConfig.host + ':' + smtpConfig.port);

  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
