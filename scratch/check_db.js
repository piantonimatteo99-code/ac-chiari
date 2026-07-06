const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. Read .env.local manually
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error("Could not find .env.local at: " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');

// Find the line starting with FIREBASE_SERVICE_ACCOUNT_KEY
const keyLine = envContent.split('\n').find(l => l.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
if (!keyLine) {
  console.error("Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  process.exit(1);
}

let value = keyLine.split('=')[1].trim();
if (value.startsWith("'") && value.endsWith("'")) {
  value = value.substring(1, value.length - 1);
} else if (value.startsWith('"') && value.endsWith('"')) {
  value = value.substring(1, value.length - 1);
}

// Get NEXT_PUBLIC_FIREBASE_PROJECT_ID
const projectLine = envContent.split('\n').find(l => l.trim().startsWith('NEXT_PUBLIC_FIREBASE_PROJECT_ID='));
let projectId = 'ac-chiari-import-2024';
if (projectLine) {
  let projectVal = projectLine.split('=')[1].trim();
  if (projectVal.startsWith('"') && projectVal.endsWith('"')) {
    projectId = projectVal.substring(1, projectVal.length - 1);
  } else if (projectVal.startsWith("'") && projectVal.endsWith("'")) {
    projectId = projectVal.substring(1, projectVal.length - 1);
  }
}

let serviceAccount;
try {
  // Parse JSON directly first
  serviceAccount = JSON.parse(value);
  // Replace double escaped newlines inside the parsed key
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error("Error parsing service account key:", err.message);
  process.exit(1);
}

// 2. Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId
});

const db = admin.firestore();

async function run() {
  console.log("Checking Firestore collections...");
  
  // A. Check recent "spese"
  try {
    const speseSnap = await db.collection('spese').orderBy('data', 'desc').limit(5).get();
    console.log(`\n--- RECENT SPESE (Total docs: ${speseSnap.size}) ---`);
    speseSnap.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Descrizione: ${data.descrizione}`);
      console.log(`Importo: ${data.importo}`);
      console.log(`Data: ${data.data}`);
      console.log(`Receipt URL: ${data.receiptUrl}`);
      console.log('--------------------');
    });
  } catch (err) {
    console.error("Error fetching spese:", err.message);
  }

  // B. Check "famiglie" for recent payments
  try {
    const famiglieSnap = await db.collection('famiglie').get();
    console.log(`\n--- Checking famiglie for payments... ---`);
    let foundPayments = [];
    
    famiglieSnap.forEach(doc => {
      const data = doc.data();
      if (data.paymentDetails) {
        // Collect all payments in this family
        Object.keys(data.paymentDetails).forEach(phase => {
          const phaseDetails = data.paymentDetails[phase];
          if (phaseDetails && typeof phaseDetails === 'object') {
            Object.keys(phaseDetails).forEach(memberId => {
              const payment = phaseDetails[memberId];
              if (payment && payment.receiptUrl) {
                foundPayments.push({
                  famigliaId: doc.id,
                  cognome: data.cognome,
                  phase,
                  memberId,
                  receiptUrl: payment.receiptUrl,
                  updatedAt: payment.updatedAt?.toDate ? payment.updatedAt.toDate() : payment.updatedAt
                });
              }
            });
          }
        });
      }
    });

    // Sort by updatedAt desc
    foundPayments.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
      const dateB = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
      return dateB - dateA;
    });

    console.log(`Found ${foundPayments.length} payments with receipts.`);
    foundPayments.slice(0, 10).forEach(p => {
      console.log(`Famiglia: ${p.cognome} (${p.famigliaId})`);
      console.log(`Member: ${p.memberId}, Phase: ${p.phase}`);
      console.log(`Receipt URL: ${p.receiptUrl}`);
      console.log(`Updated At: ${p.updatedAt}`);
      console.log('--------------------');
    });
  } catch (err) {
    console.error("Error checking famiglie:", err.message);
  }
}

run().catch(console.error);
