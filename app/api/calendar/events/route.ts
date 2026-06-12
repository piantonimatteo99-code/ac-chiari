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
 * PATCH /api/calendar/events
 * Finds and updates an existing event on the user's Google Calendar.
 * If the event is not found (e.g. created before the timezone fix), it creates a new one.
 * Body: { userId, oldTitle, oldStartDate, oldAllDay, title, description, startDate, endDate, allDay }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, oldTitle, oldStartDate, oldAllDay, title, description, startDate, endDate, allDay } = body;

    if (!userId || !title || !startDate) {
      return NextResponse.json({ error: 'userId, title e startDate sono obbligatori' }, { status: 400 });
    }

    const accessToken = await getAccessToken(userId);

    // ── 1. Find the existing event ──────────────────────────────────────────
    const searchStart = new Date(oldStartDate || startDate);
    const timeMin = new Date(searchStart.getTime() - 36 * 60 * 60 * 1000);
    const timeMax = new Date(searchStart.getTime() + 36 * 60 * 60 * 1000);

    const searchUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    searchUrl.searchParams.set('timeMin', timeMin.toISOString());
    searchUrl.searchParams.set('timeMax', timeMax.toISOString());
    searchUrl.searchParams.set('singleEvents', 'true');
    searchUrl.searchParams.set('maxResults', '100');

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let googleEventId: string | null = null;

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const items: any[] = searchData.items || [];
      const targetTitle = ((oldTitle || title) || '').trim().toLowerCase();

      const toRomeDate = (iso: string) =>
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));
      const targetDateStr = toRomeDate(oldStartDate || startDate);

      for (const item of items) {
        const itemTitle = (item.summary || '').trim().toLowerCase();
        if (itemTitle !== targetTitle) continue;

        if (oldAllDay ?? allDay) {
          // All-day event: compare the date string
          // Match either the correct date (after fix) or the old wrong UTC date (before fix)
          const itemDate = item.start?.date;
          if (itemDate === targetDateStr) {
            googleEventId = item.id;
            break;
          }
          // Also try the UTC-shifted date (for events created before the timezone fix)
          const utcDate = new Date(oldStartDate || startDate).toISOString().split('T')[0];
          if (itemDate === utcDate) {
            googleEventId = item.id;
            break;
          }
        } else {
          const targetTime = new Date(oldStartDate || startDate).getTime();
          const itemTime = item.start?.dateTime ? new Date(item.start.dateTime).getTime() : null;
          if (itemTime && Math.abs(itemTime - targetTime) <= 5 * 60 * 1000) {
            googleEventId = item.id;
            break;
          }
        }
      }
    }

    // ── 2. Build the updated event payload ──────────────────────────────────
    const toRomeDate = (iso: string) =>
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));

    const googleEvent: any = {
      summary: title,
      description: description || '',
    };

    if (allDay) {
      const startStr = toRomeDate(startDate);
      const endRome = toRomeDate(endDate || startDate);
      const [ey, em, ed] = endRome.split('-').map(Number);
      const finalEndStr = new Date(Date.UTC(ey, em - 1, ed + 1)).toISOString().split('T')[0];
      googleEvent.start = { date: startStr };
      googleEvent.end = { date: finalEndStr };
    } else {
      googleEvent.start = { dateTime: new Date(startDate).toISOString(), timeZone: 'Europe/Rome' };
      googleEvent.end = { dateTime: new Date(endDate).toISOString(), timeZone: 'Europe/Rome' };
    }

    // ── 3. Update if found, otherwise create ────────────────────────────────
    let response: Response;
    if (googleEventId) {
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEvent),
        }
      );
    } else {
      // Event not found (e.g. never synced or created before fix) → create it
      response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEvent),
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Errore aggiornamento evento: ${errText}`);
    }

    const result = await response.json();
    return NextResponse.json({ success: true, googleEventId: result.id, action: googleEventId ? 'updated' : 'created' });
  } catch (err: any) {
    console.error('Calendar event update error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}



/**
 * DELETE /api/calendar/events?userId=xxx&eventTitle=xxx&eventStartDate=xxx&allDay=true
 * Finds and deletes a specific event from the user's Google Calendar.
 *
 * DELETE /api/calendar/events?userId=xxx&connected=false
 * Disconnects the user's Google Calendar by removing credentials (existing behaviour).
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId richiesto' }, { status: 400 });
  }

  // ── Mode A: delete a specific event ──────────────────────────────────────
  const eventTitle     = searchParams.get('eventTitle');
  const eventStartDate = searchParams.get('eventStartDate');
  const allDay         = searchParams.get('allDay') === 'true';

  if (eventTitle && eventStartDate) {
    try {
      const accessToken = await getAccessToken(userId);

      // Search window ±36h around the event start
      const searchStart = new Date(eventStartDate);
      const timeMin = new Date(searchStart.getTime() - 36 * 60 * 60 * 1000);
      const timeMax = new Date(searchStart.getTime() + 36 * 60 * 60 * 1000);

      const searchUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      searchUrl.searchParams.set('timeMin', timeMin.toISOString());
      searchUrl.searchParams.set('timeMax', timeMax.toISOString());
      searchUrl.searchParams.set('singleEvents', 'true');
      searchUrl.searchParams.set('maxResults', '100');

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        throw new Error(`Errore ricerca evento: ${errText}`);
      }

      const searchData = await searchRes.json();
      const items: any[] = searchData.items || [];
      const targetTitle = eventTitle.trim().toLowerCase();

      const toRomeDate = (iso: string) =>
        new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date(iso));
      const targetDateStr = toRomeDate(eventStartDate);
      const utcDateStr    = new Date(eventStartDate).toISOString().split('T')[0];

      let googleEventId: string | null = null;
      for (const item of items) {
        const itemTitle = (item.summary || '').trim().toLowerCase();
        if (itemTitle !== targetTitle) continue;

        if (allDay) {
          const itemDate = item.start?.date;
          // Match correct Rome date OR old wrong UTC date (pre-fix events)
          if (itemDate === targetDateStr || itemDate === utcDateStr) {
            googleEventId = item.id;
            break;
          }
        } else {
          const targetTime = new Date(eventStartDate).getTime();
          const itemTime = item.start?.dateTime ? new Date(item.start.dateTime).getTime() : null;
          if (itemTime && Math.abs(itemTime - targetTime) <= 5 * 60 * 1000) {
            googleEventId = item.id;
            break;
          }
        }
      }

      if (googleEventId) {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!delRes.ok && delRes.status !== 410 && delRes.status !== 404) {
          const errText = await delRes.text();
          throw new Error(`Errore eliminazione evento: ${errText}`);
        }
        return NextResponse.json({ success: true, deleted: true });
      }

      // Event not found on Google Calendar — nothing to delete
      return NextResponse.json({ success: true, deleted: false });
    } catch (err: any) {
      console.error('Calendar single event delete error:', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ── Mode B: disconnect Google Calendar (existing behaviour) ───────────────
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
