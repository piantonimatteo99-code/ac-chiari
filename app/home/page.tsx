'use client';

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/src/hooks/useTenant";
import { Calendar, HardDrive, ShieldCheck, ChevronDown } from "lucide-react";

// ── Foto del carosello ───────────────────────────────────────────
// Aggiungi o sostituisci con le tue foto reali (in /public/)
const slides = [
  { src: "/home-community.jpg", alt: "Momenti di comunità" },
  { src: "/home-youth.jpg",     alt: "Giovani e ragazzi" },
  { src: "/home-church.jpg",    alt: "La nostra parrocchia" },
];

export default function HomePage() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const { tenantConfig } = useTenant();

  // Estrai la "città" dall'id tenant (es. "acchiari" → "Chiari", "acbrescia" → "Brescia")
  const cityName = tenantConfig.name.replace(/^AC\s*/i, '').trim();

  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent(i => (i + 1) % slides.length);
        setFading(false);
      }, 500);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  // Navigazione con transizione di uscita
  const navigate = useCallback((href: string) => {
    setLeaving(true);
    setTimeout(() => router.push(href), 420);
  }, [router]);

  const goTo = (idx: number) => {
    if (idx === current) return;
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 400);
  };

  return (
    <div className={`ac-root ${leaving ? 'ac-leaving' : ''}`}>

      {/* ── FOTO DI SFONDO (Fissa) ── */}
      <div className={`ac-bg ${fading ? "ac-fade-out" : "ac-fade-in"}`}>
        <Image
          src={slides[current].src}
          alt={slides[current].alt}
          fill
          sizes="100vw"
          className="ac-bg-img"
          priority
        />
      </div>

      {/* ── OVERLAY scuro per leggibilità (Fisso) ── */}
      <div className="ac-overlay" />

      {/* ── HERO FOLD (Prima schermata) ── */}
      <div className="ac-hero-fold">
        {/* ── NAV ── */}
        <nav className="ac-nav">
          <button onClick={() => navigate('/privacy')} className="ac-nav-link">Privacy Policy</button>
          <button onClick={() => navigate('/login')} className="ac-nav-cta">Accedi</button>
        </nav>

        {/* ── CENTRO: logo + nome ── */}
        <main className="ac-center">
          <Image
            src="/icon-512.png"
            alt={`Logo Azione Cattolica ${cityName}`}
            width={110}
            height={110}
            className="ac-logo"
            priority
          />
          <div className="ac-title-wrap">
            <span className="ac-title-main">Azione Cattolica</span>
            <span className="ac-title-sub">{cityName}</span>
          </div>
          <button onClick={() => navigate('/login')} className="ac-cta">
            Accedi al gestionale
          </button>
        </main>

        {/* ── INDICATORE SCROLL ── */}
        <div 
          className="ac-scroll-indicator" 
          onClick={() => document.getElementById('info-section')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span>Scopri il portale</span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </div>

        {/* ── PUNTINI CAROSELLO ── */}
        <div className="ac-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`ac-dot ${i === current ? "ac-dot-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Foto ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── INFO FOLD (Seconda schermata scorrevole) ── */}
      <section id="info-section" className="ac-info-fold">
        <div className="ac-info-card">
          <div className="ac-info-header">
            <ShieldCheck className="ac-info-icon-main" />
            <h2>Il Portale GemmaFlow</h2>
          </div>
          
          <p className="ac-info-intro">
            Il portale di GemmaFlow è il sistema gestionale interno utilizzato dall'associazione 
            <strong> Azione Cattolica di Chiari</strong> per organizzare le attività educative, 
            gestire le iscrizioni degli associati e coordinare gli eventi della comunità.
          </p>

          <div className="ac-info-divider" />

          <h3 className="ac-features-title">Funzionalità principali & Integrazione Google</h3>

          <div className="ac-features-grid">
            <div className="ac-feature-card">
              <div className="ac-feature-header">
                <HardDrive className="ac-feature-icon" />
                <h4>Gestione Iscrizioni & Ricevute (Google Drive)</h4>
              </div>
              <p>
                Permette agli educatori di archiviare e verificare in modo sicuro le ricevute 
                di pagamento delle quote associative caricate dalle famiglie, memorizzandole 
                temporaneamente su Google Drive dell'associazione.
              </p>
            </div>

            <div className="ac-feature-card">
              <div className="ac-feature-header">
                <Calendar className="ac-feature-icon" />
                <h4>Calendario Attività (Google Calendar)</h4>
              </div>
              <p>
                Consente agli iscritti e alle famiglie di sincronizzare gli appuntamenti, 
                le riunioni e i campi estivi dell'associazione direttamente sul proprio 
                Google Calendar personale per non perdere nessuna attività.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ac-footer">
        <span>© {new Date().getFullYear()} Azione Cattolica di {cityName} · dal 1867</span>
        <button onClick={() => navigate('/privacy')} className="ac-footer-link">Privacy Policy</button>
      </footer>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── LAYOUT SCORREVOLE ── */
        .ac-root {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: var(--font-sans, system-ui, sans-serif);
          -webkit-font-smoothing: antialiased;
          overflow-y: auto;
          scroll-behavior: smooth;
        }

        /* ── FOTO SFONDO FISSA ── */
        .ac-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
        }
        .ac-bg-img {
          object-fit: cover;
        }
        .ac-fade-in  { animation: fadeIn  .5s ease forwards; }
        .ac-fade-out { animation: fadeOut .5s ease forwards; }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        /* ── TRANSIZIONE DI USCITA ── */
        .ac-leaving {
          animation: pageLeave 0.42s cubic-bezier(0.4, 0, 1, 1) forwards;
        }
        @keyframes pageLeave {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.03); }
        }

        /* ── OVERLAY FISSO ── */
        .ac-overlay {
          position: fixed;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            160deg,
            hsl(220 60% 10% / 0.65) 0%,
            hsl(220 60% 8%  / 0.85) 100%
          );
        }

        /* ── HERO FOLD ── */
        .ac-hero-fold {
          position: relative;
          z-index: 10;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* ── NAV ── */
        .ac-nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 1.25rem;
          padding: 1.1rem 1.75rem;
        }
        .ac-nav-link {
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(0 0% 100% / 0.75);
          background: none;
          border: none;
          cursor: pointer;
          transition: color .2s;
          font-family: inherit;
        }
        .ac-nav-link:hover { color: #fff; }
        .ac-nav-cta {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 1.2rem;
          background: hsl(38 40% 99% / 0.15);
          color: #fff;
          border: 1.5px solid hsl(38 40% 99% / 0.35);
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          backdrop-filter: blur(8px);
          transition: background .2s, border-color .2s;
        }
        .ac-nav-cta:hover {
          background: hsl(38 40% 99% / 0.25);
          border-color: hsl(38 40% 99% / 0.6);
        }

        /* ── CENTRO ── */
        .ac-center {
          position: relative;
          z-index: 10;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.1rem;
          text-align: center;
          padding: 0 1.5rem;
        }
        .ac-logo {
          filter: drop-shadow(0 4px 24px hsl(220 60% 8% / 0.5));
        }
        .ac-title-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
        }
        .ac-title-main {
          font-size: clamp(1.9rem, 5vw, 3rem);
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #fff;
          text-shadow: 0 2px 16px hsl(220 60% 8% / 0.5);
          line-height: 1.1;
        }
        .ac-title-sub {
          font-size: clamp(1.2rem, 3vw, 1.7rem);
          font-weight: 400;
          color: hsl(218 80% 82%);
          letter-spacing: 0.08em;
          text-shadow: 0 1px 8px hsl(220 60% 8% / 0.5);
        }
        .ac-cta {
          display: inline-flex;
          align-items: center;
          margin-top: 0.5rem;
          padding: 0.72rem 1.8rem;
          background: hsl(218 55% 58%);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 20px hsl(218 55% 40% / 0.45);
          transition: background .2s, transform .2s, box-shadow .2s;
        }
        .ac-cta:hover {
          background: hsl(218 55% 50%);
          transform: translateY(-2px);
          box-shadow: 0 8px 28px hsl(218 55% 40% / 0.55);
        }

        /* ── SCROLL INDICATOR ── */
        .ac-scroll-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          color: hsl(0 0% 100% / 0.6);
          cursor: pointer;
          transition: color .2s;
          margin-bottom: 1.5rem;
          z-index: 20;
          font-size: 0.8rem;
        }
        .ac-scroll-indicator:hover {
          color: #fff;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .ac-scroll-indicator svg {
          animation: bounce 1.6s infinite ease-in-out;
        }

        /* ── PUNTINI ── */
        .ac-dots {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: center;
          gap: 0.5rem;
          padding-bottom: 1rem;
        }
        .ac-dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          border: none;
          cursor: pointer;
          background: hsl(0 0% 100% / 0.4);
          transition: background .3s, width .3s;
          padding: 0;
        }
        .ac-dot-active {
          background: #fff;
          width: 24px;
        }

        /* ── INFO FOLD ── */
        .ac-info-fold {
          position: relative;
          z-index: 10;
          padding: 4rem 1.5rem;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .ac-info-card {
          max-width: 800px;
          width: 100%;
          background: hsl(220 40% 12% / 0.45);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid hsl(220 40% 90% / 0.15);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 20px 40px hsl(220 60% 5% / 0.3);
          color: #fff;
        }
        .ac-info-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .ac-info-icon-main {
          color: hsl(218 80% 82%);
          width: 28px;
          height: 28px;
        }
        .ac-info-header h2 {
          font-size: 1.75rem;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .ac-info-intro {
          font-size: 1.05rem;
          line-height: 1.6;
          color: hsl(0 0% 100% / 0.85);
        }
        .ac-info-divider {
          height: 1px;
          background: linear-gradient(90deg, hsl(220 40% 90% / 0.2) 0%, transparent 100%);
          margin: 2rem 0;
        }
        .ac-features-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: hsl(218 80% 82%);
          margin-bottom: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ac-features-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 640px) {
          .ac-features-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .ac-feature-card {
          background: hsl(220 40% 90% / 0.05);
          border: 1px solid hsl(220 40% 90% / 0.08);
          border-radius: 16px;
          padding: 1.5rem;
          transition: transform 0.2s, border-color 0.2s;
        }
        .ac-feature-card:hover {
          transform: translateY(-2px);
          border-color: hsl(220 40% 90% / 0.15);
        }
        .ac-feature-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .ac-feature-icon {
          color: hsl(38 85% 65%);
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .ac-feature-header h4 {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.3;
          color: #fff;
        }
        .ac-feature-card p {
          font-size: 0.875rem;
          line-height: 1.5;
          color: hsl(0 0% 100% / 0.75);
        }

        /* ── FOOTER ── */
        .ac-footer {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 0.9rem 1.5rem;
          background: hsl(220 60% 8% / 0.45);
          backdrop-filter: blur(8px);
        }
        .ac-footer span {
          font-size: 0.78rem;
          color: hsl(0 0% 100% / 0.5);
        }
        .ac-footer-link {
          font-size: 0.78rem;
          color: hsl(0 0% 100% / 0.5);
          text-decoration: none;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          transition: color .2s;
        }
        .ac-footer-link:hover { color: #fff; }
      `}</style>
    </div>
  );
}
