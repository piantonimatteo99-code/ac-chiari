import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AC Chiari",
  description: "Informativa sulla privacy dell'applicazione gestionale AC Chiari – Azione Cattolica di Chiari.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-gray-800 px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-blue-800">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ultimo aggiornamento: 1 maggio 2025
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
          <li>Dati di contabilità interni all'associazione (quote, pagamenti)</li>
          <li>Accesso al Google Calendar personale (solo se l'utente lo autorizza esplicitamente)</li>
          <li>
            <strong>Dati estratti da ricevute di pagamento</strong>: quando l'utente carica
            l'immagine di una ricevuta bancaria, il sistema analizza automaticamente il documento
            tramite intelligenza artificiale per estrarre: nome del pagante, importo, data,
            beneficiario e IBAN. Questi dati sono trattati esclusivamente per verificare
            la correttezza del pagamento.
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
            <strong>Verifica ricevute di pagamento tramite AI</strong>: l'immagine caricata viene
            temporaneamente elaborata da un sistema di intelligenza artificiale (Google Gemini tramite
            Firebase Extensions) al solo scopo di estrarre i dati del bonifico e verificarne
            la correttezza. L'immagine originale viene eliminata da Firebase Storage non appena
            archiviata su Google Drive. I dati estratti non vengono utilizzati per addestrare
            modelli AI.
          </li>
          <li>
            <strong>Sincronizzazione con Google Calendar</strong>: con il consenso esplicito dell'utente,
            l'app accede al Google Calendar per aggiungere automaticamente gli eventi dell'associazione
            (riunioni, attività, scadenze). I token di accesso sono salvati in modo sicuro e non vengono
            mai condivisi con terze parti. L'utente può revocare l'accesso in qualsiasi momento.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">3b. Analisi AI delle ricevute — dettagli tecnici</h2>
        <p className="mb-3">
          Quando un utente carica un'immagine di ricevuta bancaria, il sistema adotta le seguenti
          misure per proteggere i dati:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>
            <strong>Accesso limitato</strong>: l'immagine è accessibile solo all'utente autenticato
            che l'ha caricata, tramite percorso privato su Firebase Storage
            (<code>receipts/{`{uid}`}/...</code>).
          </li>
          <li>
            <strong>Elaborazione temporanea</strong>: l'immagine viene passata all'AI solo per
            il tempo necessario all'analisi; al termine viene eliminata da Firebase Storage.
          </li>
          <li>
            <strong>Dati estratti minimi</strong>: l'AI estrae solo i campi strettamente necessari
            alla verifica del pagamento (importo, nome, IBAN, causale, data). Nessun altro dato
            presente nella ricevuta viene conservato.
          </li>
          <li>
            <strong>No training AI</strong>: i dati trasmessi a Google Gemini tramite Firebase
            Extensions non vengono utilizzati da Google per addestrare modelli AI, in conformità
            con i{" "}
            <a
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              termini di privacy di Firebase
            </a>
            .
          </li>
          <li>
            <strong>Archiviazione finale</strong>: la ricevuta viene salvata su Google Drive
            dell'associazione, accessibile solo agli amministratori autorizzati.
          </li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">4. Google Calendar — Uso dello scope</h2>
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
        <h2 className="text-xl font-semibold mb-3 text-blue-700">5. Base giuridica del trattamento</h2>
        <p>
          Il trattamento dei dati avviene sulla base del consenso esplicito dell'utente (art. 6, par. 1,
          lett. a del GDPR) e per l'esecuzione di un contratto associativo (art. 6, par. 1, lett. b del GDPR).
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">6. Conservazione dei dati</h2>
        <p>
          I dati personali vengono conservati per il tempo strettamente necessario alle finalità per cui
          sono stati raccolti. I token di accesso a Google Calendar vengono eliminati non appena
          l'utente revoca l'integrazione.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">7. Condivisione con terze parti</h2>
        <p>
          I dati personali <strong>non vengono venduti, ceduti o comunicati a terze parti</strong>,
          ad eccezione dei fornitori di servizi tecnici strettamente necessari al funzionamento
          dell'applicazione (Firebase/Google Cloud per l'archiviazione dati, Vercel per l'hosting).
          Tali fornitori trattano i dati esclusivamente come responsabili del trattamento e in conformità
          con le rispettive privacy policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">8. Diritti dell'utente</h2>
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
        <h2 className="text-xl font-semibold mb-3 text-blue-700">9. Cookie</h2>
        <p>
          L'applicazione utilizza cookie tecnici essenziali per il funzionamento dell'autenticazione.
          Non vengono utilizzati cookie di profilazione o di tracciamento pubblicitario.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3 text-blue-700">10. Modifiche alla Privacy Policy</h2>
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
          <br />
          Applicazione:{" "}
          <a
            href="https://azionecattolicachiari.vercel.app"
            className="text-blue-600 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            azionecattolicachiari.vercel.app
          </a>
        </p>
      </footer>
    </main>
  );
}
