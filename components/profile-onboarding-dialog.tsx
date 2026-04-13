'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserRound, X } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { UserProfileDialog } from './user-profile-dialog';

const STORAGE_KEY = 'profile-onboarding-shown-v1';

export function ProfileOnboardingDialog() {
  const { userData, isLoading } = useUserData();
  const [show, setShow] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    // Already dismissed before
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return;
    // Only show if profile is incomplete (no CF = new user)
    if (!userData?.codiceFiscale) {
      // Small delay so the page can settle before showing the modal
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, [isLoading, userData]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  };

  const handleCompleta = () => {
    dismiss();
    setOpenProfile(true);
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
            <h2 className="text-xl font-bold mb-2">Benvenuto in AC Chiari! 👋</h2>
          </div>

          {/* Footer */}
          <div className="px-6 pt-5 pb-6 flex flex-col gap-2">
            <Button onClick={handleCompleta} className="w-full">
              Completa il profilo
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={dismiss}>
              Non ora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile dialog opened from onboarding */}
      <UserProfileDialog
        isOpen={openProfile}
        onOpenChange={setOpenProfile}
        onSaved={() => {
          localStorage.setItem(STORAGE_KEY, '1');
        }}
      />
    </>
  );
}
