'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

// ── Foto del carosello ──────────────────────────────────────────
// Aggiungi o sostituisci con le tue foto reali (in /public/)
const slides = [
  { src: "/home-community.jpg", alt: "Momenti di comunità" },
  { src: "/home-youth.jpg",     alt: "Giovani e ragazzi" },
  { src: "/home-church.jpg",    alt: "La nostra parrocchia" },
];

export default function HomePage() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  // Avanzamento automatico ogni 4s
  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent(i => (i + 1) % slides.length);
        setFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (idx: number) => {
    if (idx === current) return;
    setFading(true);
    setTimeout(() => {
      setCurrent(idx);
      setFading(false);
    }, 300);
  };

  return (
    <div className="ac-page">

      {/* ── NAV ── */}
      <nav className="ac-nav">
        <Link href="/privacy" className="ac-nav-link">Privacy Policy</Link>
        <Link href="/login" className="ac-nav-cta">Accedi</Link>
      </nav>

      {/* ── HERO: Logo + Nome ── */}
      <header className="ac-hero">
        <Image
          src="/ac-logo.jpg"
          alt="Logo Azione Cattolica Chiari"
          width={96}
          height={96}
          className="ac-logo"
          priority
        />
        <h1 className="ac-title">
          <span className="ac-title-main">Azione Cattolica</span>
          <span className="ac-title-sub">Chiari</span>
        </h1>
        <Link href="/login" className="ac-cta">Accedi al gestionale</Link>
      </header>

      {/* ── CAROSELLO FOTO ── */}
      <section className="ac-carousel">
        <div className={`ac-slide ${fading ? "ac-fade-out" : "ac-fade-in"}`}>
          <Image
            src={slides[current].src}
            alt={slides[current].alt}
            fill
            sizes="100vw"
            className="ac-slide-img"
            priority
          />
          <div className="ac-slide-overlay" />
          <span className="ac-slide-caption">{slides[current].alt}</span>
        </div>

        {/* Punti navigazione */}
        <div className="ac-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`ac-dot ${i === current ? "ac-dot-active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Vai alla foto ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="ac-footer">
        <p>© {new Date().getFullYear()} Azione Cattolica di Chiari · Fondata nel 1867</p>
        <Link href="/privacy" className="ac-footer-link">Privacy Policy</Link>
      </footer>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ac-page {
          font-family: var(--font-sans, system-ui, sans-serif);
          background: hsl(40 33% 98%);
          color: hsl(220 35% 18%);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
        }

        /* ── NAV ── */
        .ac-nav {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 1.25rem;
          padding: 1rem 1.75rem;
          background: hsl(40 33% 98%);
          border-bottom: 1px solid hsl(38 20% 90%);
        }
        .ac-nav-link {
          font-size: 0.875rem;
          color: hsl(220 15% 50%);
          text-decoration: none;
          transition: color .2s;
        }
        .ac-nav-link:hover { color: hsl(220 35% 18%); }
        .ac-nav-cta {
          display: inline-flex;
          align-items: center;
          padding: 0.45rem 1.15rem;
          background: hsl(218 55% 58%);
          color: #fff;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none;
          transition: background .2s, box-shadow .2s;
          box-shadow: 0 2px 10px hsl(218 55% 58% / 0.28);
        }
        .ac-nav-cta:hover {
          background: hsl(218 55% 50%);
          box-shadow: 0 4px 16px hsl(218 55% 58% / 0.38);
        }

        /* ── HERO ── */
        .ac-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1.5rem 3.5rem;
          gap: 1.25rem;
          text-align: center;
        }
        .ac-logo {
          border-radius: 18px;
          box-shadow: 0 4px 20px hsl(218 30% 60% / 0.18);
        }
        .ac-title {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          line-height: 1.1;
        }
        .ac-title-main {
          font-size: clamp(1.8rem, 5vw, 2.8rem);
          font-weight: 900;
          letter-spacing: -0.5px;
          color: hsl(220 35% 14%);
        }
        .ac-title-sub {
          font-size: clamp(1.3rem, 3.5vw, 2rem);
          font-weight: 500;
          color: hsl(218 55% 52%);
          letter-spacing: 0.04em;
        }
        .ac-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          margin-top: 0.25rem;
          padding: 0.7rem 1.75rem;
          background: hsl(218 55% 58%);
          color: #fff;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          text-decoration: none;
          transition: background .2s, transform .2s, box-shadow .2s;
          box-shadow: 0 4px 18px hsl(218 55% 58% / 0.32);
        }
        .ac-cta:hover {
          background: hsl(218 55% 50%);
          transform: translateY(-2px);
          box-shadow: 0 8px 26px hsl(218 55% 58% / 0.40);
        }

        /* ── CAROSELLO ── */
        .ac-carousel {
          position: relative;
          width: 100%;
          flex: 1;
          min-height: 420px;
          max-height: 560px;
          overflow: hidden;
          background: hsl(218 30% 88%);
        }
        .ac-slide {
          position: absolute;
          inset: 0;
        }
        .ac-slide-img {
          object-fit: cover;
        }
        .ac-slide-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            hsl(218 30% 20% / 0.08) 0%,
            hsl(218 30% 12% / 0.38) 100%
          );
        }
        .ac-slide-caption {
          position: absolute;
          bottom: 3.5rem;
          left: 50%;
          transform: translateX(-50%);
          background: hsl(38 40% 99% / 0.88);
          color: hsl(220 35% 20%);
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 0.35rem 1rem;
          border-radius: 99px;
          backdrop-filter: blur(6px);
          border: 1px solid hsl(38 20% 88%);
          white-space: nowrap;
        }
        .ac-fade-in  { animation: fadeIn  .4s ease forwards; }
        .ac-fade-out { animation: fadeOut .4s ease forwards; }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

        /* Punti */
        .ac-dots {
          position: absolute;
          bottom: 1.1rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.5rem;
          z-index: 10;
        }
        .ac-dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          border: none;
          cursor: pointer;
          background: hsl(38 40% 99% / 0.55);
          transition: background .3s, width .3s;
          padding: 0;
        }
        .ac-dot-active {
          background: #fff;
          width: 22px;
        }

        /* ── FOOTER ── */
        .ac-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          padding: 1.1rem 1.5rem;
          background: hsl(218 55% 97%);
          border-top: 1px solid hsl(218 30% 88%);
        }
        .ac-footer p {
          font-size: 0.78rem;
          color: hsl(220 15% 58%);
        }
        .ac-footer-link {
          font-size: 0.78rem;
          color: hsl(220 15% 55%);
          text-decoration: none;
          transition: color .2s;
        }
        .ac-footer-link:hover { color: hsl(218 55% 50%); }

        /* ── RESPONSIVE ── */
        @media (max-width: 500px) {
          .ac-carousel { min-height: 280px; max-height: 380px; }
          .ac-hero { padding: 3rem 1.25rem 2.5rem; }
        }
      `}</style>
    </div>
  );
}
