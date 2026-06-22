'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser, useFirestore } from '@/src/firebase';
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Eye, EyeOff, AlertCircle, InfoIcon, ShieldCheck, X } from 'lucide-react';
import { AcChiariLogo } from '@/components/ac-logo';
import { triggerNotification } from '@/lib/trigger-notification';
import { useTenant } from '@/src/hooks/useTenant';

// ---- Componente interno che usa useSearchParams ----
function LoginForm() {
  const { tenantConfig } = useTenant();
  const cityName = tenantConfig.name.replace(/^AC\s*/i, '').trim();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google first-time: pending user waiting for privacy acceptance
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // States for resending email verification
  const [showResend, setShowResend] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<{
    uid: string;
    email: string;
    nome: string;
    cognome: string;
    displayName: string;
  } | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCountdown === 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'email_not_verified') {
      setError('Devi prima verificare la tua email. Controlla la tua casella di posta e clicca il link che ti abbiamo inviato.');
    }
    const successParam = searchParams.get('signup_success');
    if (successParam === 'true') {
      setInfo("Registrazione completata! Ti abbiamo inviato un'email di verifica. Controlla la tua posta prima di accedere.");
    }
    const emailVerified = searchParams.get('email_verified');
    if (emailVerified === 'true') {
      setInfo('✅ Email verificata con successo! Puoi ora accedere al tuo account.');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isUserLoading && user && user.emailVerified) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setShowResend(false);
    setUnverifiedUser(null);
    if (!auth) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        let nome = '';
        let cognome = '';
        let displayName = '';
        if (firestore) {
          try {
            const userDoc = await getDoc(doc(firestore, 'users', userCredential.user.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              nome = data.nome || '';
              cognome = data.cognome || '';
              displayName = data.displayName || '';
            }
          } catch (fsErr) {
            console.warn("Errore lettura Firestore per resend:", fsErr);
          }
        }

        setUnverifiedUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email || email,
          nome,
          cognome,
          displayName: displayName || userCredential.user.displayName || email,
        });
        setShowResend(true);

        await signOut(auth);
        setError('Devi prima verificare la tua email. Controlla la tua casella di posta e clicca il link che ti abbiamo inviato.');
        setIsLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      setShowResend(false);
      setUnverifiedUser(null);
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('Email o password non validi. Riprova.');
      } else {
        setError('Si è verificato un errore. Riprova tra qualche istante.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!unverifiedUser || isResending) return;
    setIsResending(true);
    setError(null);
    setInfo(null);

    try {
      // 1. Prova l'invio dell'email custom tramite l'API backend
      const emailRes = await fetch('/api/send-registration-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: unverifiedUser.uid,
          email: unverifiedUser.email,
          nome: unverifiedUser.nome,
          cognome: unverifiedUser.cognome,
          displayName: unverifiedUser.displayName,
        })
      });

      if (!emailRes.ok) throw new Error('API backend fallita, forzo fallback Firebase client-side');
      setInfo("Ti abbiamo reinviato l'email di attivazione personalizzata! Controlla la posta.");
      setResendCountdown(60);
    } catch (err) {
      console.warn("Invio custom fallito, provo fallback client-side:", err);

      // 2. Fallback client-side (Firebase standard):
      try {
        if (auth) {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://olicachiari.vercel.app';
          
          try {
            await sendEmailVerification(userCredential.user, {
              url: `${baseUrl}/auth/action`,
              handleCodeInApp: false,
            });
          } catch (fbErr: any) {
            console.warn("Fallback con continueUrl fallito, provo senza continueUrl:", fbErr.message);
            await sendEmailVerification(userCredential.user);
          }

          await signOut(auth);
          setInfo("Email di verifica inviata con successo (sistema predefinito Firebase).");
          setResendCountdown(60);
        }
      } catch (fbErr: any) {
        console.error("Anche il fallback client-side ha fallito:", fbErr);
        setError("Impossibile inviare l'email in questo momento. Riprova più tardi.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setInfo(null);
    if (!auth || !firestore) return;
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      const userDocRef = doc(firestore, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        // Prima registrazione via Google → richiedi accettazione privacy
        setPendingGoogleUser(fbUser);
        setShowPrivacyModal(true);
        setIsGoogleLoading(false);
        return;
      }

      // Utente già registrato → vai alla dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return;
      }
      setError('Accesso con Google non riuscito. Riprova.');
    }
  };

  // Conferma privacy nel modal → crea il documento Firestore e vai alla dashboard
  const handlePrivacyAccept = async () => {
    if (!pendingGoogleUser || !firestore) return;
    try {
      const userDocRef = doc(firestore, 'users', pendingGoogleUser.uid);
      const displayParts = (pendingGoogleUser.displayName || '').split(' ');
      const nome = displayParts[0] || '';
      const cognome = displayParts.slice(1).join(' ') || '';
      await setDoc(userDocRef, {
        id: pendingGoogleUser.uid,
        nome,
        cognome,
        displayName: pendingGoogleUser.displayName || '',
        email: pendingGoogleUser.email || '',
        roles: ['utente'],
        createdAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
      });
      // Notifica admin
      try {
        await triggerNotification({
          eventType: 'nuovo_utente',
          title: 'Nuovo Utente Registrato',
          body: `L'utente ${pendingGoogleUser.displayName} ha creato un account con Google.`,
          href: '/admin/gestione-utenti/utenti-registrati',
          userId: '__admin_broadcast__',
        });
      } catch { /* non bloccante */ }

      router.push('/dashboard');
    } catch (err) {
      console.error("Errore creazione doc Google:", err);
      setShowPrivacyModal(false);
      setError('Si è verificato un errore. Riprova.');
    }
  };

  // Rifiuto privacy → logout e chiudi modal
  const handlePrivacyDecline = async () => {
    if (auth) await signOut(auth);
    setPendingGoogleUser(null);
    setShowPrivacyModal(false);
  };

  if (isUserLoading || (!isUserLoading && user && user.emailVerified)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Modal privacy per primo accesso Google ── */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-bold text-lg text-foreground">Prima di continuare</h3>
              </div>
              <button
                onClick={handlePrivacyDecline}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Benvenuto/a! Poiché è la tua prima volta su AC Chiari, ti chiediamo di leggere
              e accettare la nostra Informativa sulla Privacy prima di creare il tuo profilo.
            </p>

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1.5 text-foreground/80">
              <p className="flex items-start gap-2"><span>✅</span><span>I tuoi dati sono accessibili solo agli educatori autorizzati</span></p>
              <p className="flex items-start gap-2"><span>✅</span><span>Le ricevute di pagamento vengono eliminate dopo la verifica</span></p>
              <p className="flex items-start gap-2"><span>✅</span><span>Nessun sistema di intelligenza artificiale analizza i tuoi documenti</span></p>
              <p className="flex items-start gap-2"><span>✅</span><span>I tuoi dati non vengono ceduti a terze parti</span></p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/privacy" target="_blank" className="underline hover:text-primary underline-offset-2">
                Leggi la Privacy Policy completa
              </Link>
            </p>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePrivacyDecline}
              >
                Non accetto
              </Button>
              <Button
                className="flex-1"
                onClick={handlePrivacyAccept}
              >
                Accetto e continuo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Colonna sinistra — Branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 flex-col items-center justify-center bg-sidebar-bg p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-20%] right-[-20%] w-96 h-96 rounded-full bg-yellow-400" />
          <div className="absolute bottom-[-10%] left-[-15%] w-72 h-72 rounded-full bg-blue-300" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <AcChiariLogo size={96} />
          <div>
            <h1 className="text-3xl font-bold text-sidebar-fg tracking-tight">Azione Cattolica</h1>
            <p className="text-lg font-medium text-sidebar-muted mt-1">{cityName}</p>
          </div>
        </div>
      </div>

      {/* Colonna destra — Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <AcChiariLogo size={64} />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{tenantConfig.name}</h1>
            <p className="text-sm text-muted-foreground">Azione Cattolica</p>
          </div>

          {/* Form card */}
          <div className="bg-card rounded-2xl border border-border shadow-card p-7">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">Accedi</h2>
              <p className="text-sm text-muted-foreground mt-1">Inserisci le tue credenziali per continuare</p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link
                    href="/password-dimenticata"
                    className="text-xs text-primary hover:underline underline-offset-2"
                  >
                    Password dimenticata?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Messaggi feedback */}
              {info && (
                <div className="flex items-start gap-2.5 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
                  <InfoIcon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <p>{info}</p>
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {showResend && unverifiedUser && (
                <div className="flex flex-col gap-2 rounded-xl bg-primary/10 border border-primary/20 p-3 text-sm text-primary-foreground/90 mt-1">
                  <div className="flex items-start gap-2.5 text-primary">
                    <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground text-xs">Non hai ricevuto l'email?</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Controlla la cartella Spam o richiedine una nuova cliccando qui sotto.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold rounded-lg h-9 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={handleResendVerification}
                    disabled={resendCountdown > 0 || isResending}
                  >
                    {isResending ? (
                      <span className="flex items-center gap-1.5 justify-center">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Invio in corso...
                      </span>
                    ) : resendCountdown > 0 ? (
                      `Invia di nuovo tra ${resendCountdown}s`
                    ) : (
                      "Invia di nuovo l'email"
                    )}
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold text-sm mt-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Accesso in corso...
                  </span>
                ) : 'Accedi'}
              </Button>
            </form>

            {/* Divisore */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">oppure</span>
              </div>
            </div>

            {/* Pulsante Google */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 rounded-xl font-semibold text-sm flex items-center gap-2.5"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
            >
              {isGoogleLoading ? (
                <span className="h-4 w-4 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {isGoogleLoading ? 'Accesso in corso...' : 'Accedi con Google'}
            </Button>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Non hai un account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline underline-offset-2">
                Registrati
              </Link>
            </div>

            <div className="mt-3 text-center text-xs text-muted-foreground/60">
              <Link href="/privacy" className="hover:underline underline-offset-2">
                Informativa sulla Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
