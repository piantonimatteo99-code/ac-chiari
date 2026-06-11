import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AC Chiari — Gestionale Azione Cattolica di Chiari",
  description:
    "Piattaforma gestionale ufficiale di Azione Cattolica di Chiari. Gestione iscrizioni, contabilità interna, gruppi e sincronizzazione calendario.",
};

const features = [
  {
    icon: "👥",
    title: "Gestione Soci",
    description:
      "Anagrafica completa degli iscritti, nuclei familiari, gruppi e ruoli. Importazione massiva e ricerca avanzata.",
  },
  {
    icon: "💰",
    title: "Contabilità Interna",
    description:
      "Tracciamento di entrate e uscite, quote associative, pagamenti in contanti e ricevute digitali.",
  },
  {
    icon: "📅",
    title: "Calendario & Eventi",
    description:
      "Gestione degli eventi dell'associazione con sincronizzazione opzionale al Google Calendar personale degli educatori.",
  },
  {
    icon: "🔔",
    title: "Notifiche & Promemoria",
    description:
      "Notifiche push per eventi, scadenze e comunicazioni interne. Supporto PWA per uso da smartphone.",
  },
  {
    icon: "📊",
    title: "Report & Statistiche",
    description:
      "Panoramica finanziaria, riepilogo soci attivi, storico pagamenti e export dei dati.",
  },
  {
    icon: "🔐",
    title: "Accesso Sicuro",
    description:
      "Autenticazione con Google, ruoli differenziati (admin, educatore, socio) e protezione dei dati GDPR.",
  },
];

