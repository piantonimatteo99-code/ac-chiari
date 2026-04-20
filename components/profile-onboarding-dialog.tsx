'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserRound, Smartphone, Monitor, Share, CheckCircle2, Loader2 } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { UserProfileDialog } from './user-profile-dialog';

const STORAGE_KEY = 'profile-onboarding-shown-v2';

// ── Rilevamento piattaforma ───────────────────────────────────────────────────

type Platform = 'ios' | 'android' | 'desktop' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window { __pwaInstallPrompt: BeforeInstallPromptEvent | null; }
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isStandalone =
    ('standalone' in navigator && (navigator as any).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) return null; // già installata
  if (isIos) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

// ── Bottone installazione smart ───────────────────────────────────────────────

function InstallButton({ onDone }: { onDone: () => void }) {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if (p === 'android' || p === 'desktop') {
      const existing = window.__pwaInstallPrompt;
      if (existing) setDeferredPrompt(existing);
      const handler = (e: Event) => {
        e.preventDefault();
        const bipe = e as BeforeInstallPromptEvent;
        window.__pwaInstallPrompt = bipe;
        setDeferredPrompt(bipe);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setTimeout(onDone, 1200);
      }
    } finally {
      setInstalling(false);
    }
  };

  if (platform === null) return null; // già installata o SSR

  // ── iOS ──────────────────────────────────────────────────────────────────
  if (platform === 'ios') {
    if (showIosGuide) {
      return (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-3">
          <p className="font-semibold text-blue-900 dark:text-blue-100">Come installare su iPhone / iPad:</p>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
            <p className="text-blue-800 dark:text-blue-200">Tocca il pulsante <strong>Condividi</strong> <Share className="inline h-3.5 w-3.5" /> nella barra di Safari</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">2</span>
            <p className="text-blue-800 dark:text-blue-200">Scorri e tocca <strong>«Aggiungi alla schermata Home»</strong></p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">3</span>
            <p className="text-blue-800 dark:text-blue-200">Tocca <strong>Aggiungi</strong> in alto a destra per confermare</p>
          </div>
        </div>
      );
    }
    return (
      <Button variant="outline" className="w-full flex items-center gap-2 h-12" onClick={() => setShowIosGuide(true)}>
        <Smartphone className="h-4 w-4" />
        Installa su iPhone / iPad
      </Button>
    );
  }

  // ── Android con prompt nativo ─────────────────────────────────────────────
  if (platform === 'android' && deferredPrompt) {
    if (installed) {
      return (
        <div className="flex items-center gap-2 text-green-600 font-medium text-sm justify-center py-2">
          <CheckCircle2 className="h-4 w-4" />
          App installata con successo!
        </div>
      );
    }
    return (
      <Button className="w-full flex items-center gap-2 h-12" onClick={handleNativeInstall} disabled={installing}>
        {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        {installing ? 'Attendere...' : 'Installa l\'app su Android'}
      </Button>
    );
  }

  // ── Android senza prompt (fallback manuale) ───────────────────────────────
  if (platform === 'android') {
    if (showAndroidGuide) {
      return (
        <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 text-sm space-y-3">
          <p className="font-semibold text-green-900 dark:text-green-100">Come installare su Android:</p>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-[10px] font-bold">1</span>
            <p className="text-green-800 dark:text-green-200">Tocca i tre puntini <strong>⋮</strong> in alto a destra di Chrome</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-[10px] font-bold">2</span>
            <p className="text-green-800 dark:text-green-200">Seleziona <strong>«Aggiungi alla schermata Home»</strong></p>
          </div>
        </div>
      );
    }
    return (
      <Button variant="outline" className="w-full flex items-center gap-2 h-12" onClick={() => setShowAndroidGuide(true)}>
        <Smartphone className="h-4 w-4" />
        Installa l&apos;app su Android
      </Button>
    );
  }

  // ── Desktop con prompt nativo ─────────────────────────────────────────────
  if (platform === 'desktop' && deferredPrompt) {
    if (installed) {
      return (
        <div className="flex items-center gap-2 text-green-600 font-medium text-sm justify-center py-2">
          <CheckCircle2 className="h-4 w-4" />
          App installata con successo!
        </div>
      );
    }
    return (
      <Button className="w-full flex items-center gap-2 h-12" onClick={handleNativeInstall} disabled={installing}>
        {installing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Monitor className="h-4 w-4" />}
        {installing ? 'Attendere...' : 'Installa l\'app sul PC'}
      </Button>
    );
  }

  // ── Desktop senza prompt (fallback: pulsante "Apri nell'app") ────────────
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4 text-sm">
      <p className="font-semibold mb-2 flex items-center gap-2">
        <Monitor className="h-4 w-4" /> Installa su PC / Mac
      </p>
      <p className="text-muted-foreground text-xs leading-relaxed mb-2">
        Clicca il pulsante nella barra degli indirizzi di Chrome o Edge:
      </p>
      <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm">
        <Monitor className="h-3.5 w-3.5" />
        Apri nell&apos;app
      </span>
    </div>
  );
}

// ── Dialog post-tutorial ──────────────────────────────────────────────────────

interface PostOnboardingDialogProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export function PostOnboardingDialog({ forceShow = false, onClose }: PostOnboardingDialogProps) {
  const { userData, isLoading } = useUserData();
  const [show, setShow] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) && !forceShow) return;
    if (forceShow || !userData?.codiceFiscale) {
      const t = setTimeout(() => setShow(true), forceShow ? 200 : 1200);
      return () => clearTimeout(t);
    }
  }, [isLoading, userData, forceShow]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
    onClose?.();
  };

  const handleCompleta = () => {
    // Salva il flag e chiudi il dialog principale,
    // ma NON chiamare onClose: il componente deve restare montato
    // finché UserProfileDialog è aperto
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
    setOpenProfile(true);
  };

  return (
    <>
      <Dialog open={show} onOpenChange={(open) => { if (!open) dismiss(); }}>
        {/* [&>button]:hidden nasconde il close button built-in di shadcn (già gestito da onOpenChange) */}
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 [&>button]:hidden">
          {/* Gradient header */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 px-6 pt-8 pb-6 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mb-4">
              <UserRound className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-1">Benvenuto in AC Chiari! 👋</h2>
            <p className="text-sm text-muted-foreground">Cosa vuoi fare adesso?</p>
          </div>

          {/* Azioni */}
          <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
            <Button onClick={handleCompleta} className="w-full flex items-center gap-2 h-12">
              <UserRound className="h-4 w-4" />
              Aggiungi i miei dati personali
            </Button>

            {/* Bottone installazione dinamico per piattaforma */}
            <InstallButton onDone={dismiss} />

            <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={dismiss}>
              Non ora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile dialog — resta montato finché l'utente non lo chiude,
          solo ALLORA segnaliamo onClose al genitore (layout) */}
      <UserProfileDialog
        isOpen={openProfile}
        onOpenChange={(open) => {
          setOpenProfile(open);
          if (!open) onClose?.();
        }}
        onSaved={() => localStorage.setItem(STORAGE_KEY, '1')}
      />
    </>
  );
}

/**
 * Versione auto-trigger per utenti già registrati senza profilo completo.
 */
export function ProfileOnboardingDialog() {
  return <PostOnboardingDialog />;
}
