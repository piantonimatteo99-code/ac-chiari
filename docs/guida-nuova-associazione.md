# 📘 Guida: Aggiungere una Nuova Associazione (Tenant) a GemmaFlow

Questa guida documenta tutti i passaggi necessari per aggiungere un nuovo tenant (associazione) alla piattaforma GemmaFlow. Segui attentamente i passaggi nell'ordine indicato per evitare errori di configurazione o problemi di accesso agli utenti.

---

## Indice dei Passaggi
1. [Configurazione del Codice (`tenants.ts`)](#1-configurazione-del-codice-tenantsts)
2. [Creazione del Database su Firebase Console](#2-creazione-del-database-su-firebase-console)
3. [Configurazione di `firebase.json` e Deploy delle Regole](#3-configurazione-di-firebasejson-e-deploy-delle-regole)
4. [Aggiunta del Dominio Autorizzato su Firebase Authentication](#4-aggiunta-del-dominio-autorizzato-su-firebase-authentication)
5. [Inizializzazione dell'Utente Amministratore](#5-inizializzazione-dellutente-amministratore)
6. [Configurazione SMTP per l'invio delle Email](#6-configurazione-smtp-per-linvio-delle-email)

---

### 1. Configurazione del Codice (`tenants.ts`)

Il primo passo consiste nel registrare il nuovo tenant all'interno del codice sorgente.

1. Apri il file [lib/tenants.ts](file:///c:/Users/piant/Programmi/ac-chiari/lib/tenants.ts).
2. Aggiungi una nuova chiave nell'oggetto `TENANTS`.
   * **ID**: Deve corrispondere esattamente all'ID del database Firestore che creerai al punto 2.
   * **Subdomain**: Il sottodominio su cui risponderà l'associazione (es. `acbrescia`).
   * **Email**: L'indirizzo email dell'associazione.
   * **Colors**: I colori dell'interfaccia (in formato hex e classi Tailwind).

**Esempio di inserimento:**
```typescript
export const TENANTS: Record<string, TenantConfig> = {
  acchiari: {
    id: 'acchiari',
    name: 'AC Chiari',
    subdomain: 'acchiari',
    email: 'azionecattolicachiari@gmail.com',
    colors: {
      primary: '#1d4ed8', // blue-700
      primaryHover: '#1e40af', // blue-800
      bgHeader: 'bg-blue-700',
    },
  },
  acbrescia: {
    id: 'acbrescia',
    name: 'AC Brescia',
    subdomain: 'acbrescia',
    email: 'segreteria@acbrescia.gemmaflow.it',
    colors: {
      primary: '#047857', // emerald-700
      primaryHover: '#065f46', // emerald-800
      bgHeader: 'bg-emerald-700',
    },
  },
  // NUOVO TENANT:
  nuovotenant: {
    id: 'nuovotenant',
    name: 'AC Nuovo Tenant',
    subdomain: 'nuovotenant',
    email: 'segreteria@nuovotenant.gemmaflow.it',
    colors: {
      primary: '#4f46e5', // indigo-600
      primaryHover: '#4338ca', // indigo-700
      bgHeader: 'bg-indigo-600',
    },
  },
};
```

---

### 2. Creazione del Database su Firebase Console

GemmaFlow utilizza un'architettura **multi-database** in cui ogni associazione ha un database Firestore dedicato all'interno dello stesso progetto.

1. Accedi alla [Firebase Console](https://console.firebase.google.com/).
2. Seleziona il progetto GemmaFlow.
3. Nel menu laterale, vai su **Build > Firestore Database**.
4. Fai clic sulla tendina del database corrente (es: `(default)`) e seleziona **Add database** (Aggiungi database).
5. Configura il database:
   * **Database ID**: Inserisci esattamente l'id del tenant definito nel codice al punto 1 (es. `nuovotenant`). **Importante**: Non può essere modificato successivamente.
   * **Location**: Scegli la stessa regione del database principale (solitamente `eur3` o `europe-west3`).
   * **Rules**: Seleziona la modalità di produzione (in quanto le regole verranno sovrascritte al passaggio successivo).
6. Completa la creazione.

---

### 3. Configurazione di `firebase.json` e Deploy delle Regole

Ogni nuovo database deve avere le stesse regole di sicurezza (`firestore.rules`) e indici del database di default.

1. Apri il file [firebase.json](file:///c:/Users/piant/Programmi/ac-chiari/firebase.json).
2. Aggiungi il nuovo database all'interno dell'array `firestore`:
```json
{
  "database": "nuovotenant",
  "rules": "firestore.rules",
  "indexes": "firestore.indexes.json"
}
```
3. Salva il file.
4. Esegui il deploy delle regole dal terminale:
```bash
firebase deploy --only firestore
```
Questo comando compilerà e applicherà `firestore.rules` e gli indici a tutti i database configurati in `firebase.json`.

---

### 4. Aggiunta del Dominio Autorizzato su Firebase Authentication

Firebase Authentication blocca i redirect dei link di verifica email e autenticazione se il dominio di provenienza non è esplicitamente autorizzato.

1. Nella Firebase Console, vai su **Build > Authentication**.
2. Vai alla scheda **Settings** (Impostazioni) > **Authorized domains** (Domini autorizzati).
3. Fai clic su **Add domain** (Aggiungi dominio).
4. Inserisci il dominio completo del nuovo tenant, es:
   * `nuovotenant.gemmaflow.it`
   * Se usi domini personalizzati di secondo livello (es. `acnuovotenant.it`), aggiungi anche quelli.
5. Fai clic su **Add**.

---

### 5. Inizializzazione dell'Utente Amministratore

Essendo il database appena creato completamente vuoto, nessun utente ha i permessi per accedere come amministratore o visualizzare la dashboard. È necessario promuovere manualmente un utente admin scrivendo il suo documento nella collezione `users` del nuovo database.

Puoi utilizzare lo script [scratch/add-admin-all-tenants.js](file:///c:/Users/piant/Programmi/ac-chiari/scratch/add-admin-all-tenants.js) modificando l'array `TENANTS` con il nuovo tenant:

1. Apri [scratch/add-admin-all-tenants.js](file:///c:/Users/piant/Programmi/ac-chiari/scratch/add-admin-all-tenants.js).
2. Aggiungi il nuovo tenant all'array `TENANTS`:
```javascript
const TENANTS = [
  { tenantId: 'acchiari',  databaseId: null },
  { tenantId: 'acbrescia', databaseId: 'acbrescia' },
  { tenantId: 'nuovotenant', databaseId: 'nuovotenant' }, // NUOVO
];
```
3. Esegui lo script dal terminale per assegnare il ruolo di admin al tuo utente:
```bash
node scratch/add-admin-all-tenants.js
```

---

### 6. Configurazione SMTP per l'invio delle Email

Per consentire l'invio delle email di registrazione e notifica con il mittente corretto della nuova associazione:

1. Accedi alla dashboard amministratore del nuovo tenant (es: `https://nuovotenant.gemmaflow.it/admin/configurazione/configurazione-smtp`).
2. Compila i campi del form SMTP:
   * **Server SMTP (Host)**: es: `smtp.gmail.com`
   * **Porta**: es: `587`
   * **SSL/TLS**: Attivo o Disattivo (per Gmail porta 587, lasciare disattivo).
   * **Indirizzo Email (User)**: L'account Gmail da cui inviare (es. `associazione.sistem@gmail.com`).
   * **Password**: La password dell'app generata su Google Account (non la password principale).
   * **Nome Visualizzato Mittente**: Es: `AC Associazione` (esce come mittente dell'email).
   * **Indirizzo Reply-To**: L'indirizzo a cui risponderanno gli utenti (es. `segreteria@nuovotenant.it`).
3. Effettua un test di invio tramite il pulsante "Invia email di test".
4. Salva la configurazione.

---

> [!WARNING]
> Ricordati di aggiungere il record DNS `CNAME` o `A` sul tuo provider DNS (Aruba, Cloudflare, ecc.) per far puntare il sottodominio `nuovotenant.gemmaflow.it` all'infrastruttura di hosting (Vercel / Firebase App Hosting).
