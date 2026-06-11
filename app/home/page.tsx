import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AC Chiari — Azione Cattolica di Chiari",
  description:
    "Siamo un'associazione di laici cristiani radicata nella comunità di Chiari (BS) dal 1867. Settore adulti, giovani (ACG) e ragazzi (ACR).",
};

// ── Foto galleria ──────────────────────────────────────────────
// Sostituisci src con i percorsi delle tue foto reali.
const photos = [
  {
    src: "/home-community.jpg",
    alt: "Momento di condivisione in associazione",
    caption: "Incontri e formazione",
  },
  {
    src: "/home-youth.jpg",
    alt: "Attività con i giovani",
    caption: "Giovani e ragazzi",
  },
  {
    src: "/home-church.jpg",
    alt: "La nostra parrocchia",
    caption: "La parrocchia, casa di tutti",
  },
];

const sectors = [
  {
    label: "Adulti",
    color: "sector-blue",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
    description:
      "Il settore adulti è lo spazio in cui le persone crescono nella fede, nella responsabilità civile e nell'impegno ecclesiale.",
  },
  {
    label: "Giovani — ACG",
    color: "sector-gold",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    description:
      "L'Azione Cattolica Giovani accompagna i ragazzi dai 14 anni nella scoperta della propria vocazione e nell'impegno nella comunità.",
  },
  {
    label: "Ragazzi — ACR",
    color: "sector-green",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    description:
      "L'Azione Cattolica dei Ragazzi è il luogo in cui i più piccoli imparano, giocando e pregando, la bellezza di essere cristiani.",
  },
];

