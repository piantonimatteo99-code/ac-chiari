/**
 * Central definition of all notification event types.
 * Used by: Admin config page, user preferences, API route, and sidebar badges.
 */

export type NotificaEventType =
  // Calendario
  | 'evento_nuovo'
  | 'evento_modificato'
  | 'evento_rimosso'
  | 'evento_promemoria'
  | 'evento_promemoria_sera'
  | 'evento_promemoria_mezzogiorno'
  // Presenze
  | 'presenza_scadenza_conferma'
  | 'presenza_registrata'
  // Pagamenti & Contabilità
  | 'raccolta_nuova'
  | 'raccolta_scadenza'
  | 'pagamento_ricevuto'
  | 'pagamento_in_attesa'
  | 'transazione_da_controllare'
  // Magazzino
  | 'prodotto_in_scadenza'
  | 'prodotto_esaurito'
  // Tesseramento & Iscrizioni
  | 'tesseramento_scadenza'
  | 'nuovo_iscritto'
  | 'iscrizione_confermata'
  // Gruppi & Progetti
  | 'nuovo_membro_gruppo'
  | 'progetto_nuovo'
  | 'progetto_scadenza'
  // Amministrazione
  | 'nuovo_utente'
  | 'nuovo_feedback'
  | 'comunicazione_generale';

export interface NotificaTypeDefinition {
  id: NotificaEventType;
  label: string;
  description: string;
  category: string;
  icon: string;
  /** Chi può ricevere questa notifica */
  recipients: ('admin' | 'educatore' | 'genitore' | 'tutti')[];
  /** Default abilitata globalmente? */
  defaultEnabled: boolean;
}

