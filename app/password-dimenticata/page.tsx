'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/src/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2, ArrowLeft, Mail, InfoIcon } from 'lucide-react';
import { AcChiariLogo } from '@/components/ac-logo';
import { useTenant } from '@/src/hooks/useTenant';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function PasswordDimenticataPage() {
  const { tenantConfig } = useTenant();
  const cityName = tenantConfig.name.replace(/^AC\s*/i, '').trim();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const auth = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const emailRes = await fetch('/api/send-password-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!emailRes.ok) {
        const errorData = await emailRes.json();
        if (errorData.code === 'auth/user-not-found') {
          throw { code: 'auth/user-not-found' };
        }
        throw new Error('Errore riposta API, fallback su native');
      }

      setStatus('success');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setStatus('error');
        setErrorMessage("Nessun account trovato con questa email. Controlla l'indirizzo e riprova.");
        return;
      }

      try {
        console.warn("Invio custom email fallito, uso opzione di default:", err);
        await sendPasswordResetEmail(auth, email);
        setStatus('success');
      } catch (fallbackErr: any) {
        setStatus('error');
        if (fallbackErr.code === 'auth/user-not-found') {
          setErrorMessage("Nessun account trovato con questa email. Controlla l'indirizzo e riprova.");
        } else if (fallbackErr.code === 'auth/invalid-email') {
          setErrorMessage('Indirizzo email non valido. Controlla e riprova.');
        } else if (fallbackErr.code === 'auth/too-many-requests') {
          setErrorMessage('Troppe richieste. Attendi qualche minuto prima di riprovare.');
        } else {
          setErrorMessage("Si è verificato un errore. Riprova tra qualche istante.");
        }
      }
    }
  };

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

            {/* Stato: Successo */}
            {status === 'success' ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Email inviata!</h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Abbiamo inviato un link per reimpostare la password a{' '}
                    <span className="font-medium text-foreground">{email}</span>.
                    Controlla anche la cartella spam.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Non hai ricevuto l&apos;email?{' '}
                  <button
                    onClick={() => { setStatus('idle'); setEmail(''); }}
                    className="text-primary hover:underline underline-offset-2 font-medium"
                  >
                    Riprova
                  </button>
                </p>
              </div>
            ) : (
              /* Stato: Form */
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-foreground">Password dimenticata?</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Inserisci la tua email e ti invieremo un link per reimpostare la password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nome@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="rounded-xl h-11 pl-9"
                        disabled={status === 'loading'}
                      />
                    </div>
                  </div>

                  {/* Errore */}
                  {status === 'error' && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>{errorMessage}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-xl font-semibold text-sm mt-1"
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        Invio in corso...
                      </span>
                    ) : 'Invia link di reset'}
                  </Button>
                </form>
              </>
            )}

            {/* Link torna al login */}
            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Torna al login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
