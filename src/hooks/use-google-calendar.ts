'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/src/firebase';

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  htmlLink?: string;
}

export function useGoogleCalendar() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = loading
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncGroupIds, setSyncGroupIds] = useState<string[]>([]);
  const [isLoadingSyncSettings, setIsLoadingSyncSettings] = useState(false);

  // ── Status ─────────────────────────────────────────────────────────────────
  const checkStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/calendar/status?userId=${user.uid}`);
      const data = await res.json();
      setIsConnected(data.connected);
      return data.connected;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [user]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Check for OAuth redirect result
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      setIsConnected(true);
      loadEvents();
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('calendar_error')) {
      setError(`Errore connessione: ${params.get('calendar_error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect / Disconnect ───────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!user) return;
    window.location.href = `/api/calendar/auth?userId=${user.uid}`;
  }, [user]);

  const disconnect = useCallback(async () => {
    if (!user) return;
    try {
      await fetch(`/api/calendar/events?userId=${user.uid}`, { method: 'DELETE' });
      // Also update calendarSubscriptions
      await fetch('/api/calendar/sync-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, syncGroupIds: [], connected: false }),
      });
      setIsConnected(false);
      setEvents([]);
      setSyncGroupIds([]);
    } catch (err: any) {
      setError(err.message);
    }
  }, [user]);

  // ── Events ────────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    if (!user) return;
    setIsLoadingEvents(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events?userId=${user.uid}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEvents(data.events ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [user]);

  useEffect(() => {
    if (isConnected) { loadEvents(); }
  }, [isConnected, loadEvents]);

  // ── Push to current user only (kept for backwards compat) ─────────────────
  const pushEvent = useCallback(
    async (event: {
      title: string;
      description?: string;
      startDate: Date | string;
      endDate: Date | string;
      allDay: boolean;
    }): Promise<boolean> => {
      if (!user || !isConnected) return false;
      try {
        const res = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            title: event.title,
            description: event.description,
            startDate: new Date(event.startDate).toISOString(),
            endDate: new Date(event.endDate).toISOString(),
            allDay: event.allDay,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return true;
      } catch (err: any) {
        console.error('Failed to push event to Google Calendar:', err);
        return false;
      }
    },
    [user, isConnected]
  );

  // ── Broadcast to ALL subscribed users ─────────────────────────────────────
  /**
   * Pushes an event to:
   * 1. The current user's Google Calendar (if connected).
   * 2. All other users who have at least one of groupIds in their syncGroupIds.
   */
  const broadcastEvent = useCallback(
    async (event: {
      title: string;
      description?: string;
      startDate: Date | string;
      endDate: Date | string;
      allDay: boolean;
      groupIds: string[];
    }): Promise<void> => {
      if (!user) return;
      const startISO = new Date(event.startDate).toISOString();
      const endISO = new Date(event.endDate).toISOString();

      // 1. Push to creator's own calendar if connected
      if (isConnected) {
        await pushEvent({ ...event, startDate: startISO, endDate: endISO }).catch(console.error);
      }

      // 2. Broadcast to all other subscribed users
      fetch('/api/calendar/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupIds: event.groupIds,
          title: event.title,
          description: event.description,
          startDate: startISO,
          endDate: endISO,
          allDay: event.allDay,
          creatorUserId: user.uid, // excluded from broadcast (already pushed above)
        }),
      }).catch(console.error); // fire-and-forget, don't block the UI
    },
    [user, isConnected, pushEvent]
  );

  // ── Sync settings (which groups' events sync to user's GCal) ──────────────
  const loadSyncSettings = useCallback(async () => {
    if (!user) return;
    setIsLoadingSyncSettings(true);
    try {
      const res = await fetch(`/api/calendar/sync-settings?userId=${user.uid}`);
      const data = await res.json();
      setSyncGroupIds(data.syncGroupIds ?? []);
    } catch {
      // ignore
    } finally {
      setIsLoadingSyncSettings(false);
    }
  }, [user]);

  // Load sync settings when connected
  useEffect(() => {
    if (isConnected && user) { loadSyncSettings(); }
  }, [isConnected, user, loadSyncSettings]);

  const updateSyncGroups = useCallback(
    async (newGroupIds: string[]) => {
      if (!user) return;
      setSyncGroupIds(newGroupIds); // optimistic
      try {
        await fetch('/api/calendar/sync-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, syncGroupIds: newGroupIds }),
        });
      } catch (err: any) {
        setError(`Errore salvataggio preferenze: ${err.message}`);
      }
    },
    [user]
  );

  // ── Convert Google events for the calendar ────────────────────────────────
  const googleEventsAsCalendar = events.map((ev) => {
    const isAllDay = !!ev.start.date;
    const startDate = isAllDay
      ? new Date(ev.start.date + 'T00:00:00')
      : new Date(ev.start.dateTime!);
    // Google Calendar API returns end.date as EXCLUSIVE (day after last day).
    // We subtract 1 day to get the actual last day of the event.
    const endDate = isAllDay
      ? (() => { const d = new Date(ev.end.date + 'T00:00:00'); d.setDate(d.getDate() - 1); d.setHours(23, 59, 59, 999); return d; })()
      : new Date(ev.end.dateTime!);
    return {
      id: `gcal_${ev.id}`,
      title: ev.summary || '(Senza titolo)',
      description: ev.description,
      startDate,
      endDate,
      allDay: isAllDay,
      groupIds: [] as string[],
      isGoogleCalendar: true,
      htmlLink: ev.htmlLink,
    };
  });

  return {
    isConnected,
    events: googleEventsAsCalendar,
    isLoadingEvents,
    error,
    connect,
    disconnect,
    loadEvents,
    pushEvent,
    broadcastEvent,
    syncGroupIds,
    isLoadingSyncSettings,
    updateSyncGroups,
  };
}
