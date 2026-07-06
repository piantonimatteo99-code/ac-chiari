/**
 * Deploia le Firestore Security Rules direttamente al database acbrescia
 * usando la Firebase Rules API con il service account.
 */
const https = require('https');
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

const { GoogleAuth } = require('google-auth-library');

async function main() {
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  console.log(`📋 Progetto: ${projectId}`);
  console.log(`📄 Rules: ${rulesPath} (${rulesContent.length} chars)`);

  // Ottieni access token dal service account
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const cleaned = sa.trim().replace(/^'([\s\S]*)'$/, '$1');
  const parsed = JSON.parse(cleaned);
  if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;
  console.log('✅ Access token ottenuto');

  // 1. Crea un nuovo ruleset
  const rulesetBody = JSON.stringify({
    source: {
      files: [{
        content: rulesContent,
        name: 'firestore.rules',
      }],
    },
  });

  console.log('\n📤 Creazione ruleset...');
  const rulesetResult = await makeRequest({
    method: 'POST',
    hostname: 'firebaserules.googleapis.com',
    path: `/v1/projects/${projectId}/rulesets`,
    token: accessToken,
    body: rulesetBody,
  });

  const rulesetName = rulesetResult.name;
  console.log(`✅ Ruleset creato: ${rulesetName}`);

  // 2. Aggiorna il Release per il database acbrescia
  const releaseBody = JSON.stringify({
    release: {
      name: `projects/${projectId}/releases/cloud.firestore/acbrescia`,
      rulesetName: rulesetName,
    },
  });

  console.log('\n📤 Applicazione rules ad acbrescia...');
  try {
    const releaseResult = await makeRequest({
      method: 'PATCH',
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${projectId}/releases/cloud.firestore%2Facbrescia`,
      token: accessToken,
      body: releaseBody,
    });
    console.log('✅ Rules applicate ad acbrescia!', releaseResult.name);
  } catch (patchErr) {
    // Se PATCH fallisce (release non esiste), prova con PUT
    console.log('  PATCH fallito, provo con PUT...');
    try {
      const putResult = await makeRequest({
        method: 'PUT',
        hostname: 'firebaserules.googleapis.com',
        path: `/v1/projects/${projectId}/releases/cloud.firestore%2Facbrescia`,
        token: accessToken,
        body: releaseBody,
      });
      console.log('✅ Rules applicate ad acbrescia (PUT)!', putResult.name);
    } catch (putErr) {
      // Prova a creare il release
      console.log('  PUT fallito, creo release...');
      const createResult = await makeRequest({
        method: 'POST',
        hostname: 'firebaserules.googleapis.com',
        path: `/v1/projects/${projectId}/releases`,
        token: accessToken,
        body: releaseBody,
      });
      console.log('✅ Release creato per acbrescia!', createResult.name);
    }
  }

  // 3. Verifica il release attuale per acbrescia
  console.log('\n🔍 Verifica release corrente per acbrescia...');
  try {
    const current = await makeRequest({
      method: 'GET',
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${projectId}/releases/cloud.firestore%2Facbrescia`,
      token: accessToken,
    });
    console.log('📋 Release attivo:', JSON.stringify(current, null, 2));
  } catch (e) {
    console.log('❌ Impossibile leggere il release:', e.message);
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

function makeRequest({ method, hostname, path, token, body }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
