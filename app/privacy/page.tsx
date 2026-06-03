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
        Ultimo aggiornamento: 24 maggio 2026
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
