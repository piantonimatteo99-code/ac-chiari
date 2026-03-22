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

  // Check connection status on mount
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

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Check for connection success/error from URL params after OAuth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === 'true') {
      setIsConnected(true);
      loadEvents();
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('calendar_error')) {
      setError(`Errore connessione: ${params.get('calendar_error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connect to Google Calendar
  const connect = useCallback(() => {
    if (!user) return;
    window.location.href = `/api/calendar/auth?userId=${user.uid}`;
  }, [user]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!user) return;
    try {
      await fetch(`/api/calendar/events?userId=${user.uid}`, { method: 'DELETE' });
      setIsConnected(false);
      setEvents([]);
    } catch (err: any) {
      setError(err.message);
    }
  }, [user]);

  // Load events from Google Calendar
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
    if (isConnected) {
      loadEvents();
    }
  }, [isConnected, loadEvents]);

  // Push a single event to Google Calendar
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

  // Convert a Google Calendar event to a calendar-compatible format
  const googleEventsAsCalendar = events.map((ev) => {
    const isAllDay = !!ev.start.date;
    const startDate = isAllDay
      ? new Date(ev.start.date + 'T00:00:00')
      : new Date(ev.start.dateTime!);
    const endDate = isAllDay
      ? new Date(ev.end.date + 'T23:59:59')
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
  };
}
