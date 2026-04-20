'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserRound, Smartphone, X } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { UserProfileDialog } from './user-profile-dialog';
import { PwaInstallDialog } from './pwa-install-dialog';

const STORAGE_KEY = 'profile-onboarding-shown-v2';

interface PostOnboardingDialogProps {
  /** Se true, la dialog viene mostrata anche se il profilo è già completato
   *  (serve dopo il tutorial) */
  forceShow?: boolean;
  onClose?: () => void;
}

export function PostOnboardingDialog({ forceShow = false, onClose }: PostOnboardingDialogProps) {
  const { userData, isLoading } = useUserData();
  const [show, setShow] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [openPwa, setOpenPwa] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) && !forceShow) return;
    // Mostra se il profilo è incompleto OPPURE se forzato dal tutorial
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
    dismiss();
    setOpenProfile(true);
  };

  const handleInstalla = () => {
    dismiss();
    setOpenPwa(true);
  };

  return (
    <>
      <Dialog open={show} onOpenChange={(open) => { if (!open) dismiss(); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 px-6 pt-8 pb-6 text-center">
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors"
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
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
            <Button
              variant="outline"
              className="w-full flex items-center gap-2 h-12"
              onClick={handleInstalla}
            >
              <Smartphone className="h-4 w-4" />
              Installa l&apos;app sul telefono
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={dismiss}>
              Non ora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile dialog */}
      <UserProfileDialog
        isOpen={openProfile}
        onOpenChange={setOpenProfile}
        onSaved={() => localStorage.setItem(STORAGE_KEY, '1')}
      />

      {/* PWA install — controlled via state, shown when requested */}
      {openPwa && <PwaInstallDialog forceShow onDismiss={() => setOpenPwa(false)} />}
    </>
  );
}

/**
 * Versione auto-trigger: mostrata automaticamente ai nuovi utenti
 * senza profilo completo (comportamento storico).
 */
export function ProfileOnboardingDialog() {
  return <PostOnboardingDialog />;
}
