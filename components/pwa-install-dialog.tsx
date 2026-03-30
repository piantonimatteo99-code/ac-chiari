'use client';

import { useEffect, useState } from 'react';
import { Share, PlusSquare, Smartphone, Monitor, X, Download } from 'lucide-react';

type Platform = 'ios' | 'android' | 'desktop' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'pwa-install-dismissed-v1';

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isInStandaloneMode =
    ('standalone' in navigator && (navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isInStandaloneMode) return null; // Already installed
  if (isIos) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

export function PwaInstallDialog() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const detected = detectPlatform();
    setPlatform(detected);

    if (detected === 'android' || detected === 'desktop') {
      // Listen for the native install prompt (Android + Desktop Chrome/Edge)
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        const t = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(t);
      };
      window.addEventListener('beforeinstallprompt', handler);

      // Also show after a small delay even if the prompt hasn't fired yet
      // (to show manual instructions as fallback)
      const fallback = setTimeout(() => {
        setShow(true);
      }, 2000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(fallback);
      };
    }

    if (detected === 'ios') {
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (permanent = true) => {
    if (permanent) localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    setDeferredPrompt(null);
    setInstalling(false);
    setShow(false);
  };

  if (!show || !platform) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => dismiss(false)} />

      {/* Modal */}
      <div className="relative z-10 flex flex-col h-full bg-background md:h-auto md:max-h-[90vh] md:max-w-lg md:m-auto md:rounded-3xl md:shadow-2xl md:overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-12 md:pt-8 pb-6 bg-gradient-to-b from-primary/10 to-background shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 shadow-lg">
              {platform === 'desktop' ? (
                <Monitor className="h-6 w-6 text-white" />
              ) : (
                <Smartphone className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-primary uppercase tracking-wider">AC Chiari</p>
              <h1 className="text-xl font-bold">Installa l'app</h1>
            </div>
          </div>
          <button
            onClick={() => dismiss(false)}
            className="rounded-full p-2 bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Benefits */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
            <p className="text-sm font-semibold text-primary mb-2">Perché installare l'app?</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500 font-bold">✓</span>
                Ricevi <strong className="text-foreground">notifiche push</strong>
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

          {/* ── iOS Steps ── */}
          {platform === 'ios' && (
            <div>
              <p className="text-sm font-semibold mb-4">Come installarla — 3 passi:</p>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                  <div className="flex-1 rounded-xl bg-muted p-4">
                    <p className="text-sm font-medium">Tocca il pulsante <strong>Condividi</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">È il pulsante con la freccia verso l'alto nella barra di Safari</p>
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
                    <p className="text-xs text-muted-foreground mt-1">Scorri verso il basso nel menu di condivisione</p>
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
                    <p className="text-xs text-muted-foreground mt-1">Tocca l'icona AC Chiari sulla schermata Home, poi attiva le notifiche dalla campanella 🔔</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Android one-tap install ── */}
          {platform === 'android' && (
            <div>
              {deferredPrompt ? (
                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                  <div className="flex-1 rounded-xl bg-muted p-4">
                    <p className="text-sm font-medium">Tocca <strong>"Installa"</strong> qui sotto</p>
                    <p className="text-xs text-muted-foreground mt-1">Il browser ti chiederà conferma. L'app verrà aggiunta alla tua schermata Home.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold mb-4">Come installarla — 2 passi:</p>
                  <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                      <div className="flex-1 rounded-xl bg-muted p-4">
                        <p className="text-sm font-medium">Tocca il menu <strong>⋮</strong> del browser</p>
                        <p className="text-xs text-muted-foreground mt-1">I tre puntini in alto a destra di Chrome</p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">2</span>
                      <div className="flex-1 rounded-xl bg-muted p-4">
                        <p className="text-sm font-medium">Seleziona <strong>"Aggiungi alla schermata Home"</strong></p>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="rounded-lg bg-gray-500 p-2">
                            <PlusSquare className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-xs text-muted-foreground">Aggiungi alla schermata Home</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Desktop one-tap install ── */}
          {platform === 'desktop' && (
            <div>
              {deferredPrompt ? (
                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                  <div className="flex-1 rounded-xl bg-muted p-4">
                    <p className="text-sm font-medium">Clicca <strong>"Installa"</strong> qui sotto</p>
                    <p className="text-xs text-muted-foreground mt-1">L'app verrà installata sul tuo computer come applicazione nativa. Avrai accesso rapido dal desktop o dal menu Start.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold mb-4">Come installarla:</p>
                  <div className="flex gap-4 items-start">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                    <div className="flex-1 rounded-xl bg-muted p-4">
                      <p className="text-sm font-medium">Clicca sull'icona <strong>"Installa"</strong> nella barra indirizzi</p>
                      <p className="text-xs text-muted-foreground mt-1">In Chrome/Edge trovi un'icona di download (⊕) nella barra indirizzi a destra</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-10 md:pb-6 pt-4 border-t bg-background space-y-3">
          {(platform === 'android' || platform === 'desktop') && deferredPrompt ? (
            <button
              onClick={handleNativeInstall}
              disabled={installing}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-white py-4 font-semibold text-base shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              {installing ? 'Installazione in corso...' : 'Installa ora'}
            </button>
          ) : (
            <button
              onClick={() => dismiss(true)}
              className="w-full rounded-2xl bg-primary text-white py-4 font-semibold text-base shadow-lg hover:bg-primary/90 transition-colors"
            >
              Ho capito, installo dopo
            </button>
          )}
          <button
            onClick={() => dismiss(true)}
            className="w-full rounded-2xl py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Non mostrare più
          </button>
        </div>
      </div>
    </div>
  );
}
