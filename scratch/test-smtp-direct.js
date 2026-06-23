/**
 * Test diretto del server SMTP per acbrescia
 * node scratch/test-smtp-direct.js
 */
const nodemailer = require('nodemailer');
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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
  }
}

async function main() {
  initAdmin();
  const app = getApp();
  
  // Leggi SMTP da Firestore acbrescia
  const db = getFirestore(app, 'acbrescia');
  const smtpDoc = await db.collection('config').doc('smtp').get();
  
  if (!smtpDoc.exists) {
    console.log('❌ Nessuna config SMTP in Firestore acbrescia!');
    process.exit(1);
  }
  
  const data = smtpDoc.data();
  console.log('📋 Config SMTP trovata in acbrescia Firestore:');
  console.log('   Host:', data.host);
  console.log('   Port:', data.port);
  console.log('   User:', data.user);
  console.log('   Pass:', data.pass ? '✅' : '❌');
  
  // Test connessione SMTP
  const transporter = nodemailer.createTransport({
    host: data.host,
    port: parseInt(data.port || '587'),
    secure: data.secure === true,
    auth: { user: data.user, pass: data.pass },
  });
  
  console.log('\n🔌 Test connessione SMTP...');
  try {
    await transporter.verify();
    console.log('✅ Connessione SMTP OK!');
  } catch (err) {
    console.log('❌ Connessione SMTP fallita:', err.message);
    process.exit(1);
  }
  
  // Invia email di test
  console.log('\n📧 Invio email di test a piantonimatteo.99@gmail.com...');
  try {
    const result = await transporter.sendMail({
      from: `"GemmaFlow / AC Brescia" <${data.user}>`,
      to: 'piantonimatteo.99@gmail.com',
      subject: '✅ Test SMTP acbrescia - GemmaFlow',
      html: '<p>Se ricevi questa email, il sistema SMTP per <strong>acbrescia</strong> funziona correttamente!</p>',
    });
    console.log('✅ Email inviata! MessageId:', result.messageId);
  } catch (err) {
    console.log('❌ Invio email fallito:', err.message);
  }
  
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
