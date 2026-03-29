'use client';

import { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

/**
 * Shows an "Add to Home Screen" banner on iOS Safari.
 * Only appears when:
 *  - Device is iOS (iPhone/iPad)
 *  - Browser is Safari (not already installed as PWA)
 *  - User hasn't dismissed it before (localStorage key)
 */
export function IosInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode =
      ('standalone' in navigator && (navigator as any).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('ios-install-banner-dismissed');

    if (isIos && !isInStandaloneMode && !dismissed) {
      // Small delay so it doesn't pop up immediately on page load
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('ios-install-banner-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-safe animate-in slide-in-from-bottom-4 duration-300">
      <div className="relative max-w-md mx-auto rounded-2xl border bg-card shadow-2xl p-4">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="rounded-xl bg-primary/10 p-2 shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Installa su iPhone</p>
            <p className="text-xs text-muted-foreground mt-1">
              Per ricevere notifiche push su iPhone, aggiungi l'app alla schermata Home.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold shrink-0">1</span>
            <span>Tocca <Share className="inline h-3.5 w-3.5 mx-0.5" /> <strong>Condividi</strong> in basso nella barra del browser</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold shrink-0">2</span>
            <span>Scorri e tocca <PlusSquare className="inline h-3.5 w-3.5 mx-0.5" /> <strong>"Aggiungi alla schermata Home"</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold shrink-0">3</span>
            <span>Apri l'app dalla schermata Home e attiva le notifiche</span>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="mt-4 w-full rounded-lg bg-muted py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          Ho capito, installa dopo
        </button>
      </div>
    </div>
  );
}
