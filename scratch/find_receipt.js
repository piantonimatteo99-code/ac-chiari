const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const keyLine = envContent.split('\n').find(l => l.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
let value = keyLine.split('=')[1].trim();
if (value.startsWith("'") && value.endsWith("'")) {
  value = value.substring(1, value.length - 1);
} else if (value.startsWith('"') && value.endsWith('"')) {
  value = value.substring(1, value.length - 1);
}

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

let serviceAccount = JSON.parse(value);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: projectId
});

// We'll scan both '(default)' and 'acbrescia' databases
const dbDefault = admin.firestore();
const dbBrescia = admin.firestore().valueType ? null : admin.firestore().doc ? null : admin.firestore; // we get the database instance by name
const { getFirestore } = require('firebase-admin/firestore');
const app = admin.apps[0];

const dbs = {
  '(default)': getFirestore(app, '(default)'),
  'acbrescia': getFirestore(app, 'acbrescia')
};

async function scanDb(db, dbName) {
  console.log(`\n================ SCANNING DATABASE: ${dbName} ================`);
  try {
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections in database ${dbName}.`);
    
    for (const coll of collections) {
      const collId = coll.id;
      const snap = await coll.limit(100).get(); // Scan up to 100 docs per collection
      console.log(`Checking collection "${collId}" (${snap.size} docs)...`);
      
      snap.forEach(doc => {
        const data = doc.data();
        const dataStr = JSON.stringify(data);
        
        // Search for Google Drive, Firebase Storage, or receiptUrl patterns
        if (dataStr.includes('drive.google.com') || 
            dataStr.includes('firebasestorage') || 
            dataStr.includes('view-receipt') ||
            dataStr.includes('receiptUrl')) {
          console.log(`  [MATCH] Doc ID: ${doc.id} in collection "${collId}"`);
          
          // Print matching fields
          findMatchingFields(data, '');
        }
      });
    }
  } catch (err) {
    console.error(`Error scanning database ${dbName}:`, err.message);
  }
}

function findMatchingFields(obj, prefix) {
  if (!obj || typeof obj !== 'object') return;
  
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof val === 'string') {
      if (val.includes('drive.google.com') || 
          val.includes('firebasestorage') || 
          val.includes('view-receipt') ||
          key.toLowerCase().includes('receipt')) {
        console.log(`    - ${fullKey}: "${val}"`);
      }
    } else if (typeof val === 'object' && val !== null) {
      findMatchingFields(val, fullKey);
    }
  });
}

async function run() {
  await scanDb(dbs['(default)'], '(default)');
  await scanDb(dbs['acbrescia'], 'acbrescia');
  console.log("\nScan complete.");
}

run().catch(console.error);