export default function HomePage() {
  return (
    <div className="ac-home">

      {/* ── NAV ── */}
      <nav className="ac-nav">
        <div className="ac-nav-inner">
          <div className="ac-brand">
            <Image
              src="/ac-logo.jpg"
              alt="Logo Azione Cattolica Chiari"
              width={40}
              height={40}
              className="ac-logo-img"
            />
            <span className="ac-brand-name">AC Chiari</span>
          </div>
          <div className="ac-nav-links">
            <Link href="/privacy" className="ac-nav-link">Privacy Policy</Link>
            <Link href="/login" className="ac-nav-cta">Accedi</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="ac-hero">
        <div className="ac-hero-bg">
          <div className="ac-blob ac-blob-1" />
          <div className="ac-blob ac-blob-2" />
        </div>
        <div className="ac-hero-inner">
          <div className="ac-hero-eyebrow">
            <span className="ac-eyebrow-dot" />
            Azione Cattolica di Chiari · dal 1867
          </div>
          <h1 className="ac-hero-title">
            Laici cristiani<br />
            <span className="ac-title-accent">nella comunità di Chiari</span>
          </h1>
          <p className="ac-hero-lead">
            Siamo un&apos;associazione di laici cristiani. Abbiamo scelto di metterci
            insieme per capire meglio il valore del vivere da cristiani nel mondo;
            siamo convinti che anche in questa storia complessa Dio è presente
            con il suo amore.
          </p>
          <div className="ac-hero-actions">
            <Link href="/login" className="ac-btn-primary">
              Accedi al gestionale
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 16, height: 16, marginLeft: 6 }}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link href="/privacy" className="ac-btn-ghost">Privacy Policy</Link>
          </div>
        </div>
      </section>

      {/* ── CHI SIAMO ── */}
      <section className="ac-section ac-about">
        <div className="ac-container">
          <div className="ac-section-label">Chi siamo</div>
          <div className="ac-about-grid">
            <div className="ac-about-main">
              <h2 className="ac-section-title">Una storia lunga,<br />un&apos;esperienza sempre giovane</h2>
              <p>
                La formazione è stata da sempre il cuore del nostro servizio: formazione come
                spazio in cui ogni persona può guardare in faccia i valori grandi della libertà
                e della verità; della giustizia e della solidarietà.
              </p>
              <p>
                Nelle associazioni e nei gruppi di Azione Cattolica si impara alla scuola della
                Parola di Dio e del magistero della Chiesa a prendere familiarità con il mistero
                di Dio, a vivere da discepoli del Signore, ad amare la Chiesa e a servire la
                domanda di vita di ogni persona.
              </p>
            </div>
            <div className="ac-about-side">
              <div className="ac-quote-card">
                <div className="ac-quote-bar" />
                <p className="ac-quote-text">
                  La parrocchia è il luogo nel quale normalmente le persone di AC trovano
                  il punto di riferimento della loro vita e del loro servizio; il luogo dove
                  prendere slancio per una testimonianza evangelica in ogni ambiente di vita.
                </p>
              </div>
              <div className="ac-quote-card ac-quote-card-sm">
                <div className="ac-quote-bar" />
                <p className="ac-quote-text">
                  Il Concilio Vaticano II è il nostro programma, il punto di riferimento della
                  nostra esperienza di Chiesa, modello per un amore alla vita di oggi carico
                  di simpatia e di forza critica.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── GALLERIA FOTO ── */}
      <section className="ac-section ac-gallery-section">
        <div className="ac-container">
          <div className="ac-section-label">La nostra vita</div>
          <h2 className="ac-section-title ac-centered">Momenti di comunità</h2>
          <div className="ac-gallery">
            {photos.map((photo, i) => (
              <div key={i} className={`ac-photo-slot ac-photo-slot-${i}`}>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="ac-photo-img"
                />
                <div className="ac-photo-overlay">
                  <span className="ac-photo-caption">{photo.caption}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SETTORI ── */}
      <section className="ac-section ac-sectors-section">
        <div className="ac-container">
          <div className="ac-section-label">I nostri settori</div>
          <h2 className="ac-section-title ac-centered">Tre settori, un&apos;unica famiglia</h2>
          <p className="ac-section-sub ac-centered">
            L&apos;Azione Cattolica si articola in tre settori, tutti presenti
            nell&apos;associazione parrocchiale di Chiari.
          </p>
          <div className="ac-sectors-grid">
            {sectors.map((s) => (
              <div key={s.label} className={`ac-sector-card ${s.color}`}>
                <div className="ac-sector-icon">{s.icon}</div>
                <h3 className="ac-sector-label">{s.label}</h3>
                <p className="ac-sector-desc">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ac-footer">
        <div className="ac-container ac-footer-inner">
          <div className="ac-footer-brand">
            <Image src="/ac-logo.jpg" alt="Logo AC Chiari" width={32} height={32} className="ac-logo-img" />
            <span>Azione Cattolica di Chiari</span>
          </div>
          <div className="ac-footer-links">
            <Link href="/privacy" className="ac-footer-link">Privacy Policy</Link>
            <a href="mailto:azionecattolicachiari@gmail.com" className="ac-footer-link">Contatti</a>
          </div>
          <p className="ac-footer-copy">
            © {new Date().getFullYear()} Azione Cattolica di Chiari · Fondata nel 1867
          </p>
        </div>
      </footer>

      <style>{`
        /* ── BASE ── */
        .ac-home {
          font-family: var(--font-sans, system-ui, sans-serif);
          background: hsl(40 33% 98%);
          color: hsl(220 35% 18%);
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .ac-home p { color: hsl(220 15% 42%); line-height: 1.8; font-size: 0.97rem; margin-bottom: 1rem; }
        .ac-home p:last-child { margin-bottom: 0; }

        /* ── NAV ── */
        .ac-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: hsl(40 33% 98% / 0.92);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid hsl(38 20% 88%);
        }
        .ac-nav-inner {
          max-width: 1080px;
          margin: 0 auto;
          padding: 0.8rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ac-brand { display: flex; align-items: center; gap: 0.6rem; }
        .ac-logo-img { border-radius: 8px; }
        .ac-brand-name { font-size: 1.05rem; font-weight: 800; color: hsl(220 35% 18%); letter-spacing: -0.2px; }
        .ac-nav-links { display: flex; align-items: center; gap: 1.25rem; }
        .ac-nav-link { font-size: 0.875rem; color: hsl(220 15% 50%); text-decoration: none; transition: color .2s; }
        .ac-nav-link:hover { color: hsl(220 35% 18%); }
        .ac-nav-cta {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 1.1rem;
          background: hsl(218 55% 58%);
          color: #fff;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none;
          transition: background .2s, box-shadow .2s;
          box-shadow: 0 2px 10px hsl(218 55% 58% / 0.3);
        }
        .ac-nav-cta:hover { background: hsl(218 55% 50%); box-shadow: 0 4px 16px hsl(218 55% 58% / 0.4); }

        /* ── HERO ── */
        .ac-hero {
          position: relative;
          overflow: hidden;
          padding: 6rem 1.5rem 5rem;
          max-width: 1080px;
          margin: 0 auto;
        }
        .ac-hero-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .ac-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.18;
          animation: blobDrift 10s ease-in-out infinite;
        }
        .ac-blob-1 {
          width: 560px; height: 560px;
          background: hsl(218 55% 76%);
          top: -160px; left: -120px;
        }
        .ac-blob-2 {
          width: 420px; height: 420px;
          background: hsl(43 80% 78%);
          bottom: -100px; right: -80px;
          animation-direction: reverse;
          animation-duration: 13s;
        }
        @keyframes blobDrift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(16px, -20px) scale(1.04); }
        }
        .ac-hero-inner { position: relative; z-index: 1; max-width: 680px; }
        .ac-hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: hsl(218 45% 40%);
          background: hsl(218 60% 94%);
          border: 1px solid hsl(218 40% 84%);
          padding: 0.35rem 0.9rem;
          border-radius: 99px;
          margin-bottom: 1.75rem;
          letter-spacing: 0.02em;
        }
        .ac-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: hsl(218 55% 58%);
          display: inline-block;
        }
        .ac-hero-title {
          font-size: clamp(2.4rem, 5.5vw, 3.8rem);
          font-weight: 900;
          line-height: 1.08;
          letter-spacing: -1.5px;
          color: hsl(220 35% 14%);
          margin-bottom: 1.5rem;
        }
        .ac-title-accent { color: hsl(218 55% 52%); }
        .ac-hero-lead {
          font-size: 1.1rem;
          color: hsl(220 15% 42%);
          line-height: 1.75;
          margin-bottom: 2.25rem;
          max-width: 580px;
        }
        .ac-hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
        .ac-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 0.75rem 1.6rem;
          background: hsl(218 55% 58%);
          color: #fff;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          transition: background .2s, transform .2s, box-shadow .2s;
          box-shadow: 0 4px 16px hsl(218 55% 58% / 0.35);
        }
        .ac-btn-primary:hover { background: hsl(218 55% 50%); transform: translateY(-2px); box-shadow: 0 8px 24px hsl(218 55% 58% / 0.42); }
        .ac-btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 0.75rem 1.4rem;
          color: hsl(220 15% 48%);
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          transition: color .2s;
          border-radius: 10px;
        }
        .ac-btn-ghost:hover { color: hsl(220 35% 18%); }

        /* ── LAYOUT ── */
        .ac-container { max-width: 1080px; margin: 0 auto; padding: 0 1.5rem; }
        .ac-section { padding: 5rem 0; }
        .ac-section-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: hsl(218 55% 54%);
          margin-bottom: 0.75rem;
        }
        .ac-section-title {
          font-size: clamp(1.7rem, 3.5vw, 2.4rem);
          font-weight: 800;
          color: hsl(220 35% 14%);
          letter-spacing: -0.5px;
          line-height: 1.15;
          margin-bottom: 1rem;
        }
        .ac-centered { text-align: center; }
        .ac-section-sub { color: hsl(220 15% 48%); font-size: 1rem; line-height: 1.7; margin-bottom: 3rem; }

        /* ── ABOUT ── */
        .ac-about {
          background: hsl(218 55% 97%);
          border-top: 1px solid hsl(218 30% 88%);
          border-bottom: 1px solid hsl(218 30% 88%);
        }
        .ac-about-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3.5rem;
          align-items: start;
          margin-top: 1.5rem;
        }
        .ac-about-main {}
        .ac-about-side { display: flex; flex-direction: column; gap: 1.25rem; }
        .ac-quote-card {
          background: hsl(38 40% 99%);
          border: 1px solid hsl(38 20% 88%);
          border-radius: 14px;
          padding: 1.4rem 1.5rem;
          display: flex;
          gap: 1rem;
          box-shadow: 0 2px 8px hsl(38 20% 70% / 0.12);
        }
        .ac-quote-bar {
          width: 3px;
          border-radius: 99px;
          background: hsl(218 55% 58%);
          flex-shrink: 0;
        }
        .ac-quote-card-sm .ac-quote-bar { background: hsl(43 70% 58%); }
        .ac-quote-text { font-size: 0.9rem; color: hsl(220 15% 42%); line-height: 1.75; font-style: italic; margin: 0; }

        /* ── GALLERY ── */
        .ac-gallery-section {
          border-bottom: 1px solid hsl(38 20% 88%);
        }
        .ac-gallery {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          grid-template-rows: 320px;
          gap: 0.75rem;
          margin-top: 2rem;
          border-radius: 18px;
          overflow: hidden;
        }
        .ac-photo-slot {
          position: relative;
          overflow: hidden;
          background: hsl(218 30% 90%);
        }
        .ac-photo-slot-0 { grid-row: span 1; }
        .ac-photo-slot-1 {}
        .ac-photo-slot-2 {}
        .ac-photo-img {
          object-fit: cover;
          transition: transform 0.5s ease;
        }
        .ac-photo-slot:hover .ac-photo-img { transform: scale(1.04); }
        .ac-photo-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, hsl(220 35% 14% / 0.55) 0%, transparent 55%);
          display: flex;
          align-items: flex-end;
          padding: 1rem 1.1rem;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .ac-photo-slot:hover .ac-photo-overlay { opacity: 1; }
        .ac-photo-caption {
          font-size: 0.82rem;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.02em;
        }

        /* ── SETTORI ── */
        .ac-sectors-section { background: hsl(40 33% 98%); }
        .ac-sectors-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          margin-top: 0.5rem;
        }
        .ac-sector-card {
          border-radius: 16px;
          padding: 2rem 1.75rem;
          border: 1px solid transparent;
          transition: transform .25s, box-shadow .25s;
        }
        .ac-sector-card:hover { transform: translateY(-4px); }
        .sector-blue {
          background: hsl(218 60% 96%);
          border-color: hsl(218 40% 86%);
          box-shadow: 0 2px 8px hsl(218 55% 58% / 0.10);
        }
        .sector-blue:hover { box-shadow: 0 10px 28px hsl(218 55% 58% / 0.15); }
        .sector-gold {
          background: hsl(43 80% 96%);
          border-color: hsl(43 60% 84%);
          box-shadow: 0 2px 8px hsl(43 70% 58% / 0.12);
        }
        .sector-gold:hover { box-shadow: 0 10px 28px hsl(43 70% 58% / 0.18); }
        .sector-green {
          background: hsl(142 50% 96%);
          border-color: hsl(142 35% 84%);
          box-shadow: 0 2px 8px hsl(142 55% 42% / 0.10);
        }
        .sector-green:hover { box-shadow: 0 10px 28px hsl(142 55% 42% / 0.15); }
        .ac-sector-icon {
          margin-bottom: 1rem;
        }
        .sector-blue .ac-sector-icon { color: hsl(218 55% 50%); }
        .sector-gold .ac-sector-icon { color: hsl(38 65% 42%); }
        .sector-green .ac-sector-icon { color: hsl(142 55% 36%); }
        .ac-sector-label {
          font-size: 1.05rem;
          font-weight: 800;
          color: hsl(220 35% 16%);
          margin-bottom: 0.6rem;
          letter-spacing: -0.2px;
        }
        .ac-sector-desc { font-size: 0.875rem; color: hsl(220 15% 44%); line-height: 1.7; margin: 0; }

        /* ── FOOTER ── */
        .ac-footer {
          background: hsl(218 55% 97%);
          border-top: 1px solid hsl(218 30% 88%);
          padding: 2.5rem 0;
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
          color: hsl(220 35% 26%);
        }
        .ac-footer-links { display: flex; gap: 1.5rem; }
        .ac-footer-link {
          font-size: 0.85rem;
          color: hsl(220 15% 52%);
          text-decoration: none;
          transition: color .2s;
        }
        .ac-footer-link:hover { color: hsl(218 55% 50%); }
        .ac-footer-copy { font-size: 0.78rem; color: hsl(220 15% 62%); margin: 0; }

        /* ── RESPONSIVE ── */
        @media (max-width: 860px) {
          .ac-about-grid { grid-template-columns: 1fr; }
          .ac-sectors-grid { grid-template-columns: 1fr; }
          .ac-gallery {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 220px 220px;
          }
          .ac-photo-slot-0 { grid-column: span 2; }
        }
        @media (max-width: 560px) {
          .ac-hero { padding: 4rem 1.25rem 3.5rem; }
          .ac-gallery {
            grid-template-columns: 1fr;
            grid-template-rows: 220px 180px 180px;
          }
          .ac-photo-slot-0 { grid-column: span 1; }
          .ac-nav-link { display: none; }
        }
      `}</style>
    </div>
  );
}
