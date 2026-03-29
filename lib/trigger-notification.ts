/**
 * Client-side utility to trigger a notification by calling the API route.
 * Fire-and-forget: errors are logged but never bubble up to the UI.
 *
 * Usage:
 *   triggerNotification({ eventType: 'evento_nuovo', title: '...', body: '...' })
 */

import type { NotificaEventType } from '@/lib/notification-types';

export interface TriggerNotificationPayload {
  /** The notification event type (used to check global config & user prefs) */
  eventType: NotificaEventType;
  /** Short title for the notification */
  title: string;
  /** Body text */
  body: string;
  /** Optional deep-link within the app */
  href?: string;
  /**
   * Target: specific uid, or '__broadcast__' for all users (default).
   * Leave empty for broadcast.
   */
  userId?: string;
}

/**
 * Calls POST /api/send-notification in a fire-and-forget manner.
 * Maps NotificaEventType to the notification `type` category.
 */
export async function triggerNotification(payload: TriggerNotificationPayload): Promise<void> {
  const typeMap: Record<NotificaEventType, 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback'> = {
    evento_nuovo: 'evento',
    evento_modificato: 'evento',
    evento_rimosso: 'evento',
    evento_promemoria: 'evento',
    presenza_scadenza_conferma: 'evento',
    presenza_registrata: 'evento',
    raccolta_nuova: 'pagamento',
    raccolta_scadenza: 'pagamento',
    pagamento_ricevuto: 'pagamento',
    pagamento_in_attesa: 'pagamento',
    transazione_da_controllare: 'pagamento',
    prodotto_in_scadenza: 'magazzino',
    prodotto_esaurito: 'magazzino',
    tesseramento_scadenza: 'iscrizione',
    nuovo_iscritto: 'iscrizione',
    iscrizione_confermata: 'iscrizione',
    nuovo_membro_gruppo: 'generale',
    progetto_nuovo: 'generale',
    progetto_scadenza: 'generale',
    nuovo_utente: 'generale',
    nuovo_feedback: 'feedback',
    comunicazione_generale: 'generale',
  };

  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: payload.userId ?? '__broadcast__',
        title: payload.title,
        body: payload.body,
        type: typeMap[payload.eventType] ?? 'generale',
        href: payload.href,
        eventType: payload.eventType,
      }),
    });
  } catch (err) {
    // Non-blocking: log only
    console.warn('[triggerNotification] Failed:', err);
  }
}
