'use client';

import { useEffect, useState, useRef } from 'react';
import { Share, PlusSquare, Smartphone, Monitor, X, Download, AlertCircle } from 'lucide-react';

type Platform = 'ios' | 'android' | 'desktop' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

const STORAGE_KEY = 'pwa-install-dismissed-v1';

interface PwaInstallDialogProps {
  /** Se true, mostra la dialog subito ignorando il localStorage */
  forceShow?: boolean;
  /** Callback chiamato quando la dialog viene chiusa */
  onDismiss?: () => void;
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isInStandaloneMode =
    ('standalone' in navigator && (navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isInStandaloneMode) return null;
  if (isIos) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

export function PwaInstallDialog({ forceShow = false, onDismiss }: PwaInstallDialogProps = {}) {
  const [platform, setPlatform] = useState<Platform>(null);
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Se forzato, mostra subito indipendentemente da localStorage
    const dismissed = !forceShow && localStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    const detected = detectPlatform() ?? (forceShow ? 'ios' : null);
    if (!detected) return;
    setPlatform(detected);

    if (detected === 'ios' || forceShow) {
      const t = setTimeout(() => setShow(true), 200);
      return () => clearTimeout(t);
    }

    // Android / Desktop: try to get the native install prompt
    const capturePrompt = (prompt: BeforeInstallPromptEvent) => {
      setDeferredPrompt(prompt);
      setShow(true);
    };

    // Check if already captured globally
    const existingPrompt = window.__pwaInstallPrompt;
    if (existingPrompt) {
      setDeferredPrompt(existingPrompt);
      const t = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(t);
    }

    // Secondary capture handler (in case the component mounted before the event fired)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const bipe = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = bipe;
      capturePrompt(bipe);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Listen for the custom event dispatched by our early-capture script
    const onPromptReady = () => {
      const p = window.__pwaInstallPrompt;
      if (p) capturePrompt(p);
    };
    window.addEventListener('pwa-prompt-ready', onPromptReady);

    // Android fallback: if browser never fires the event, show manual instructions
    let fallback: ReturnType<typeof setTimeout> | null = null;
    if (detected === 'android') {
      fallback = setTimeout(() => {
        if (!window.__pwaInstallPrompt) {
          setShow(true);
          setShowManualFallback(true);
        }
      }, 3000);
    }
    // Desktop: only show when native prompt fires

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', onPromptReady);
      if (fallback) clearTimeout(fallback);
    };
  }, []);

  const dismiss = (permanent = true) => {
    if (permanent) localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
    setInstallError(null);
    setShowManualFallback(false);
    onDismiss?.();
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) {
      setShowManualFallback(true);
      return;
    }

    setInstalling(true);
    setInstallError(null);

    // Safety timeout: if userChoice never resolves in 8s, reset
    timeoutRef.current = setTimeout(() => {
      console.warn('[PWA] Install prompt timed out — resetting');
      setInstalling(false);
      setInstallError('Il browser non ha risposto. Usa il pulsante ⊕ nella barra indirizzi del browser.');
      setShowManualFallback(true);
    }, 8000);

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (outcome === 'accepted') {
        localStorage.setItem(STORAGE_KEY, '1');
        setShow(false);
      } else {
        setInstallError('Installazione annullata. Puoi installarla in qualsiasi momento dal menu del browser.');
      }
    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      console.error('[PWA] Install error:', err);
      setInstallError("Impossibile avviare l'installazione automatica. Usa il pulsante nella barra indirizzi.");
      setShowManualFallback(true);
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
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
              <h1 className="text-xl font-bold">Installa l&apos;app</h1>
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

        {/* Content — pb-36 garantisce spazio sufficiente perché il footer non copra il contenuto su mobile */}
        <div className="flex-1 overflow-y-auto px-6 pb-36 md:pb-6 space-y-6">

          {/* Benefits */}
          <div className="rounded-2xl bg-primary/5 border border-primary/10 p-5">
            <p className="text-sm font-semibold text-primary mb-2">Perché installare l&apos;app?</p>
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

          {/* Error / fallback message */}
          {installError && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{installError}</p>
            </div>
          )}

          {/* iOS Steps */}
          {platform === 'ios' && (
            <div>
              <p className="text-sm font-semibold mb-4">Come installarla — 3 passi:</p>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                  <div className="flex-1 rounded-xl bg-muted p-4">
                    <p className="text-sm font-medium">Tocca il pulsante <strong>Condividi</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">È il pulsante con la freccia verso l&apos;alto nella barra di Safari</p>
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
                    <p className="text-sm font-medium">Tocca <strong>&quot;Aggiungi alla schermata Home&quot;</strong></p>
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
                    <p className="text-sm font-medium">Apri l&apos;app e <strong>attiva le notifiche</strong></p>
                    <p className="text-xs text-muted-foreground mt-1">Tocca l&apos;icona AC Chiari sulla schermata Home, poi attiva le notifiche dalla campanella 🔔</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android: native prompt available */}
          {platform === 'android' && deferredPrompt && !showManualFallback && (
            <div className="flex gap-4 items-start">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
              <div className="flex-1 rounded-xl bg-muted p-4">
                <p className="text-sm font-medium">Tocca <strong>&quot;Installa&quot;</strong> qui sotto</p>
                <p className="text-xs text-muted-foreground mt-1">Il browser ti chiederà conferma. L&apos;app verrà aggiunta alla tua schermata Home.</p>
              </div>
            </div>
          )}

          {/* Android: manual fallback */}
          {platform === 'android' && (!deferredPrompt || showManualFallback) && (
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
                    <p className="text-sm font-medium">Seleziona <strong>&quot;Aggiungi alla schermata Home&quot;</strong></p>
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

          {/* Desktop: native prompt available */}
          {platform === 'desktop' && deferredPrompt && !showManualFallback && (
            <div className="flex gap-4 items-start">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
              <div className="flex-1 rounded-xl bg-muted p-4">
                <p className="text-sm font-medium">Clicca <strong>&quot;Installa&quot;</strong> qui sotto</p>
                <p className="text-xs text-muted-foreground mt-1">L&apos;app verrà installata sul tuo computer. Avrai accesso rapido dal desktop o dal menu Start.</p>
              </div>
            </div>
          )}

          {/* Desktop: manual fallback */}
          {platform === 'desktop' && (!deferredPrompt || showManualFallback) && (
            <div>
              <p className="text-sm font-semibold mb-4">Come installarla:</p>
              <div className="flex gap-4 items-start">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow">1</span>
                <div className="flex-1 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium">
                    Clicca il pulsante{' '}
                    <span className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                      <Monitor className="h-3 w-3" />
                      Apri nell&apos;app
                    </span>{' '}
                    nella barra degli indirizzi
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Lo trovi a destra nella barra indirizzi di Chrome o Edge</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 pb-10 md:pb-6 pt-4 border-t bg-background space-y-3">
          {(platform === 'android' || platform === 'desktop') && deferredPrompt && !showManualFallback ? (
            <button
              onClick={handleNativeInstall}
              disabled={installing}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary text-white py-4 font-semibold text-base shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-70"
            >
              {installing ? (
                <>
                  <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Attendere...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Installa ora
                </>
              )}
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
