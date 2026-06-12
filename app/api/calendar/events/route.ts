import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

async function getAccessToken(userId: string): Promise<string> {
  initAdminApp();
  const db = getFirestore();
  const tokenDoc = await db.collection('users').doc(userId).collection('private').doc('google-calendar').get();

  if (!tokenDoc.exists) {
    throw new Error('Google Calendar non connesso per questo utente.');
  }

  const tokenData = tokenDoc.data()!;
  const refreshToken = tokenData.refreshToken;

  if (!refreshToken) {
    throw new Error('Refresh token mancante.');
  }

  // Always refresh to get a valid token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const newTokens = await tokenResponse.json();

  if (newTokens.error) {
    // Token might be revoked — mark as disconnected
    await db.collection('users').doc(userId).collection('private').doc('google-calendar').set(
      { connected: false },
      { merge: true }
    );
    throw new Error(`Token refresh fallito: ${newTokens.error}`);
  }

  // Update stored access token
  await db.collection('users').doc(userId).collection('private').doc('google-calendar').set(
    { accessToken: newTokens.access_token, updatedAt: new Date() },
    { merge: true }
  );

  return newTokens.access_token;
}

/**
 * GET /api/calendar/events?userId=xxx
 * Returns Google Calendar events for the user (next 30 days + past 7 days)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId richiesto' }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(userId);

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 90);

    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    calendarUrl.searchParams.set('timeMin', timeMin.toISOString());
    calendarUrl.searchParams.set('timeMax', timeMax.toISOString());
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', '250');

    const calendarResponse = await fetch(calendarUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!calendarResponse.ok) {
      const errText = await calendarResponse.text();
      throw new Error(`Google Calendar API error: ${errText}`);
    }

    const calendarData = await calendarResponse.json();
    return NextResponse.json({ events: calendarData.items ?? [] });
  } catch (err: any) {
    console.error('Calendar events fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/calendar/events
 * Creates an event in the user's Google Calendar
 * Body: { userId, title, description, startDate, endDate, allDay }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, title, description, startDate, endDate, allDay } = body;

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId e title sono obbligatori' }, { status: 400 });
    }

    const accessToken = await getAccessToken(userId);

    const googleEvent: any = {
      summary: title,
      description: description || '',
    };

    if (allDay) {
      // Google Calendar requires date strings (not datetime) for all-day events.
      // IMPORTANT: use Europe/Rome locale so that a midnight Italian timestamp is
      // never shifted back to the previous UTC day (e.g. 2026-06-13T00:00+02:00
      // would become "2026-06-12" if converted via toISOString() which uses UTC).
      const toRomeDate = (iso: string) =>
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));

      const startStr = toRomeDate(startDate);

      // Google Calendar end date is exclusive → add one calendar day to the Rome date
      let finalEndStr: string;
      if (endDate && endDate !== startDate) {
        const endRome = toRomeDate(endDate);
        const [ey, em, ed] = endRome.split('-').map(Number);
        finalEndStr = new Date(Date.UTC(ey, em - 1, ed + 1)).toISOString().split('T')[0];
      } else {
        const [y, m, d] = startStr.split('-').map(Number);
        finalEndStr = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().split('T')[0];
      }

      googleEvent.start = { date: startStr };
      googleEvent.end = { date: finalEndStr };

    } else {
      googleEvent.start = { dateTime: new Date(startDate).toISOString(), timeZone: 'Europe/Rome' };
      googleEvent.end = { dateTime: new Date(endDate).toISOString(), timeZone: 'Europe/Rome' };
    }

    const createResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      throw new Error(`Errore creazione evento: ${errText}`);
    }

    const created = await createResponse.json();
    return NextResponse.json({ success: true, googleEventId: created.id });
  } catch (err: any) {
    console.error('Calendar event creation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/calendar/events?userId=xxx&connected=false
 * Disconnects the user's Google Calendar by removing credentials
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId richiesto' }, { status: 400 });
  }

  try {
    initAdminApp();
    const db = getFirestore();
    await db.collection('users').doc(userId).collection('private').doc('google-calendar').set(
      { connected: false, refreshToken: null, accessToken: null },
      { merge: true }
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
