'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/src/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { Eye, EyeOff, AlertCircle, InfoIcon } from 'lucide-react';

// ---- Logo SVG AC Chiari ----
function AcChiariLogo({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
      {/* Cerchio blu principale */}
      <circle cx="32" cy="32" r="32" fill="hsl(218 58% 42%)" />
      {/* Rete geometrica sottile — stile logo AC */}
      <g stroke="hsl(218 40% 65%)" strokeWidth="0.7" opacity="0.55">
        {/* Linee orizzontali e verticali */}
        <line x1="32" y1="4" x2="32" y2="60" />
        <line x1="4" y1="32" x2="60" y2="32" />
        {/* Diagonali */}
        <line x1="10" y1="10" x2="54" y2="54" />
        <line x1="54" y1="10" x2="10" y2="54" />
        {/* Linee oblique aggiuntive */}
        <line x1="32" y1="4" x2="10" y2="54" />
        <line x1="32" y1="4" x2="54" y2="54" />
        <line x1="4" y1="32" x2="54" y2="10" />
        <line x1="60" y1="32" x2="10" y2="10" />
        {/* Cerchio interno tratteggiato */}
        <circle cx="32" cy="32" r="20" strokeDasharray="2 3" />
        <circle cx="32" cy="32" r="12" strokeDasharray="1.5 2.5" />
      </g>
      {/* Croce gialla — spessa, prominente, con angoli arrotondati */}
      <rect x="26" y="12" width="12" height="40" rx="3" fill="hsl(44 92% 62%)" />
      <rect x="12" y="26" width="40" height="12" rx="3" fill="hsl(44 92% 62%)" />
    </svg>
  );
}

// ---- Componente interno che usa useSearchParams ----
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'email_not_verified') {
      setError('Devi prima verificare la tua email. Controlla la tua casella di posta e clicca il link che ti abbiamo inviato.');
    }
    const successParam = searchParams.get('signup_success');
    if (successParam === 'true') {
      setInfo("Registrazione completata! Ti abbiamo inviato un'email di verifica. Controlla la tua posta prima di accedere.");
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
    if (!auth) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setError('Devi prima verificare la tua email. Controlla la tua casella di posta e clicca il link che ti abbiamo inviato.');
        setIsLoading(false);
        return;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
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
      {/* Colonna sinistra — Branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 flex-col items-center justify-center bg-sidebar-bg p-12 relative overflow-hidden">
        {/* Cerchio decorativo sfondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-20%] right-[-20%] w-96 h-96 rounded-full bg-yellow-400" />
          <div className="absolute bottom-[-10%] left-[-15%] w-72 h-72 rounded-full bg-blue-300" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-8 text-center">
          <AcChiariLogo size={96} />
          <div>
            <h1 className="text-3xl font-bold text-sidebar-fg tracking-tight">Azione Cattolica</h1>
            <p className="text-lg font-medium text-sidebar-muted mt-1">Chiari</p>
          </div>
          <div className="max-w-xs">
            <p className="text-sidebar-muted text-sm leading-relaxed">
              Gestionale interno dell&apos;associazione. Accedi per gestire iscrizioni, contabilità, gruppi e molto altro.
            </p>
          </div>
        </div>
      </div>

      {/* Colonna destra — Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <AcChiariLogo size={64} />
            <h1 className="mt-4 text-2xl font-bold text-foreground">AC Chiari</h1>
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

            <div className="mt-5 text-center text-sm text-muted-foreground">
              Non hai un account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline underline-offset-2">
                Registrati
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
