'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Costanti fisiche ────────────────────────────────────────────────────────
const THRESHOLD   = 72;   // px per attivare il refresh
const MAX_PULL    = 130;  // px massimi di spostamento del contenuto
const HOLD_PX     = 56;   // px a cui si "ferma" durante il refreshing
const RESIST      = 0.42; // coefficiente di resistenza (0 = molla dura, 1 = libero)

// ─── Tipi ───────────────────────────────────────────────────────────────────
type Status = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'snapping';

// ─── Helper: resistenza rubber-band ─────────────────────────────────────────
// Simula il comportamento elastico di iOS: più si tira, più diventa difficile
function rubberBand(delta: number, max: number, coeff: number): number {
  if (delta <= 0) return 0;
  // Formula rubber-band: x * coeff * max / (x * coeff + max)
  return (delta * coeff * max) / (delta * coeff + max);
}

interface PullToRefreshProps {
  children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router    = useRouter();
  const [translateY, setTranslateY] = useState(0);
  const [status,     setStatus]     = useState<Status>('idle');

  // Ref condivisi tra gli handler (evitano re-render inutili)
  const startY        = useRef<number | null>(null);
  const startScrollY  = useRef(0);
  const currentDelta  = useRef(0);
  const statusRef     = useRef<Status>('idle');
  const isActive      = useRef(false);  // true quando stiamo gestendo un gesto

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  // ─── Touch Start ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Non interferire se c'è già un refresh in corso
      if (statusRef.current === 'refreshing' || statusRef.current === 'snapping') return;
      // Registra posizione di partenza, indipendentemente da scrollY
      startY.current      = e.touches[0].clientY;
      startScrollY.current = window.scrollY;
      isActive.current    = false; // diventa true solo se si tira verso il basso da top
    };

    // ─── Touch Move ─────────────────────────────────────────────────────────
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      if (statusRef.current === 'refreshing' || statusRef.current === 'snapping') return;

      const touch  = e.touches[0];
      const dy     = touch.clientY - startY.current;
      const scrollNow = window.scrollY;

      // Inizia a gestire solo se: tiriamo verso il basso E siamo (o eravamo) in cima
      if (!isActive.current) {
        if (dy > 6 && startScrollY.current <= 0 && scrollNow <= 0) {
          isActive.current = true;
        } else {
          return;
        }
      }

      // Se durante il drag l'utente ha scrollato su → annulla
      if (scrollNow > 4) {
        currentDelta.current = 0;
        setTranslateY(0);
        setStatusBoth('idle');
        isActive.current = false;
        startY.current   = null;
        return;
      }

      // Impedisce lo scroll nativo del browser mentre gestiamo noi
      e.preventDefault();

      const raw      = Math.max(0, dy);
      const dampened = rubberBand(raw, MAX_PULL, RESIST);

      currentDelta.current = dampened;
      setTranslateY(dampened);
      setStatusBoth(dampened >= THRESHOLD ? 'ready' : 'pulling');
    };

    // ─── Touch End ──────────────────────────────────────────────────────────
    const onTouchEnd = () => {
      if (!isActive.current) {
        startY.current = null;
        return;
      }
      isActive.current = false;
      startY.current   = null;

      if (statusRef.current === 'ready') {
        // Snap alla posizione di "hold" con animazione molla
        setTranslateY(HOLD_PX);
        setStatusBoth('refreshing');
        router.refresh();

        // Dopo 1.4s: snap back con effetto molla
        setTimeout(() => {
          setStatusBoth('snapping');
          setTranslateY(0);
          setTimeout(() => setStatusBoth('idle'), 500);
        }, 1400);
      } else {
        // Snap back
        setStatusBoth('snapping');
        setTranslateY(0);
        setTimeout(() => setStatusBoth('idle'), 400);
      }
    };

    const el = document.documentElement;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('touchcancel',onTouchEnd);
    };
  }, [router]);

  // ─── Fisica della transizione ────────────────────────────────────────────
  const isSnapping    = status === 'snapping';
  const isRefreshing  = status === 'refreshing';
  const isPulling     = status === 'pulling' || status === 'ready';

  // Durante il drag: nessuna transizione (segue il dito in real-time)
  // Durante lo snap: spring cubic-bezier
  const transition = isPulling
    ? 'none'
    : 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)'; // spring overshoot

  // ─── Indicatore visivo ───────────────────────────────────────────────────
  const progress    = Math.min(1, translateY / THRESHOLD);
  const arrowAngle  = progress * 180; // 0° → 180° mentre si tira
  const indicatorOpacity = Math.min(1, translateY / 20);

  return (
    <>
      {/* Indicatore fisso dietro il contenuto, centrato in cima */}
      <div
        aria-hidden="true"
        style={{
          position:       'fixed',
          top:            0,
          left:           0,
          right:          0,
          height:         `${HOLD_PX + 8}px`,
          display:        'flex',
          alignItems:     'flex-end',
          justifyContent: 'center',
          paddingBottom:  '10px',
          pointerEvents:  'none',
          zIndex:         40,
          opacity:        status === 'idle' ? 0 : indicatorOpacity,
          transition:     status === 'idle' ? 'opacity 0.2s ease' : 'none',
        }}
      >
        <div
          style={{
            width:           '40px',
            height:          '40px',
            borderRadius:    '50%',
            backgroundColor: 'hsl(var(--card))',
            border:          '1.5px solid hsl(var(--border))',
            boxShadow:       '0 4px 16px hsl(218 30% 50% / 0.18)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          {isRefreshing || isSnapping ? (
            /* Spinner rotante */
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="hsl(var(--primary))"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: isRefreshing ? 'ptr-spin 0.7s linear infinite' : 'none' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            /* Freccia direzionale */
            <svg
              width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="hsl(var(--primary))"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transform:  `rotate(${arrowAngle}deg)`,
                transition: isPulling ? 'transform 0.05s linear' : 'transform 0.3s ease',
              }}
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Contenuto che si sposta verso il basso */}
      <div
        style={{
          transform:  `translateY(${translateY}px)`,
          transition,
          willChange: 'transform',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
