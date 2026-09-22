import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdminApp } from '@/lib/firebase-admin';

/**
 * Format a UTC ISO timestamp as a YYYY-MM-DD string in the Europe/Rome timezone.
 * This avoids off-by-one errors when the server runs in UTC but events are
 * created/displayed in Italy (UTC+1 or UTC+2 in summer).
 */
function toRomeDateString(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(d);
}

/**
 * Return the YYYY-MM-DD string for the day *after* the given local date string.
 * Used to produce Google Calendar's exclusive end-date for all-day events.
 */
function nextLocalDay(localDateStr: string): string {
  const [y, m, d] = localDateStr.split('-').map(Number);
  // Build a UTC noon timestamp for that date, then add one day
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().split('T')[0];
}

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
    extendedProperties: {
      private: {
        source: 'ac-chiari',
      },
    },
  };

  if (event.allDay) {
    const startStr = toRomeDateString(event.startDate);
    const endStr   = nextLocalDay(toRomeDateString(event.endDate));
    googleEvent.start = { date: startStr };
    googleEvent.end   = { date: endStr };
  } else {
    googleEvent.start = { dateTime: new Date(event.startDate).toISOString(), timeZone: 'Europe/Rome' };
    googleEvent.end   = { dateTime: new Date(event.endDate).toISOString(), timeZone: 'Europe/Rome' };
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

/** Find an event on the user's primary calendar matching title, start date and allDay status. */
export async function findEventOnUserCalendar(
  userId: string,
  event: { title: string; startDate: string; allDay: boolean }
): Promise<string | null> {
  const accessToken = await getAccessToken(userId);

  // Search window: 24h before to 24h after
  const startD = new Date(event.startDate);
  const timeMin = new Date(startD.getTime() - 24 * 60 * 60 * 1000);
  const timeMax = new Date(startD.getTime() + 24 * 60 * 60 * 1000);

  const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  calendarUrl.searchParams.set('timeMin', timeMin.toISOString());
  calendarUrl.searchParams.set('timeMax', timeMax.toISOString());
  calendarUrl.searchParams.set('singleEvents', 'true');
  calendarUrl.searchParams.set('maxResults', '100');

  const res = await fetch(calendarUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`findEventOnUserCalendar error for user ${userId}: ${errText}`);
    return null;
  }

  const data = await res.json();
  const items = data.items || [];
  const targetTitle = (event.title || '').trim().toLowerCase();

  for (const item of items) {
    const itemTitle = (item.summary || '').trim().toLowerCase();
    if (itemTitle !== targetTitle) continue;

    if (event.allDay) {
      // Compare using the Rome-local date so the lookup matches what was pushed
      const targetDateStr = toRomeDateString(event.startDate);
      const itemDateStr = item.start?.date;
      if (itemDateStr === targetDateStr) {
        return item.id;
      }
    } else {
      const targetTime = new Date(event.startDate).getTime();
      const itemTime = item.start?.dateTime ? new Date(item.start.dateTime).getTime() : null;
      if (itemTime && Math.abs(itemTime - targetTime) <= 5 * 60 * 1000) {
        return item.id;
      }
    }
  }

  return null;
}

/** Update an existing Google Calendar event. */
export async function updateEventForUser(
  userId: string,
  googleEventId: string,
  event: { title: string; description?: string; startDate: string; endDate: string; allDay: boolean }
): Promise<void> {
  const accessToken = await getAccessToken(userId);

  const googleEvent: any = {
    summary: event.title,
    description: event.description || '',
    extendedProperties: {
      private: {
        source: 'ac-chiari',
      },
    },
  };

  if (event.allDay) {
    const startStr = toRomeDateString(event.startDate);
    const endStr   = nextLocalDay(toRomeDateString(event.endDate));
    googleEvent.start = { date: startStr };
    googleEvent.end   = { date: endStr };
  } else {
    googleEvent.start = { dateTime: new Date(event.startDate).toISOString(), timeZone: 'Europe/Rome' };
    googleEvent.end   = { dateTime: new Date(event.endDate).toISOString(), timeZone: 'Europe/Rome' };
  }

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(googleEvent),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore aggiornamento evento per ${userId}: ${errText}`);
  }
}

/** Delete an existing Google Calendar event. */
export async function deleteEventForUser(
  userId: string,
  googleEventId: string
): Promise<void> {
  const accessToken = await getAccessToken(userId);

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 410 && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Errore eliminazione evento per ${userId}: ${errText}`);
  }
}

/**
 * Pushes all FUTURE events (startDate >= now) for the given groupIds
 * to the user's primary Google Calendar.
 *
 * Used in three scenarios:
 *  1. First time a user connects Google Calendar (callback route)
 *  2. User adds new groups to their sync settings
 *  3. Admin migration for existing connected users
 *
 * Events in the past are NEVER pushed (per product requirement).
 * Events already present in Google Calendar are skipped (no duplicates).
 */
