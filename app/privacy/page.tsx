import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AC Chiari",
  description: "Informativa sulla privacy dell'applicazione gestionale AC Chiari – Azione Cattolica di Chiari.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-blue-800">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ultimo aggiornamento: 17 luglio 2026
      </p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">1. Titolare del trattamento</h2>
        <p>
          Il titolare del trattamento dei dati è <strong>Azione Cattolica di Chiari</strong>,
          raggiungibile all'indirizzo email:{" "}
          <a href="mailto:azionecattolicachiari@gmail.com" className="text-blue-600 underline">
            azionecattolicachiari@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">2. Quali dati raccogliamo</h2>
        <p className="mb-3">L'applicazione raccoglie e tratta i seguenti dati personali:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Nome e cognome degli iscritti all'associazione</li>
          <li>Indirizzo email (usato per autenticazione e comunicazioni interne)</li>
          <li>Dati di contabilità interni all'associazione (quote, pagamenti, ricevute)</li>
          <li>Accesso al Google Calendar personale (solo se l'utente lo autorizza esplicitamente)</li>
          <li>
            <strong>Documenti di ricevuta di pagamento</strong>: quando l'utente carica
            l'immagine o il PDF di una ricevuta bancaria, il file viene archiviato temporaneamente
            su Google Drive dell'associazione al solo fine di permetterne la verifica manuale
            da parte degli educatori autorizzati.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">3. Come utilizziamo i dati</h2>
        <p className="mb-3">I dati raccolti vengono utilizzati esclusivamente per:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Gestire le iscrizioni e i dati dei soci dell'associazione</li>
          <li>Gestire la contabilità interna (entrate, uscite, quote annuali)</li>
          <li>Inviare notifiche e comunicazioni interne all'associazione</li>
          <li>
            <strong>Sincronizzazione con Google Calendar</strong>: con il consenso esplicito dell'utente,
            l'app accede al Google Calendar per aggiungere automaticamente gli eventi dell'associazione
            (riunioni, attività, scadenze). I token di accesso sono salvati in modo sicuro e non vengono
            mai condivisi con terze parti. L'utente può revocare l'accesso in qualsiasi momento.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">3b. Gestione delle ricevute di pagamento</h2>
        <p className="mb-3">
          Quando un utente carica un documento di ricevuta, il sistema adotta le seguenti misure per
          proteggere i dati:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>
            <strong>Accesso limitato agli educatori autorizzati</strong>: i documenti caricati
            sono visibili esclusivamente agli educatori dell'associazione espressamente autorizzati
            alla gestione contabile. Nessun altro utente può accedervi.
          </li>
          <li>
            <strong>Verifica manuale</strong>: le ricevute vengono esaminate manualmente dagli educatori
            autorizzati per verificare la correttezza del pagamento. Non viene utilizzato alcun sistema
            automatico di intelligenza artificiale per l'analisi dei documenti.
          </li>
          <li>
            <strong>Eliminazione dopo la verifica</strong>: al termine del processo di verifica,
            il documento viene eliminato definitivamente da Google Drive. I dati personali presenti
            nella ricevuta non vengono conservati oltre il tempo strettamente necessario alla verifica.
          </li>
          <li>
            <strong>Archiviazione temporanea sicura</strong>: durante il periodo di verifica, il file
            è accessibile tramite Google Drive dell'associazione, con accesso limitato ai soli
            educatori autorizzati.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">4. Accesso ai dati personali</h2>
        <p className="mb-3">
          I dati personali degli iscritti (nome, cognome, email, dati di pagamento) sono consultabili
          esclusivamente dagli educatori dell'associazione autorizzati a tale accesso, e solo in caso
          di effettiva necessità per le attività associative. Gli educatori sono tenuti al rispetto
          della riservatezza e al trattamento dei dati secondo le disposizioni del GDPR.
        </p>
        <p>
          Nessun dato personale viene condiviso con soggetti esterni all'associazione, fatta eccezione
          per i fornitori di servizi tecnici indicati nella sezione 7.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">5. Google Calendar — Uso dello scope</h2>
        <p>
          L'applicazione utilizza le API di Google Calendar con il consenso esplicito dell'utente.
          L'accesso viene richiesto per creare e sincronizzare eventi dell'associazione direttamente
          nel calendario personale Google dell'utente. L'app <strong>non legge</strong> eventi esistenti,
          non elimina eventi e non condivide i dati del calendario con terze parti.
          Il token di accesso viene conservato in modo sicuro tramite Firebase Firestore e può essere
          revocato dall'utente in qualsiasi momento tramite le impostazioni dell'app o da{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">6. Base giuridica del trattamento</h2>
        <p>
          Il trattamento dei dati avviene sulla base del consenso esplicito dell'utente (art. 6, par. 1,
          lett. a del GDPR) e per l'esecuzione di un contratto associativo (art. 6, par. 1, lett. b del GDPR).
          Il consenso alla presente informativa viene raccolto al momento della registrazione all'applicazione.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">7. Conservazione dei dati</h2>
        <p className="mb-2">
          I dati personali vengono conservati per il tempo strettamente necessario alle finalità per cui
          sono stati raccolti:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>I token di accesso a Google Calendar vengono eliminati non appena l'utente revoca l'integrazione.</li>
          <li>I documenti di ricevuta vengono eliminati da Google Drive al completamento della verifica del pagamento.</li>
          <li>I dati associativi vengono conservati per la durata del rapporto associativo.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">8. Condivisione con terze parti</h2>
        <p>
          I dati personali <strong>non vengono venduti, ceduti o comunicati a terze parti</strong>,
          ad eccezione dei fornitori di servizi tecnici strettamente necessari al funzionamento
          dell'applicazione: Firebase/Google Cloud per l'archiviazione dati e l'hosting.
          Tali fornitori trattano i dati esclusivamente come responsabili del trattamento e in conformità
          con le rispettive privacy policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">9. Diritti dell'utente</h2>
        <p className="mb-3">L'utente ha il diritto di:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Accedere ai propri dati personali</li>
          <li>Richiedere la rettifica o la cancellazione dei dati</li>
          <li>Revocare il consenso in qualsiasi momento</li>
          <li>Opporsi al trattamento</li>
          <li>Proporre reclamo all'autorità di controllo (Garante Privacy italiano)</li>
        </ul>
        <p className="mt-3">
          Per esercitare i propri diritti, contattare:{" "}
          <a href="mailto:azionecattolicachiari@gmail.com" className="text-blue-600 underline">
            azionecattolicachiari@gmail.com
          </a>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">10. Cookie</h2>
        <p>
          L'applicazione utilizza cookie tecnici essenziali per il funzionamento dell'autenticazione.
          Non vengono utilizzati cookie di profilazione o di tracciamento pubblicitario.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">11. Modifiche alla Privacy Policy</h2>
        <p>
          Ci riserviamo il diritto di modificare questa Privacy Policy in qualsiasi momento.
          Le modifiche saranno pubblicate su questa pagina con la data di aggiornamento.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">
          12. Misure di sicurezza tecnica per i dati sensibili
        </h2>
        <p className="mb-3">
          L'applicazione adotta le seguenti misure tecniche per proteggere i dati sensibili degli utenti,
          in particolare i token di accesso OAuth e i documenti caricati:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Trasmissione cifrata (HTTPS/TLS)</strong>: tutte le comunicazioni tra il dispositivo
            dell'utente, i server dell'applicazione e le API di Google avvengono esclusivamente tramite
            protocollo HTTPS con crittografia TLS, impedendo l'intercettazione dei dati in transito.
          </li>
          <li>
            <strong>Archiviazione sicura dei token OAuth</strong>: i token di accesso a Google Calendar
            rilasciati da Google vengono archiviati esclusivamente nel database Firebase Firestore
            dell'associazione, protetto da regole di sicurezza Firebase che garantiscono l'accesso
            esclusivamente agli utenti autorizzati. I token non vengono mai scritti in chiaro in log,
            cookie non sicuri o storage lato client.
          </li>
          <li>
            <strong>Regole di accesso Firebase</strong>: l'accesso al database Firestore è governato da
            regole di sicurezza granulari che limitano la lettura e la scrittura dei dati agli utenti
            autenticati e solo ai documenti di loro competenza. Gli educatori autorizzati hanno accesso
            ampliato esclusivamente alle funzionalità di gestione contabile.
          </li>
          <li>
            <strong>Revoca immediata del token</strong>: quando l'utente revoca l'integrazione con
            Google Calendar dall'applicazione, il token di accesso viene immediatamente eliminato da
            Firestore e invalidato tramite le API di Google, impedendo qualsiasi accesso futuro.
          </li>
          <li>
            <strong>Accesso minimo necessario (Least Privilege)</strong>: l'applicazione richiede
            esclusivamente gli scope OAuth strettamente necessari al funzionamento:
            <code className="bg-gray-100 px-1 rounded text-sm"> drive.file</code> (accesso ai soli file
            creati dall'app su Google Drive) e
            <code className="bg-gray-100 px-1 rounded text-sm"> calendar</code> (creazione di eventi
            sul calendario dell'utente). Nessuno scope aggiuntivo viene richiesto.
          </li>
          <li>
            <strong>Isolamento dei documenti su Google Drive</strong>: i file caricati su Google Drive
            tramite lo scope <code className="bg-gray-100 px-1 rounded text-sm">drive.file</code> sono
            accessibili esclusivamente dall'applicazione stessa e dagli educatori autorizzati tramite
            le credenziali del service account dell'associazione. L'accesso diretto da parte di terzi
            è tecnicamente impossibile senza credenziali valide.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">
          13. Conformità alla Google API Services User Data Policy
        </h2>
        <p className="mb-3">
          L'utilizzo e il trasferimento di informazioni ricevute tramite le API di Google verso qualsiasi
          altra app rispetta la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Google API Services User Data Policy
          </a>
          , inclusi i requisiti di utilizzo limitato.
        </p>
        <p className="mb-3">
          In conformità con tale policy, l'applicazione dichiara esplicitamente che:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            I dati ottenuti tramite le API di Google (inclusi i token OAuth, le informazioni del profilo
            Google e i dati di Google Calendar e Drive) vengono utilizzati <strong>esclusivamente</strong>{" "}
            per le finalità dichiarate in questa Privacy Policy: gestione interna dell'associazione,
            sincronizzazione degli eventi sul calendario personale dell'utente e archiviazione temporanea
            delle ricevute di pagamento.
          </li>
          <li>
            I dati Google dell'utente <strong>non vengono venduti</strong> a terze parti in nessuna circostanza.
          </li>
          <li>
            I dati Google dell'utente <strong>non vengono utilizzati</strong> per finalità pubblicitarie,
            di profilazione o per scopi che esulano dall'uso dichiarato dell'applicazione.
          </li>
          <li>
            I dati Google dell'utente <strong>non vengono trasferiti</strong> a terze parti, salvo quanto
            strettamente necessario per erogare il servizio (Firebase/Google Cloud come provider tecnico)
            e solo previa autorizzazione esplicita dell'utente.
          </li>
          <li>
            L'accesso ai dati Google viene richiesto solo nel momento in cui l'utente attiva
            esplicitamente l'integrazione, tramite il flusso OAuth standard di Google, che include
            la schermata di consenso con la descrizione dettagliata degli scope richiesti.
          </li>
        </ul>
      </section>

      <footer className="border-t pt-6 mt-8 text-sm text-gray-500">
        <p>
          <strong>AC Chiari — Azione Cattolica di Chiari</strong>
          <br />
          Email:{" "}
          <a href="mailto:azionecattolicachiari@gmail.com" className="text-blue-600 underline">
            azionecattolicachiari@gmail.com
          </a>
        </p>
      </footer>
    </main>
  );
}
