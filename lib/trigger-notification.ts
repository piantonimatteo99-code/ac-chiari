/**
 * Client-side utility to trigger a notification.
 * Calls the API which:
 *  1. Saves the notification to Firestore (in-app bell)
 *  2. Sends Native Web Push to subscribed devices (iOS PWA + Android + Desktop)
 *
 * Fire-and-forget: errors are logged but never bubble up to the UI.
 */

import type { NotificaEventType } from '@/lib/notification-types';

export interface TriggerNotificationPayload {
  eventType: NotificaEventType;
  title: string;
  body: string;
  href?: string;
  /** Specific user uid, or '__broadcast__' for all (default) */
  userId?: string;
}

const TYPE_MAP: Record<NotificaEventType, 'pagamento' | 'evento' | 'iscrizione' | 'magazzino' | 'generale' | 'feedback'> = {
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

export async function triggerNotification(payload: TriggerNotificationPayload): Promise<void> {
  const userId = payload.userId ?? '__broadcast__';

  // 1. Save to Firestore (in-app notification bell) and send Native FCM/WebPush via unified backend
  fetch('/api/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      title: payload.title,
      body: payload.body,
      type: TYPE_MAP[payload.eventType] ?? 'generale',
      href: payload.href,
      eventType: payload.eventType,
    }),
  }).catch(err => console.warn('[triggerNotification] Failed:', err));
}