export async function syncFutureEventsForUser(
  userId: string,
  groupIds: string[]
): Promise<{ pushed: number; skipped: number; errors: string[] }> {
  if (!groupIds.length) return { pushed: 0, skipped: 0, errors: [] };

  initAdminApp();
  const db = getFirestore();
  const now = Timestamp.now();

  // Fetch all events with startDate >= today
  const eventsSnap = await db.collection('eventi')
    .where('startDate', '>=', now)
    .get();

  // Keep only events belonging to at least one of the user's groups
  const matching = eventsSnap.docs.filter(d => {
    const eg: string[] = d.data().groupIds || [];
    return eg.some(gid => groupIds.includes(gid));
  });

  let pushed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const eventDoc of matching) {
    const data = eventDoc.data();
    const startDate = (data.startDate as Timestamp).toDate();
    const endDate   = (data.endDate   as Timestamp).toDate();
    const eventPayload = {
      title:       data.title || '(Senza titolo)',
      description: data.description || '',
      startDate:   startDate.toISOString(),
      endDate:     endDate.toISOString(),
      allDay:      !!data.allDay,
    };

    try {
      // ── Deduplication: skip if the event already exists in GCal ───────────
      // This prevents creating duplicates when sync runs after a broadcastEvent
      // already pushed the same event (e.g. migration after initial broadcast).
      const existingId = await findEventOnUserCalendar(userId, eventPayload);
      if (existingId) {
        skipped++;
        continue;
      }

      await pushEventToUser(userId, eventPayload);
      pushed++;
    } catch (err: any) {
      // If the token is revoked/invalid, stop immediately — all further calls will fail
      if (
        err.message?.includes('Token refresh fallito') ||
        err.message?.includes('Refresh token mancante') ||
        err.message?.includes('non connesso')
      ) {
        errors.push(`Token non valido per ${userId}: ${err.message}`);
        break;
      }
      // Individual event failures are logged but don't abort the whole sync
      errors.push(`evento ${eventDoc.id}: ${err.message}`);
    }
  }

  return { pushed, skipped, errors };
}

/**
 * Scans a user's Google Calendar for duplicate events (same title + same date)
 * within the given time window (defaults: now → +1 year) and deletes all but
 * the earliest-created copy of each duplicate group.
 *
 * Returns { checked, removed, errors }.
 */
export async function removeDuplicateEventsForUser(
  userId: string,
  options: { timeMin?: Date; timeMax?: Date } = {}
): Promise<{ checked: number; removed: number; errors: string[] }> {
  const accessToken = await getAccessToken(userId);

  const timeMin = options.timeMin ?? new Date();
  const timeMax = options.timeMax ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  // Fetch all events in the window
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin.toISOString());
  url.searchParams.set('timeMax', timeMax.toISOString());
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('maxResults', '1000');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Errore listing GCal per ${userId}: ${errText}`);
  }

  const data = await res.json();
  const items: Record<string, unknown>[] = data.items || [];

  // Carica i titoli noti di AC Chiari da Firestore per non toccare MAI eventi personali
  initAdminApp();
  const db = getFirestore();
  const acEventsSnap = await db.collection('eventi').get();
  const acTitles = new Set<string>();
  acEventsSnap.docs.forEach(d => {
    const t = (d.data().title || '').trim().toLowerCase();
    if (t) acTitles.add(t);
  });

  // Group by (title + start-date) key
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const item of items) {
    const title = ((item.summary as string) || '').trim().toLowerCase();
    const start = item.start as Record<string, string> | undefined;
    // All-day: YYYY-MM-DD  |  Timed: YYYY-MM-DDTHH:mm (truncated to minute)
    const dateKey = start?.date
      ?? (start?.dateTime ? new Date(start.dateTime).toISOString().slice(0, 16) : 'unknown');
    const key = `${title}|${dateKey}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let removed = 0;
  const errors: string[] = [];

  for (const group of Array.from(groups.values())) {
    if (group.length <= 1) continue;

    // SICUREZZA: non toccare MAI eventi personali al di fuori di AC Chiari
    const sample = group[0];
    const sampleTitle = ((sample.summary as string) || '').trim().toLowerCase();
    const extProps = sample.extendedProperties as { private?: Record<string, string> } | undefined;
    const isAcChiari =
      extProps?.private?.source === 'ac-chiari' ||
      acTitles.has(sampleTitle);

    if (!isAcChiari) {
      // Evento personale dell'utente (compleanni, viaggi, visite, ecc.): NON TOCCARE
      continue;
    }

    // Sort by creation time — keep the earliest, delete the rest
    group.sort((a, b) => {
      const ta = a.created ? new Date(a.created as string).getTime() : 0;
      const tb = b.created ? new Date(b.created as string).getTime() : 0;
      return ta - tb;
    });

    for (let i = 1; i < group.length; i++) {
      const eventId = group[i].id as string;
      try {
        await deleteEventForUser(userId, eventId);
        removed++;
      } catch (err: any) {
        errors.push(`evento ${eventId}: ${err.message}`);
      }
    }
  }

  return { checked: items.length, removed, errors };
}
