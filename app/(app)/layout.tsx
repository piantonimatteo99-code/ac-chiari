'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';
import { useUser } from '@/src/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/src/firebase';
import { Toaster } from '@/components/ui/toaster';
import { PwaInstallDialog } from '@/components/pwa-install-dialog';
import { ProfileOnboardingDialog, PostOnboardingDialog } from '@/components/profile-onboarding-dialog';
import { AiAssistant } from '@/components/ai-assistant';
import { OnboardingTutorial, useOnboardingTutorial } from '@/components/onboarding-tutorial';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { useUserData } from '@/src/hooks/use-user-data';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const { userData, isLoading: isUserDataLoading } = useUserData();
  const router = useRouter();
  const auth = useAuth();

  // Tutorial onboarding
  const { shouldShow: showTutorial, markDone: markTutorialDone } = useOnboardingTutorial();
  const [showPostDialog, setShowPostDialog] = useState(false);

  useEffect(() => {
    if (isUserLoading || isUserDataLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!user.emailVerified) {
      if (auth) {
        signOut(auth);
      }
      router.push('/login?error=email_not_verified');
      return;
    }

    // Se l'utente è autenticato ma non è registrato in questo tenant
    if (!userData) {
      if (auth) {
        signOut(auth);
      }
      router.push('/login?error=not_registered_tenant');
    }
  }, [user, isUserLoading, userData, isUserDataLoading, router, auth]);

  if (isUserLoading || isUserDataLoading || !user || !user.emailVerified || !userData) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Sidebar />
      <PullToRefresh>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-64">
          <Header />
          <main className="flex-1 gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
            {children}
          </main>
        </div>
      </PullToRefresh>
      <Toaster />

      {/* Tutorial interattivo — mostrato solo ai nuovi utenti, PRIMA di tutto */}
      {showTutorial && (
        <OnboardingTutorial
          onComplete={() => {
            markTutorialDone();
            setShowPostDialog(true);
          }}
        />
      )}

      {/* Dialog post-tutorial: aggiungi dati / installa app */}
      {showPostDialog && (
        <PostOnboardingDialog
          forceShow
          onClose={() => setShowPostDialog(false)}
        />
      )}

      {/* Dialog per utenti già registrati senza profilo completo (senza tutorial) */}
      {!showTutorial && !showPostDialog && <ProfileOnboardingDialog />}

      {/* PWA install auto (per chi non ha visto il tutorial) */}
      {!showTutorial && <PwaInstallDialog />}

      {/* AI Assistant — floating chat bubble */}
      <AiAssistant />
    </div>
  );
}