export const NOTIFICA_TYPE_DEFINITIONS: NotificaTypeDefinition[] = [
  // ── CALENDARIO ──
  {
    id: 'evento_nuovo',
    label: 'Nuovo evento in calendario',
    description: 'Notifica quando viene aggiunto un nuovo evento nel calendario del gruppo.',
    category: 'Calendario',
    icon: '📅',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  {
    id: 'evento_modificato',
    label: 'Evento modificato',
    description: 'Notifica quando un evento esistente viene modificato (data, luogo, orario).',
    category: 'Calendario',
    icon: '✏️',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  {
    id: 'evento_rimosso',
    label: 'Evento annullato',
    description: 'Notifica quando un evento viene annullato o eliminato.',
    category: 'Calendario',
    icon: '❌',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  {
    id: 'evento_promemoria',
    label: 'Promemoria evento (24h prima)',
    description: 'Promemoria automatico 24 ore prima di ogni evento del gruppo.',
    category: 'Calendario',
    icon: '⏰',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  {
    id: 'evento_promemoria_sera',
    label: 'Promemoria sera prima dell\'evento',
    description: 'Promemoria inviato la sera precedente (ore 20:00) a ogni evento del gruppo.',
    category: 'Calendario',
    icon: '🌙',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  {
    id: 'evento_promemoria_mezzogiorno',
    label: 'Promemoria mezzogiorno del giorno stesso',
    description: 'Promemoria inviato alle 12:00 del giorno stesso dell\'evento.',
    category: 'Calendario',
    icon: '☀️',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
  // ── PRESENZE ──
  {
    id: 'presenza_scadenza_conferma',
    label: 'Scadenza conferma presenza',
    description: 'Notifica ai genitori quando si avvicina la scadenza per confermare la presenza a un evento.',
    category: 'Presenze',
    icon: '✋',
    recipients: ['genitore'],
    defaultEnabled: true,
  },
  {
    id: 'presenza_registrata',
    label: 'Presenza registrata',
    description: 'Notifica al genitore quando la presenza di un figlio viene registrata dall\'educatore.',
    category: 'Presenze',
    icon: '✅',
    recipients: ['genitore'],
    defaultEnabled: false,
  },
  // ── PAGAMENTI ──
  {
    id: 'raccolta_nuova',
    label: 'Nuova raccolta fondi aperta',
    description: 'Notifica quando viene aperta una nuova raccolta (quota eventi, gite, campo estivo, ecc.).',
    category: 'Pagamenti',
    icon: '💳',
    recipients: ['genitore', 'educatore'],
    defaultEnabled: true,
  },
  {
    id: 'raccolta_scadenza',
    label: 'Scadenza pagamento raccolta',
    description: 'Promemoria quando si avvicina la scadenza per pagare una raccolta.',
    category: 'Pagamenti',
    icon: '⚠️',
    recipients: ['genitore'],
    defaultEnabled: true,
  },
  {
    id: 'pagamento_ricevuto',
    label: 'Pagamento confermato',
    description: 'Conferma al genitore quando il pagamento di una raccolta viene registrato.',
    category: 'Pagamenti',
    icon: '💚',
    recipients: ['genitore'],
    defaultEnabled: true,
  },
  {
    id: 'pagamento_in_attesa',
    label: 'Pagamento in contanti in attesa',
    description: 'Notifica all\'admin quando un genitore dichiara un pagamento in contanti da verificare.',
    category: 'Pagamenti',
    icon: '💰',
    recipients: ['admin', 'educatore'],
    defaultEnabled: true,
  },
  {
    id: 'transazione_da_controllare',
    label: 'Transazione da controllare',
    description: 'Notifica quando una transazione bancaria arriva e deve essere associata manualmente.',
    category: 'Pagamenti',
    icon: '🔍',
    recipients: ['admin'],
    defaultEnabled: true,
  },
  // ── MAGAZZINO ──
  {
    id: 'prodotto_in_scadenza',
    label: 'Prodotto in scadenza nel magazzino',
    description: 'Avviso quando un prodotto alimentare del magazzino è in scadenza entro 7 giorni.',
    category: 'Magazzino',
    icon: '📦',
    recipients: ['admin', 'educatore'],
    defaultEnabled: true,
  },
  {
    id: 'prodotto_esaurito',
    label: 'Prodotto esaurito',
    description: 'Notifica quando la quantità di un prodotto raggiunge zero.',
    category: 'Magazzino',
    icon: '🚫',
    recipients: ['admin'],
    defaultEnabled: true,
  },
  // ── TESSERAMENTO ──
  {
    id: 'tesseramento_scadenza',
    label: 'Rinnovo tesseramento in scadenza',
    description: 'Promemoria ai genitori quando il tesseramento di un componente è in scadenza.',
    category: 'Tesseramento',
    icon: '🎫',
    recipients: ['genitore'],
    defaultEnabled: true,
  },
  {
    id: 'nuovo_iscritto',
    label: 'Nuovo iscritto nel gruppo',
    description: 'Notifica all\'educatore quando un nuovo membro si iscrive al suo gruppo.',
    category: 'Tesseramento',
    icon: '👋',
    recipients: ['admin', 'educatore'],
    defaultEnabled: true,
  },
  {
    id: 'iscrizione_confermata',
    label: 'Iscrizione confermata',
    description: 'Conferma al genitore quando l\'iscrizione di un componente viene approvata.',
    category: 'Tesseramento',
    icon: '📝',
    recipients: ['genitore'],
    defaultEnabled: true,
  },
  // ── GRUPPI & PROGETTI ──
  {
    id: 'nuovo_membro_gruppo',
    label: 'Nuovo membro aggiunto al gruppo',
    description: 'Notifica all\'educatore quando un membro viene aggiunto o spostato nel suo gruppo.',
    category: 'Gruppi & Progetti',
    icon: '👥',
    recipients: ['educatore'],
    defaultEnabled: false,
  },
  {
    id: 'progetto_nuovo',
    label: 'Nuovo progetto creato',
    description: 'Notifica quando viene creato un nuovo progetto che coinvolge il gruppo.',
    category: 'Gruppi & Progetti',
    icon: '🚀',
    recipients: ['educatore', 'genitore'],
    defaultEnabled: true,
  },
  {
    id: 'progetto_scadenza',
    label: 'Scadenza progetto',
    description: 'Promemoria quando si avvicina la data di fine di un progetto attivo.',
    category: 'Gruppi & Progetti',
    icon: '📌',
    recipients: ['educatore'],
    defaultEnabled: false,
  },
  // ── AMMINISTRAZIONE ──
  {
    id: 'nuovo_utente',
    label: 'Nuovo utente registrato',
    description: 'Notifica all\'amministratore quando un nuovo utente completa la registrazione.',
    category: 'Amministrazione',
    icon: '🆕',
    recipients: ['admin'],
    defaultEnabled: true,
  },
  {
    id: 'nuovo_feedback',
    label: 'Nuovo feedback / segnalazione',
    description: 'Notifica all\'amministratore quando un utente invia un feedback o segnala un problema.',
    category: 'Amministrazione',
    icon: '💬',
    recipients: ['admin'],
    defaultEnabled: true,
  },
  {
    id: 'comunicazione_generale',
    label: 'Comunicazione generale',
    description: 'Comunicazioni e avvisi generali inviati manualmente dall\'amministratore a tutti gli utenti.',
    category: 'Amministrazione',
    icon: '📢',
    recipients: ['tutti'],
    defaultEnabled: true,
  },
];

/** Raggruppa le definizioni per categoria */
export function getNotificasByCategory() {
  const map = new Map<string, NotificaTypeDefinition[]>();
  NOTIFICA_TYPE_DEFINITIONS.forEach(n => {
    if (!map.has(n.category)) map.set(n.category, []);
    map.get(n.category)!.push(n);
  });
  return map;
}

/** Tipi di notifica che sono promemoria evento inviati automaticamente */
export const REMINDER_EVENT_TYPES: NotificaEventType[] = [
  'evento_promemoria',
  'evento_promemoria_sera',
  'evento_promemoria_mezzogiorno',
];