export default function HomePage() {
  return (
    <div className="ac-landing">
      {/* ── NAV ── */}
      <nav className="ac-nav">
        <div className="ac-nav-inner">
          <div className="ac-brand">
            <Image
              src="/ac-logo.jpg"
              alt="Logo Azione Cattolica Chiari"
              width={44}
              height={44}
              className="ac-logo"
            />
            <span className="ac-brand-name">AC Chiari</span>
          </div>
          <div className="ac-nav-links">
            <Link href="/privacy" className="ac-nav-link">
              Privacy Policy
            </Link>
            <Link href="/login" className="ac-btn ac-btn-outline">
              Accedi
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="ac-hero">
        <div className="ac-hero-bg" aria-hidden="true">
          <div className="ac-hero-blob ac-hero-blob-1" />
          <div className="ac-hero-blob ac-hero-blob-2" />
          <div className="ac-hero-blob ac-hero-blob-3" />
        </div>
        <div className="ac-hero-content">
          <div className="ac-hero-badge">
            <span>🏛️</span>
            <span>Azione Cattolica di Chiari — Gestionale ufficiale</span>
          </div>
          <h1 className="ac-hero-title">
            Il gestionale interno
            <br />
            <span className="ac-hero-title-accent">di AC Chiari</span>
          </h1>
          <p className="ac-hero-subtitle">
            Piattaforma digitale per la gestione di soci, contabilità, gruppi
            ed eventi dell&apos;associazione Azione Cattolica di Chiari.
            Riservato ai soci e agli educatori autorizzati.
          </p>
          <div className="ac-hero-actions">
            <Link href="/login" id="hero-login-btn" className="ac-btn ac-btn-primary ac-btn-lg">
              Accedi al gestionale
              <span className="ac-btn-arrow">→</span>
            </Link>
            <Link href="/privacy" id="hero-privacy-btn" className="ac-btn ac-btn-ghost ac-btn-lg">
              Privacy Policy
            </Link>
          </div>
        </div>
        <div className="ac-hero-visual" aria-hidden="true">
          <div className="ac-card-preview">
            <div className="ac-card-preview-header">
              <div className="ac-card-dots">
                <span /><span /><span />
              </div>
              <span className="ac-card-preview-title">Dashboard AC Chiari</span>
            </div>
            <div className="ac-card-preview-body">
              <div className="ac-stat-row">
                <div className="ac-stat"><span className="ac-stat-n">147</span><span className="ac-stat-l">Soci attivi</span></div>
                <div className="ac-stat"><span className="ac-stat-n">12</span><span className="ac-stat-l">Gruppi</span></div>
                <div className="ac-stat"><span className="ac-stat-n">€ 4.820</span><span className="ac-stat-l">Cassa</span></div>
              </div>
              <div className="ac-fake-list">
                <div className="ac-fake-row"><div className="ac-fake-avatar" /><div className="ac-fake-lines"><div className="ac-fake-line ac-w-60" /><div className="ac-fake-line ac-w-40" /></div><div className="ac-fake-badge ac-badge-green">Pagato</div></div>
                <div className="ac-fake-row"><div className="ac-fake-avatar" /><div className="ac-fake-lines"><div className="ac-fake-line ac-w-70" /><div className="ac-fake-line ac-w-35" /></div><div className="ac-fake-badge ac-badge-yellow">In attesa</div></div>
                <div className="ac-fake-row"><div className="ac-fake-avatar" /><div className="ac-fake-lines"><div className="ac-fake-line ac-w-50" /><div className="ac-fake-line ac-w-45" /></div><div className="ac-fake-badge ac-badge-green">Pagato</div></div>
                <div className="ac-fake-row"><div className="ac-fake-avatar" /><div className="ac-fake-lines"><div className="ac-fake-line ac-w-65" /><div className="ac-fake-line ac-w-30" /></div><div className="ac-fake-badge ac-badge-blue">Nuovo</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section className="ac-about">
        <div className="ac-container">
          <div className="ac-about-grid">
            <div>
              <h2 className="ac-section-title">Chi siamo</h2>
              <p className="ac-about-text">
                <strong>Azione Cattolica di Chiari</strong> è un&apos;associazione laicale cattolica
                radicata nella comunità di Chiari (BS). Questo gestionale digitale è stato sviluppato
                per semplificare le attività amministrative interne: dalla gestione delle iscrizioni
                alla contabilità, dalla comunicazione interna all&apos;organizzazione degli eventi.
              </p>
              <p className="ac-about-text">
                L&apos;applicazione è ad uso esclusivo dei soci e degli educatori dell&apos;associazione.
                Non raccoglie dati di marketing e non condivide informazioni personali con terze parti,
                nel pieno rispetto del GDPR.
              </p>
              <div className="ac-about-contacts">
                <a href="mailto:azionecattolicachiari@gmail.com" className="ac-contact-link">
                  <span>✉️</span> azionecattolicachiari@gmail.com
                </a>
              </div>
            </div>
            <div className="ac-google-scope-box">
              <h3 className="ac-scope-title">
                <span>📅</span> Perché usiamo Google Calendar?
              </h3>
              <p className="ac-scope-text">
                Con il <strong>consenso esplicito</strong> dell&apos;utente, l&apos;app può aggiungere
                automaticamente gli eventi dell&apos;associazione (riunioni, attività, scadenze) al
                Google Calendar personale dell&apos;educatore.
              </p>
              <ul className="ac-scope-list">
                <li>✅ L&apos;app <strong>non legge</strong> eventi esistenti nel calendario</li>
                <li>✅ L&apos;app <strong>non elimina</strong> eventi personali</li>
                <li>✅ L&apos;accesso è <strong>revocabile in qualsiasi momento</strong></li>
                <li>✅ I token non vengono mai condivisi con terze parti</li>
              </ul>
              <p className="ac-scope-revoke">
                Per revocare l&apos;accesso:{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ac-link"
                >
                  myaccount.google.com/permissions
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="ac-features">
        <div className="ac-container">
          <div className="ac-section-header">
            <h2 className="ac-section-title ac-text-center">Funzionalità principali</h2>
            <p className="ac-section-sub ac-text-center">
              Tutto quello che serve per gestire l&apos;associazione in un&apos;unica piattaforma
            </p>
          </div>
          <div className="ac-features-grid">
            {features.map((f) => (
              <div key={f.title} className="ac-feature-card">
                <div className="ac-feature-icon">{f.icon}</div>
                <h3 className="ac-feature-title">{f.title}</h3>
                <p className="ac-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ac-cta">
        <div className="ac-container ac-cta-inner">
          <h2 className="ac-cta-title">Sei un socio o educatore di AC Chiari?</h2>
          <p className="ac-cta-sub">
            Accedi al gestionale con le credenziali fornite dall&apos;associazione.
          </p>
          <Link href="/login" id="cta-login-btn" className="ac-btn ac-btn-primary ac-btn-lg">
            Accedi ora →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ac-footer">
        <div className="ac-container ac-footer-inner">
          <div className="ac-footer-brand">
            <Image
              src="/ac-logo.jpg"
              alt="Logo AC Chiari"
              width={36}
              height={36}
              className="ac-logo"
            />
            <span>AC Chiari — Azione Cattolica di Chiari</span>
          </div>
          <div className="ac-footer-links">
            <Link href="/privacy" className="ac-footer-link">Privacy Policy</Link>
            <a href="mailto:azionecattolicachiari@gmail.com" className="ac-footer-link">Contatti</a>
          </div>
          <p className="ac-footer-copy">
            © {new Date().getFullYear()} Azione Cattolica di Chiari — Uso interno riservato
          </p>
        </div>
      </footer>

      <style>{`
        /* ── RESET & BASE ── */
        .ac-landing {
          font-family: var(--font-sans, 'Nunito', sans-serif);
          background: hsl(40 33% 98%);
          color: hsl(220 35% 18%);
          min-height: 100vh;
        }

        /* ── NAV ── */
        .ac-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: hsl(40 33% 98% / 0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid hsl(38 20% 88%);
        }
        .ac-nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0.85rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ac-brand { display: flex; align-items: center; gap: 0.65rem; }
        .ac-logo { border-radius: 8px; }
        .ac-brand-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: hsl(220 35% 18%);
          letter-spacing: -0.3px;
        }
        .ac-nav-links { display: flex; align-items: center; gap: 1rem; }
        .ac-nav-link {
          font-size: 0.9rem;
          color: hsl(220 15% 52%);
          text-decoration: none;
          transition: color .2s;
        }
        .ac-nav-link:hover { color: hsl(220 35% 18%); }

        /* ── BUTTONS ── */
        .ac-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1.25rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 700;
          text-decoration: none;
          transition: all .2s;
          cursor: pointer;
        }
        .ac-btn-lg { padding: 0.8rem 1.75rem; font-size: 1rem; }
        .ac-btn-primary {
          background: hsl(218 55% 58%);
          color: #fff;
          box-shadow: 0 4px 18px hsl(218 55% 58% / 0.35);
        }
        .ac-btn-primary:hover {
          transform: translateY(-2px);
          background: hsl(218 55% 50%);
          box-shadow: 0 8px 28px hsl(218 55% 58% / 0.45);
        }
        .ac-btn-outline {
          border: 1.5px solid hsl(38 20% 88%);
          color: hsl(220 35% 18%);
          background: hsl(38 40% 99%);
        }
        .ac-btn-outline:hover { border-color: hsl(218 55% 58%); color: hsl(218 55% 50%); }
        .ac-btn-ghost { color: hsl(220 15% 52%); background: transparent; }
        .ac-btn-ghost:hover { color: hsl(220 35% 18%); }
        .ac-btn-arrow { transition: transform .2s; }
        .ac-btn-primary:hover .ac-btn-arrow { transform: translateX(4px); }

        /* ── HERO ── */
        .ac-hero {
          position: relative;
          min-height: 88vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          padding: 5rem 1.5rem 4rem;
          max-width: 1100px;
          margin: 0 auto;
          gap: 3rem;
        }
        .ac-hero-bg { position: absolute; inset: 0; pointer-events: none; }
        .ac-hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.22;
        }
        .ac-hero-blob-1 {
          width: 500px; height: 500px;
          background: hsl(218 55% 80%);
          top: -100px; left: -150px;
          animation: blobPulse 8s ease-in-out infinite;
        }
        .ac-hero-blob-2 {
          width: 400px; height: 400px;
          background: hsl(43 80% 82%);
          bottom: -80px; right: 100px;
          animation: blobPulse 10s ease-in-out infinite reverse;
        }
        .ac-hero-blob-3 {
          width: 300px; height: 300px;
          background: hsl(218 60% 88%);
          top: 50%; right: -50px;
          animation: blobPulse 12s ease-in-out infinite;
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1) translate(0, 0); }
          33% { transform: scale(1.05) translate(10px, -15px); }
          66% { transform: scale(0.95) translate(-10px, 10px); }
        }
        .ac-hero-content { flex: 1; max-width: 560px; position: relative; z-index: 1; }
        .ac-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: hsl(218 60% 94%);
          border: 1px solid hsl(218 55% 80%);
          color: hsl(218 45% 38%);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.4rem 1rem;
          border-radius: 99px;
          margin-bottom: 1.5rem;
        }
        .ac-hero-title {
          font-size: clamp(2.2rem, 5vw, 3.5rem);
          font-weight: 900;
          line-height: 1.1;
          color: hsl(220 35% 18%);
          margin-bottom: 1.25rem;
          letter-spacing: -1px;
        }
        .ac-hero-title-accent {
          color: hsl(218 55% 52%);
        }
        .ac-hero-subtitle {
          font-size: 1.05rem;
          color: hsl(220 15% 48%);
          line-height: 1.75;
          margin-bottom: 2rem;
        }
        .ac-hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }

        /* ── HERO VISUAL (mock card) ── */
        .ac-hero-visual {
          flex: 1;
          max-width: 420px;
          position: relative;
          z-index: 1;
        }
        .ac-card-preview {
          background: hsl(38 40% 99%);
          border: 1px solid hsl(38 20% 88%);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 8px 32px hsl(218 30% 70% / 0.18), 0 2px 8px hsl(38 20% 70% / 0.12);
          animation: cardFloat 6s ease-in-out infinite;
        }
        @keyframes cardFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .ac-card-preview-header {
          background: hsl(218 55% 96%);
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border-bottom: 1px solid hsl(218 30% 86%);
        }
        .ac-card-dots { display: flex; gap: 5px; }
        .ac-card-dots span {
          width: 10px; height: 10px; border-radius: 50%;
          background: hsl(218 30% 78%);
        }
        .ac-card-preview-title { font-size: 0.8rem; color: hsl(220 15% 52%); font-weight: 600; }
        .ac-card-preview-body { padding: 1.25rem; }
        .ac-stat-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .ac-stat {
          flex: 1;
          background: hsl(218 60% 94%);
          border: 1px solid hsl(218 30% 86%);
          border-radius: 12px;
          padding: 0.75rem;
          text-align: center;
        }
        .ac-stat-n { display: block; font-size: 1.1rem; font-weight: 800; color: hsl(218 55% 50%); }
        .ac-stat-l { display: block; font-size: 0.65rem; color: hsl(220 15% 52%); margin-top: 2px; }
        .ac-fake-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .ac-fake-row {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 0.75rem;
          background: hsl(38 20% 96%);
          border-radius: 10px;
          border: 1px solid hsl(38 20% 90%);
        }
        .ac-fake-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: hsl(218 60% 88%);
          flex-shrink: 0;
        }
        .ac-fake-lines { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .ac-fake-line {
          height: 7px;
          background: hsl(38 20% 88%);
          border-radius: 99px;
        }
        .ac-w-30 { width: 30%; } .ac-w-35 { width: 35%; } .ac-w-40 { width: 40%; }
        .ac-w-45 { width: 45%; } .ac-w-50 { width: 50%; } .ac-w-60 { width: 60%; }
        .ac-w-65 { width: 65%; } .ac-w-70 { width: 70%; }
        .ac-fake-badge {
          font-size: 0.6rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 99px;
          white-space: nowrap;
        }
        .ac-badge-green { background: hsl(142 60% 92%); color: hsl(142 55% 32%); }
        .ac-badge-yellow { background: hsl(43 80% 92%); color: hsl(38 55% 32%); }
        .ac-badge-blue { background: hsl(218 60% 92%); color: hsl(218 55% 40%); }

        /* ── CONTAINER ── */
        .ac-container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

        /* ── ABOUT ── */
        .ac-about {
          padding: 5rem 0;
          background: hsl(218 55% 96%);
          border-top: 1px solid hsl(218 30% 86%);
        }
        .ac-about-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          align-items: start;
        }
        .ac-section-title {
          font-size: 2rem;
          font-weight: 800;
          color: hsl(220 35% 18%);
          margin-bottom: 1rem;
          letter-spacing: -0.5px;
        }
        .ac-about-text {
          color: hsl(220 15% 45%);
          line-height: 1.8;
          margin-bottom: 1rem;
          font-size: 0.97rem;
        }
        .ac-about-contacts { margin-top: 1.5rem; }
        .ac-contact-link {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: hsl(218 55% 50%);
          text-decoration: none;
          font-weight: 600;
          font-size: 0.9rem;
        }
        .ac-contact-link:hover { text-decoration: underline; }
        .ac-google-scope-box {
          background: hsl(38 40% 99%);
          border: 1px solid hsl(38 20% 88%);
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: 0 2px 6px hsl(38 20% 70% / 0.18);
        }
        .ac-scope-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: hsl(218 45% 38%);
          margin-bottom: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .ac-scope-text {
          color: hsl(220 15% 45%);
          font-size: 0.9rem;
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .ac-scope-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .ac-scope-list li { font-size: 0.88rem; color: hsl(220 20% 32%); }
        .ac-scope-revoke { font-size: 0.82rem; color: hsl(220 15% 52%); }
        .ac-link { color: hsl(218 55% 50%); text-decoration: none; }
        .ac-link:hover { text-decoration: underline; }

        /* ── FEATURES ── */
        .ac-features {
          padding: 5rem 0;
          border-top: 1px solid hsl(38 20% 88%);
        }
        .ac-section-header { margin-bottom: 3rem; }
        .ac-section-sub { color: hsl(220 15% 52%); font-size: 1rem; margin-top: 0.5rem; }
        .ac-text-center { text-align: center; }
        .ac-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }
        .ac-feature-card {
          background: hsl(38 40% 99%);
          border: 1px solid hsl(38 20% 88%);
          border-radius: 16px;
          padding: 1.5rem;
          transition: all .25s;
          box-shadow: 0 2px 6px hsl(38 20% 70% / 0.12);
        }
        .ac-feature-card:hover {
          border-color: hsl(218 55% 72%);
          background: hsl(218 60% 97%);
          transform: translateY(-4px);
          box-shadow: 0 12px 30px hsl(218 55% 58% / 0.14);
        }
        .ac-feature-icon { font-size: 2rem; margin-bottom: 0.75rem; }
        .ac-feature-title {
          font-size: 1rem;
          font-weight: 700;
          color: hsl(220 35% 18%);
          margin-bottom: 0.5rem;
        }
        .ac-feature-desc { font-size: 0.875rem; color: hsl(220 15% 48%); line-height: 1.6; }

        /* ── CTA ── */
        .ac-cta {
          padding: 5rem 0;
          background: hsl(218 55% 96%);
          border-top: 1px solid hsl(218 30% 86%);
          border-bottom: 1px solid hsl(218 30% 86%);
        }
        .ac-cta-inner { text-align: center; }
        .ac-cta-title {
          font-size: clamp(1.5rem, 3vw, 2.25rem);
          font-weight: 800;
          color: hsl(220 35% 18%);
          margin-bottom: 0.75rem;
        }
        .ac-cta-sub { color: hsl(220 15% 48%); margin-bottom: 2rem; }

        /* ── FOOTER ── */
        .ac-footer {
          padding: 2.5rem 0;
          background: hsl(38 20% 94%);
          border-top: 1px solid hsl(38 20% 88%);
        }
        .ac-footer-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
        }
        .ac-footer-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.9rem;
          font-weight: 700;
          color: hsl(220 35% 28%);
        }
        .ac-footer-links { display: flex; gap: 1.5rem; }
        .ac-footer-link {
          font-size: 0.85rem;
          color: hsl(220 15% 52%);
          text-decoration: none;
          transition: color .2s;
        }
        .ac-footer-link:hover { color: hsl(218 55% 50%); }
        .ac-footer-copy { font-size: 0.78rem; color: hsl(220 15% 60%); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .ac-hero { flex-direction: column; padding-top: 3rem; }
          .ac-hero-visual { max-width: 100%; width: 100%; }
          .ac-about-grid { grid-template-columns: 1fr; }
          .ac-features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .ac-features-grid { grid-template-columns: 1fr; }
          .ac-hero-title { font-size: 2rem; }
          .ac-nav-links .ac-nav-link { display: none; }
        }
      `}</style>
    </div>
  );
}
