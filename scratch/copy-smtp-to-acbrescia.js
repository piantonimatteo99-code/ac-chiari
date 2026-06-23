/**
 * Script: copy-smtp-to-acbrescia.js
 * Legge la configurazione SMTP da acchiari e la copia in acbrescia.
 * Esecuzione: node scratch/copy-smtp-to-acbrescia.js
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

async function main() {
  try {
    initAdmin();
    const app = getApp();

    // Leggi SMTP da acchiari (default database)
    const dbAcchiari = getFirestore(app);
    const smtpDoc = await dbAcchiari.collection('config').doc('smtp').get();

    if (!smtpDoc.exists) {
      console.log('\n⚠️  Nessuna config SMTP trovata in acchiari (config/smtp).');
      console.log('   Provo a usare le variabili d\'ambiente...');

      console.log('\n📋 Variabili d\'ambiente SMTP:');
      console.log('   SMTP_HOST:', process.env.SMTP_HOST || '(non impostata)');
      console.log('   SMTP_PORT:', process.env.SMTP_PORT || '(non impostata)');
      console.log('   SMTP_USER:', process.env.SMTP_USER ? '✅ impostata' : '(non impostata)');
      console.log('   SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? '✅ impostata' : '(non impostata)');

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
        console.log('\n➡️  Copio env vars come config SMTP in acbrescia...');
        const dbAcbrescia = getFirestore(app, 'acbrescia');
        await dbAcbrescia.collection('config').doc('smtp').set({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
          updatedAt: Timestamp.now(),
          source: 'env-fallback',
        });
        console.log('✅ Config SMTP da env copiata in acbrescia!');
      } else {
        console.log('\n❌ Nessuna configurazione SMTP disponibile (né Firestore né env vars).');
        console.log('   Vai su acchiari.gemmaflow.it/admin/configurazione/configurazione-smtp');
        console.log('   e salva la configurazione SMTP, poi riesegui questo script.');
      }
      process.exit(0);
    }

    const smtpData = smtpDoc.data();
    console.log('\n📋 Config SMTP trovata in acchiari:');
    console.log('   Host:', smtpData.host);
    console.log('   Port:', smtpData.port);
    console.log('   User:', smtpData.user);
    console.log('   Pass:', smtpData.pass ? '✅ presente' : '❌ mancante');

    // Copia in acbrescia
    const dbAcbrescia = getFirestore(app, 'acbrescia');
    const existingSmtp = await dbAcbrescia.collection('config').doc('smtp').get();

    if (existingSmtp.exists) {
      console.log('\n⚠️  acbrescia ha già una config SMTP — sovrascivo...');
    }

    await dbAcbrescia.collection('config').doc('smtp').set({
      ...smtpData,
      updatedAt: Timestamp.now(),
      copiedFrom: 'acchiari',
    });

    console.log('\n✅ Config SMTP copiata con successo: acchiari → acbrescia!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Errore:', err.message);
    process.exit(1);
  }
}

main();
