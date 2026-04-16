/**
 * assistant-knowledge-map.ts
 *
 * Mappa statica degli intent dell'utente → azione UI da evidenziare.
 * Ogni entry descrive:
 *  - keywords: frasi/parole chiave in italiano (usate dall'AI per la classificazione fuzzy)
 *  - route: percorso Next.js a cui navigare (null = pagina corrente)
 *  - selector: selettore CSS dell'elemento da evidenziare (null = solo navigare)
 *  - sidebarAccordion: ID dell'accordion nella sidebar da aprire (null = nessuno)
 *  - description: risposta testuale da mostrare all'utente
 */

export interface AssistantAction {
  id: string;
  keywords: string[];
  route: string | null;
  selector: string | null;
  sidebarAccordion: string | null;
  description: string;
}

export const KNOWLEDGE_MAP: AssistantAction[] = [
  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  {
    id: 'go-dashboard',
    keywords: ['dashboard', 'home', 'inizio', 'pagina principale', 'torna a casa', 'schermata iniziale'],
    route: '/dashboard',
    selector: 'a[href="/dashboard"]',
    sidebarAccordion: null,
    description: 'Puoi tornare alla Dashboard cliccando sul link "Dashboard" nella barra laterale.',
  },

  // ── ISCRIZIONI ────────────────────────────────────────────────────────────
  {
    id: 'go-iscrizioni',
    keywords: ['iscrizioni', 'iscrivere', 'iscritto', 'iscritti', 'registrazione famiglia', 'pagare iscrizione', 'quota iscrizione'],
    route: '/iscrizioni',
    selector: 'a[href="/iscrizioni"]',
    sidebarAccordion: null,
    description: 'Vai alla sezione "Iscrizioni" tramite la barra laterale per gestire le iscrizioni delle famiglie.',
  },
  {
    id: 'pay-iscrizione',
    keywords: ['pagare', 'pagamento', 'carica ricevuta', 'invia ricevuta', 'bonifico', 'pago', 'come pago', 'effettuare pagamento'],
    route: '/iscrizioni',
    selector: '[data-assistant="pay-receipt-btn"]',
    sidebarAccordion: null,
    description: 'Nella pagina Iscrizioni seleziona le voci da pagare e poi clicca "Paga e Carica Ricevuta" in basso.',
  },
  {
    id: 'complete-profile-iscrizioni',
    keywords: ['dati mancanti', 'profilo incompleto', 'codice fiscale mancante', 'inserire dati personali', 'dati anagrafici'],
    route: '/iscrizioni',
    selector: '[data-assistant="complete-profile-btn"]',
    sidebarAccordion: null,
    description: 'Per procedere con le iscrizioni devi prima completare i tuoi dati personali: clicca "Inserisci i dati" nella pagina Iscrizioni.',
  },

  // ── NUCLEO FAMILIARE ──────────────────────────────────────────────────────
  {
    id: 'go-nucleo-familiare',
    keywords: ['nucleo familiare', 'famiglia', 'familiare', 'genitore', 'figlio', 'componente', 'miei familiari'],
    route: '/nucleo-familiare',
    selector: 'a[href="/nucleo-familiare"]',
    sidebarAccordion: null,
    description: 'Vai su "Nucleo Familiare" nella sidebar per visualizzare e gestire i componenti della tua famiglia.',
  },
  {
    id: 'add-familiare',
    keywords: ['aggiungere familiare', 'nuovo familiare', 'aggiungi componente', 'inserire figlio', 'aggiungere membro famiglia', 'aggiungi membro', 'registrare figlio', 'nuovo membro'],
    route: '/nucleo-familiare',
    selector: '[data-assistant="add-familiare-btn"]',
    sidebarAccordion: null,
    description: 'Nella pagina "Nucleo Familiare" trovi il pulsante "Aggiungi Membro" per inserire un nuovo componente della famiglia.',
  },
  {
    id: 'join-family',
    keywords: ['unirsi famiglia', 'codice famiglia', 'unisciti famiglia', 'già registrato', 'famiglia esistente', 'collega famiglia'],
    route: '/nucleo-familiare',
    selector: '[data-assistant="join-family-btn"]',
    sidebarAccordion: null,
    description: 'Se un tuo familiare è già registrato, usa "Unisciti a una Famiglia" nella pagina Nucleo Familiare per collegare i profili.',
  },

  // ── CALENDARIO ────────────────────────────────────────────────────────────
  {
    id: 'go-calendario',
    keywords: ['calendario', 'eventi', 'agenda', 'appuntamento', 'date', 'quando', 'orari', 'prossimi eventi'],
    route: '/calendario',
    selector: 'a[href="/calendario"]',
    sidebarAccordion: null,
    description: 'Vai su "Calendario" nella barra laterale per visualizzare tutti gli eventi.',
  },
  {
    id: 'add-evento',
    keywords: ['aggiungere evento', 'nuovo evento', 'creare evento', 'aggiungere appuntamento', 'inserire data', 'pianificare evento'],
    route: '/calendario',
    selector: '[data-assistant="add-event-btn"]',
    sidebarAccordion: null,
    description: 'Nella pagina "Calendario" clicca il pulsante "Aggiungi Impegno" per creare un nuovo evento (solo admin/educatori).',
  },
  {
    id: 'connect-google-calendar',
    keywords: ['google calendar', 'sincronizzare calendario', 'connetti google', 'collegare google calendar', 'sync calendario'],
    route: '/calendario',
    selector: '[data-assistant="connect-gcal-btn"]',
    sidebarAccordion: null,
    description: 'Nella pagina Calendario clicca "Connetti Google Calendar" per sincronizzare gli eventi con il tuo account Google.',
  },
  {
    id: 'view-week-calendar',
    keywords: ['settimana', 'vista settimanale', 'visualizzazione settimana', 'questa settimana'],
    route: '/calendario',
    selector: null,
    sidebarAccordion: null,
    description: 'Nel Calendario usa il selettore in alto a destra e scegli "Settimana" per vedere la vista settimanale.',
  },

  // ── MAGAZZINO ─────────────────────────────────────────────────────────────
  {
    id: 'go-magazzino',
    keywords: ['magazzino', 'inventario', 'prodotti', 'scorte', 'alimenti', 'scadenza', 'dispensa', 'cancelleria'],
    route: '/magazzino',
    selector: 'a[href="/magazzino"]',
    sidebarAccordion: null,
    description: 'Vai su "Magazzino" nella sidebar per gestire l\'inventario e i prodotti.',
  },
  {
    id: 'add-alimento',
    keywords: ['aggiungere alimento', 'nuovo prodotto', 'inserire alimento', 'aggiungere cibo', 'nuovo cibo', 'add food'],
    route: '/magazzino',
    selector: '[data-assistant="add-alimento-btn"]',
    sidebarAccordion: null,
    description: 'Nel Magazzino vai alla tab "Alimenti" e clicca "Aggiungi Alimento" per inserire un nuovo prodotto.',
  },
  {
    id: 'check-scadenze',
    keywords: ['prodotti in scadenza', 'scadenza', 'scaduti', 'cosa scade', 'alimenti scaduti'],
    route: '/magazzino',
    selector: null,
    sidebarAccordion: null,
    description: 'Nel Magazzino trovi in cima un alert con i prodotti in scadenza o già scaduti. I prodotti sono ordinati per data di scadenza.',
  },

  // ── CONTABILITÀ ───────────────────────────────────────────────────────────
  {
    id: 'go-contabilita',
    keywords: ['contabilità', 'contabile', 'conto', 'soldi', 'denaro', 'bilancio', 'finanze', 'tesoreria'],
    route: '/contabilita/conto',
    selector: null,
    sidebarAccordion: 'contabilita',
    description: 'Apri la sezione "Contabilità" nella sidebar per accedere al conto e alle transazioni.',
  },
  {
    id: 'add-movimento',
    keywords: ['aggiungere movimento', 'nuovo movimento', 'registrare entrata', 'registrare uscita', 'movimento contabile'],
    route: '/contabilita/conto',
    selector: '[data-assistant="add-movimento-btn"]',
    sidebarAccordion: 'contabilita',
    description: 'Nella pagina "Conto Generale" clicca "Aggiungi Movimento" per registrare un\'entrata o un\'uscita manuale.',
  },
  {
    id: 'go-raccolte',
    keywords: ['raccolta', 'raccolte', 'raccolta fondi', 'raccolta attiva', 'nuova raccolta', 'gestire raccolta'],
    route: '/contabilita/raccolte',
    selector: 'a[href="/contabilita/raccolte"]',
    sidebarAccordion: 'contabilita',
    description: 'Vai su "Raccolte attive" nella sezione Contabilità per gestire le raccolte fondi.',
  },
  {
    id: 'add-raccolta',
    keywords: ['creare raccolta', 'nuova raccolta fondi', 'avviare raccolta', 'aprire raccolta'],
    route: '/contabilita/raccolte',
    selector: '[data-assistant="add-raccolta-btn"]',
    sidebarAccordion: 'contabilita',
    description: 'Nella pagina Raccolte clicca "Aggiungi Raccolta" per creare una nuova raccolta fondi.',
  },
  {
    id: 'go-spese',
    keywords: ['spese', 'spesa', 'uscita', 'costo', 'rimborso', 'spesa sostenuta'],
    route: '/contabilita/spese',
    selector: 'a[href="/contabilita/spese"]',
    sidebarAccordion: 'contabilita',
    description: 'Vai su "Spese" nella sezione Contabilità per registrare e visualizzare le uscite.',
  },
  {
    id: 'add-spesa',
    keywords: ['aggiungere spesa', 'registrare spesa', 'nuova spesa', 'inserire uscita', 'registrare costo'],
    route: '/contabilita/spese',
    selector: '[data-assistant="add-spesa-btn"]',
    sidebarAccordion: 'contabilita',
    description: 'Nella pagina Spese clicca "Aggiungi Spesa" per registrare una nuova uscita.',
  },
  {
    id: 'go-prima-nota',
    keywords: ['prima nota', 'primanota', 'registro contabile', 'entrate uscite'],
    route: '/contabilita/prima-nota',
    selector: 'a[href="/contabilita/prima-nota"]',
    sidebarAccordion: 'contabilita',
    description: 'Vai su "Prima Nota" nella sezione Contabilità per il registro cronologico delle entrate e uscite.',
  },
  {
    id: 'go-transazioni-controllo',
    keywords: ['transazioni da controllare', 'transazione', 'verifica pagamento', 'confermare pagamento', 'pagamenti in attesa', 'validare pagamento'],
    route: '/contabilita/transazioni-da-controllare',
    selector: 'a[href="/contabilita/transazioni-da-controllare"]',
    sidebarAccordion: 'contabilita',
    description: 'Vai su "Transazioni da Controllare" nella sezione Contabilità per verificare i pagamenti in sospeso.',
  },
  {
    id: 'go-pagamenti-contanti',
    keywords: ['pagamenti contanti', 'contanti', 'pagamento in contanti', 'registrare contanti'],
    route: '/contabilita/pagamenti-contanti',
    selector: 'a[href="/contabilita/pagamenti-contanti"]',
    sidebarAccordion: 'contabilita',
    description: 'Vai su "Pagamenti in Contanti" nella sezione Contabilità per gestire i pagamenti fisici.',
  },

  // ── TESSERAMENTO ──────────────────────────────────────────────────────────
  {
    id: 'go-tesseramento',
    keywords: ['tesserato', 'tesseramento', 'tessera', 'tesserare', 'tariffe', 'quota tesseramento'],
    route: '/tesserati/tesserati',
    selector: null,
    sidebarAccordion: 'tesserati',
    description: 'Apri la sezione "Tesseramento" nella sidebar per gestire i tesserati.',
  },
  {
    id: 'go-nuovi-iscritti',
    keywords: ['nuovi iscritti', 'nuovo iscritto', 'approvare iscrizione', 'gestire nuovi', 'assegnare gruppo'],
    route: '/tesserati/nuovi-iscritti',
    selector: 'a[href="/tesserati/nuovi-iscritti"]',
    sidebarAccordion: 'tesserati',
    description: 'Vai su "Nuovi Iscritti" nella sezione Tesseramento per approvare e assegnare gruppo ai nuovi iscritti.',
  },
  {
    id: 'go-famiglie',
    keywords: ['famiglie', 'lista famiglie', 'gestione famiglie', 'elenco famiglie'],
    route: '/tesserati/famiglie',
    selector: 'a[href="/tesserati/famiglie"]',
    sidebarAccordion: 'tesserati',
    description: 'Vai su "Famiglie" nella sezione Tesseramento per vedere l\'elenco delle famiglie.',
  },
  {
    id: 'go-tariffe',
    keywords: ['tariffe', 'tariffa', 'prezzo', 'quota', 'impostare prezzo', 'modificare tariffa'],
    route: '/tesserati/tariffe',
    selector: 'a[href="/tesserati/tariffe"]',
    sidebarAccordion: 'tesserati',
    description: 'Vai su "Tariffe" nella sezione Tesseramento per configurare le quote di iscrizione.',
  },

  // ── CAMPI ─────────────────────────────────────────────────────────────────
  {
    id: 'go-campi',
    keywords: ['campo', 'campi', 'camp', 'estate', 'vacanza', 'gita', 'campo estivo', 'week end'],
    route: '/campi',
    selector: null,
    sidebarAccordion: 'campi',
    description: 'Apri la sezione "Campi" nella sidebar per gestire i campi estivi e le gite.',
  },
  {
    id: 'avvia-raccolta-campo',
    keywords: ['avviare raccolta campo', 'raccolta campo', 'creare campo'],
    route: '/contabilita/avvia-raccolta',
    selector: null,
    sidebarAccordion: 'contabilita',
    description: 'Per creare una nuova raccolta fondi per un campo vai su Contabilità → Avvia Raccolta.',
  },

  // ── GRUPPI ────────────────────────────────────────────────────────────────
  {
    id: 'go-miei-gruppi',
    keywords: ['miei gruppi', 'gruppo', 'gruppi', 'ragazzi', 'il mio gruppo', 'registrare presenze', 'presenze'],
    route: '/miei-gruppi',
    selector: null,
    sidebarAccordion: 'miei-gruppi',
    description: 'Vai su "I Miei Gruppi" nella sidebar per vedere i gruppi che gestisci e registrare le presenze.',
  },
  {
    id: 'go-presenze',
    keywords: ['presenze', 'presenza', 'chi è venuto', 'segnare presenti', 'registro presenze', 'appello'],
    route: '/miei-gruppi',
    selector: null,
    sidebarAccordion: 'miei-gruppi',
    description: 'Le presenze si gestiscono nella sezione "I Miei Gruppi": seleziona il gruppo e accedi al registro presenze.',
  },

  // ── PROGETTI ──────────────────────────────────────────────────────────────
  {
    id: 'go-progetti',
    keywords: ['progetto', 'progetti', 'attività', 'iniziativa', 'laboratorio', 'percorso'],
    route: '/progetti',
    selector: null,
    sidebarAccordion: 'progetti',
    description: 'Apri la sezione "Progetti" nella sidebar per vedere i progetti e laboratori attivi.',
  },
  {
    id: 'storico-progetti',
    keywords: ['storico progetti', 'progetti archiviati', 'progetti passati', 'progetti conclusi', 'archivio'],
    route: '/progetti',
    selector: '[data-assistant="storico-progetti-btn"]',
    sidebarAccordion: 'progetti',
    description: 'Nella pagina Progetti trovi in fondo il pulsante "Storico Progetti" per vedere i progetti archiviati.',
  },

  // ── SOCIAL MEDIA ─────────────────────────────────────────────────────────
  {
    id: 'go-social-media',
    keywords: ['social', 'social media', 'post', 'pubblicare', 'instagram', 'facebook', 'comunicazione', 'whatsapp', 'messaggio genitori'],
    route: '/social-media',
    selector: 'a[href="/social-media"]',
    sidebarAccordion: null,
    description: 'Vai su "Social Media" nella sidebar per pianificare contenuti social e generare messaggi WhatsApp.',
  },

  // ── CONSIGLIO ─────────────────────────────────────────────────────────────
  {
    id: 'go-consiglio',
    keywords: ['consiglio', 'riunione', 'delibera', 'assemblea', 'verbale', 'ordine del giorno'],
    route: '/consiglio',
    selector: 'a[href="/consiglio"]',
    sidebarAccordion: null,
    description: 'Vai su "Consiglio" nella sidebar per gestire le riunioni e le delibere del consiglio.',
  },

  // ── PROFILO UTENTE ────────────────────────────────────────────────────────
  {
    id: 'open-profile',
    keywords: ['profilo', 'il mio profilo', 'modifica profilo', 'cambio nome', 'cambio email', 'dati personali', 'impostazioni account'],
    route: null,
    selector: '[data-assistant="user-menu-btn"]',
    sidebarAccordion: null,
    description: 'Clicca sull\'icona utente in alto a destra e seleziona "Profilo" per modificare i tuoi dati personali.',
  },
  {
    id: 'change-password',
    keywords: ['cambiare password', 'nuova password', 'reset password', 'password dimenticata', 'modifica password'],
    route: null,
    selector: '[data-assistant="user-menu-btn"]',
    sidebarAccordion: null,
    description: 'Per cambiare la password vai nel menu utente in alto a destra → "Profilo" → trovi le impostazioni di sicurezza.',
  },
  {
    id: 'go-impostazioni',
    keywords: ['impostazioni', 'settings', 'configurazione', 'preferenze', 'notifiche impostazioni'],
    route: '/impostazioni',
    selector: 'a[href="/impostazioni"]',
    sidebarAccordion: null,
    description: 'Vai su "Impostazioni" nella sidebar per configurare le preferenze dell\'applicazione.',
  },

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  {
    id: 'logout',
    keywords: ['logout', 'esci', 'disconnetti', 'uscire', 'log out', 'disconnettersi', 'uscire dall\'app'],
    route: null,
    selector: '[data-assistant="user-menu-btn"]',
    sidebarAccordion: null,
    description: 'Clicca sull\'icona utente in alto a destra e seleziona "Esci" per effettuare il logout.',
  },

  // ── NOTIFICHE ─────────────────────────────────────────────────────────────
  {
    id: 'open-notifications',
    keywords: ['notifiche', 'notifica', 'avvisi', 'messaggi', 'campana', 'ho ricevuto notifica', 'c\'è una notifica'],
    route: null,
    selector: '[data-assistant="notification-bell"]',
    sidebarAccordion: null,
    description: 'Clicca sull\'icona della campanella in alto a destra per vedere le tue notifiche.',
  },

  // ── FEEDBACK / SEGNALAZIONE ───────────────────────────────────────────────
  {
    id: 'open-feedback',
    keywords: ['feedback', 'segnalazione', 'problema', 'bug', 'errore', 'segnalare', 'supporto', 'help', 'aiuto tecnico'],
    route: null,
    selector: '[data-assistant="feedback-btn"]',
    sidebarAccordion: null,
    description: 'Clicca sul pulsante "Segnalazioni" nell\'header per inviare un feedback o segnalare un problema tecnico.',
  },

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  {
    id: 'go-admin',
    keywords: ['admin', 'amministrazione', 'pannello admin', 'area admin', 'gestione utenti', 'configurazione', 'pannello di controllo'],
    route: '/admin/gestione-utenti/users',
    selector: null,
    sidebarAccordion: 'admin-panel',
    description: 'Apri il pannello "Admin" nella sidebar (visibile solo agli amministratori) per accedere alla gestione.',
  },
  {
    id: 'go-gestione-gruppi',
    keywords: ['gestione gruppi', 'creare gruppo', 'nuovo gruppo', 'modifica gruppo', 'gestire gruppi'],
    route: '/admin/gestione-gruppi/tutti-i-gruppi',
    selector: null,
    sidebarAccordion: 'admin-panel',
    description: 'Vai in Admin → Gestione Gruppi per creare, modificare o eliminare i gruppi.',
  },
  {
    id: 'go-gestione-utenti',
    keywords: ['gestione utenti', 'lista utenti', 'utenti registrati', 'cambiare ruolo', 'assegnare ruolo'],
    route: '/admin/gestione-utenti/users',
    selector: null,
    sidebarAccordion: 'admin-panel',
    description: 'Vai in Admin → Gestione Utenti per vedere tutti gli utenti registrati e modificarne i ruoli.',
  },
];

export type { AssistantAction as UIAction };
