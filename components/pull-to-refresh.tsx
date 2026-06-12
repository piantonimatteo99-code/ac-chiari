'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const THRESHOLD = 80;      // px da trascinare per attivare il refresh
const MAX_PULL = 120;      // px massimi di pull visibili
const SPINNER_SIZE = 40;   // dimensione spinner in px

interface PullToRefreshProps {
  children: React.ReactNode;
}

export function PullToRefresh({ children }: PullToRefreshProps) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [status, setStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing'>('idle');
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isRefreshing = useRef(false);

  // Controlla se la pagina è scrollata in cima
  const isAtTop = useCallback(() => {
    return window.scrollY <= 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isAtTop()) return;
    startY.current = e.touches[0].clientY;
  }, [isAtTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startY.current === null || isRefreshing.current) return;
    if (!isAtTop()) {
      startY.current = null;
      return;
    }

    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;

    if (delta <= 0) {
      setPullY(0);
      setStatus('idle');
      return;
    }

    // Applica resistenza elastica (logaritmica)
    const dampened = Math.min(MAX_PULL, delta * (1 - delta / (MAX_PULL * 3)));
    setPullY(Math.max(0, dampened));
    setStatus(dampened >= THRESHOLD ? 'ready' : 'pulling');

    // Impedisce lo scroll nativo solo quando si sta tirando verso il basso
    if (delta > 5) {
      e.preventDefault();
    }
  }, [isAtTop]);

  const handleTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    startY.current = null;

    if (status === 'ready' && !isRefreshing.current) {
      isRefreshing.current = true;
      setStatus('refreshing');
      setPullY(SPINNER_SIZE + 16); // tieni il spinner visibile durante il refresh

      // Esegui il refresh della pagina corrente
      router.refresh();

      // Dopo 1.5s ripristina lo stato
      setTimeout(() => {
        setStatus('idle');
        setPullY(0);
        isRefreshing.current = false;
      }, 1500);
    } else {
      setPullY(0);
      setStatus('idle');
    }
  }, [status, router]);

  useEffect(() => {
    const el = document.documentElement;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Rotazione dell'icona freccia in base alla percentuale di pull
  const pullPercent = Math.min(1, pullY / THRESHOLD);
  const arrowRotation = pullPercent * 180;

  return (
    <div ref={containerRef} className="relative">
      {/* Indicatore pull-to-refresh */}
      <div
        className="ptr-indicator"
        style={{
          height: `${pullY}px`,
          overflow: 'hidden',
          transition: status === 'idle' ? 'height 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '8px',
        }}
      >
        <div
          style={{
            width: `${SPINNER_SIZE}px`,
            height: `${SPINNER_SIZE}px`,
            borderRadius: '50%',
            backgroundColor: 'hsl(218 55% 96%)',
            border: '1px solid hsl(218 30% 86%)',
            boxShadow: '0 2px 8px hsl(218 30% 70% / 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pullY > 4 ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {status === 'refreshing' ? (
            /* Spinner rotante */
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(218 55% 58%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'ptr-spin 0.75s linear infinite' }}
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            /* Freccia che ruota */
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(218 55% 58%)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: `rotate(${arrowRotation}deg)`,
                transition: 'transform 0.1s ease',
              }}
            >
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          )}
        </div>
      </div>

      {children}

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
