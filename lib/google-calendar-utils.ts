import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

/** Refresh the stored token and return a valid access token for the given user. */
export async function getAccessToken(userId: string): Promise<string> {
  initAdminApp();
  const db = getFirestore();
  const tokenDoc = await db
    .collection('users')
    .doc(userId)
    .collection('private')
    .doc('google-calendar')
    .get();

  if (!tokenDoc.exists) throw new Error('Google Calendar non connesso per questo utente.');

  const tokenData = tokenDoc.data()!;
  if (!tokenData.refreshToken) throw new Error('Refresh token mancante.');

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: tokenData.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await tokenResponse.json();

  if (newTokens.error) {
    await db
      .collection('users').doc(userId)
      .collection('private').doc('google-calendar')
      .set({ connected: false }, { merge: true });
    throw new Error(`Token refresh fallito: ${newTokens.error}`);
  }

  await db
    .collection('users').doc(userId)
    .collection('private').doc('google-calendar')
    .set({ accessToken: newTokens.access_token, updatedAt: new Date() }, { merge: true });

  return newTokens.access_token;
}

/** Push a single event to the given user's primary Google Calendar. */
export async function pushEventToUser(
  userId: string,
  event: { title: string; description?: string; startDate: string; endDate: string; allDay: boolean }
): Promise<void> {
  const accessToken = await getAccessToken(userId);

  const googleEvent: any = {
    summary: event.title,
    description: event.description || '',
  };

  if (event.allDay) {
    const startStr = new Date(event.startDate).toISOString().split('T')[0];
    const endD = new Date(event.endDate);
    endD.setDate(endD.getDate() + 1);
    const endStr = endD.toISOString().split('T')[0];
    googleEvent.start = { date: startStr };
    googleEvent.end = { date: endStr };
  } else {
    googleEvent.start = { dateTime: new Date(event.startDate).toISOString(), timeZone: 'Europe/Rome' };
    googleEvent.end = { dateTime: new Date(event.endDate).toISOString(), timeZone: 'Europe/Rome' };
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(googleEvent),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore creazione evento per ${userId}: ${errText}`);
  }
}
