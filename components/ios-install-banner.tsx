'use client';

import { useEffect, useState } from 'react';
import { Share, PlusSquare, Smartphone, X } from 'lucide-react';

/**
 * Full-screen modal guiding iOS Safari users to install the PWA.
 * Only appears when:
 *  - Device is iOS (iPhone/iPad)
 *  - Browser is Safari (not already installed as PWA)
 *  - User hasn't dismissed it this session
 */
export function IosInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandaloneMode =
      ('standalone' in navigator && (navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = sessionStorage.getItem('ios-install-dismissed');

    if (isIos && !isInStandaloneMode && !dismissed) {
      const t = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem('ios-install-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal full-screen card */}
      <div className="relative z-10 flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-14 pb-6 bg-gradient-to-b from-primary/10 to-background">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 shadow-lg">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">AC Chiari</p>
              <h1 className="text-xl font-bold">Installa l'app</h1>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Why install */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
            <p className="text-sm font-semibold text-primary mb-2">Perché installare l'app?</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                Ricevi <strong className="text-foreground">notifiche push</strong> su iPhone
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                Accesso rapido dalla schermata Home
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                Esperienza a schermo intero senza barra browser
              </li>
            </ul>
          </div>

          {/* Steps */}
          <div>
            <p className="text-sm font-semibold mb-4">Come installarla — 3 passi:</p>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                <div className="flex-1 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium">Tocca il pulsante <strong>Condividi</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">È il pulsante con la freccia verso l'alto nella barra del browser Safari, in basso allo schermo</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="rounded-lg bg-blue-500 p-2">
                      <Share className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">Pulsante Condividi</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">2</span>
                <div className="flex-1 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium">Tocca <strong>"Aggiungi alla schermata Home"</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">Scorri verso il basso nel menu di condivisione finché non vedi questa opzione</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="rounded-lg bg-gray-500 p-2">
                      <PlusSquare className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">Aggiungi alla schermata Home</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">3</span>
                <div className="flex-1 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium">Apri l'app e <strong>attiva le notifiche</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">Tocca l'icona AC Chiari sulla schermata Home, poi vai nella campanella 🔔 e attiva le notifiche push</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-10 pt-4 border-t bg-background space-y-3">
          <button
            onClick={dismiss}
            className="w-full rounded-2xl bg-primary text-white py-4 font-semibold text-base shadow-lg hover:bg-primary/90 transition-colors"
          >
            Ho capito, installo dopo
          </button>
          <button
            onClick={dismiss}
            className="w-full rounded-2xl py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Non mostrare più
          </button>
        </div>
      </div>
    </div>
  );
}
