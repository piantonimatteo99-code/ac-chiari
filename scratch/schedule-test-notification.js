const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Read env variables
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

// Helper to convert Rome timezone offset
function parseOffset(tzName) {
  if (tzName === 'GMT') return 0;
  const match = tzName.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes);
}

function getRomeTimeInUTC(year, month, day, hours, minutes, seconds, ms = 0) {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, ms));
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    timeZoneName: 'longOffset'
  });
  const parts = tzFormatter.formatToParts(utcDate);
  const tzName = parts.find(p => p.type === 'timeZoneName').value;
  const offsetMinutes = parseOffset(tzName);
  return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
}

function getRomeCurrentDateComponents() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value);
  const day = parseInt(parts.find(p => p.type === 'day').value);
  return { year, month, day };
}

async function run() {
  try {
    initAdminApp();
    const db = admin.firestore();

    // 1. Create a test event scheduled for today in Rome time
    const today = getRomeCurrentDateComponents();
    // Schedule event for today at 23:00 Rome time
    const eventStartDate = getRomeTimeInUTC(today.year, today.month, today.day, 23, 0, 0, 0);

    const eventId = 'test-reminder-event-5min';
    const eventRef = db.collection('eventi').doc(eventId);
    
    console.log(`[Test] Creo evento di test '${eventId}' previsto per il ${eventStartDate.toISOString()}`);
    await eventRef.set({
      title: 'Prova Notifica 5 Minuti',
      startDate: admin.firestore.Timestamp.fromDate(eventStartDate),
      groupIds: ['0v3uF63EpRZrIsg8AaCA'], // Gruppo di Matteo Piantoni
      nome: 'Prova Notifica 5 Minuti',
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log('[Test] Evento creato con successo.');
    console.log('[Test] Avvio conto alla rovescia di 5 minuti...');

    let minutesLeft = 5;
    const interval = setInterval(() => {
      minutesLeft--;
      if (minutesLeft > 0) {
        console.log(`[Test] Mancano ${minutesLeft} minut${minutesLeft === 1 ? 'o' : 'i'}...`);
      } else {
        clearInterval(interval);
      }
    }, 60000); // every 1 minute

    // Wait 5 minutes (300,000 ms)
    setTimeout(async () => {
      console.log('[Test] Tempo scaduto! Invio richiesta all\'API per i promemoria...');
      
      try {
        const url = 'http://localhost:3000/api/send-event-reminders';
        const payload = {
          type: 'mezzogiorno',
          secret: 'test_cron_secret'
        };

        console.log(`[Test] Chiamata POST a ${url} con payload:`, payload);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('[Test] Risposta dall\'API:', data);
      } catch (err) {
        console.error('[Test] Errore durante la chiamata API:', err.message);
      } finally {
        console.log('[Test] Pulizia: elimino l\'evento di test da Firestore...');
        await eventRef.delete();
        console.log('[Test] Pulizia completata.');
        process.exit(0);
      }
    }, 300000);

  } catch (error) {
    console.error('Errore generico nello script:', error);
    process.exit(1);
  }
}

run();
