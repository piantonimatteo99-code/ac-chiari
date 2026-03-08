'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/src/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { AlertCircle, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function PasswordDimenticataPage() {
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
      await sendPasswordResetEmail(auth, email);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      if (err.code === 'auth/user-not-found') {
        setErrorMessage("Nessun account trovato con questa email. Controlla l'indirizzo e riprova.");
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('Indirizzo email non valido. Controlla e riprova.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMessage('Troppe richieste. Attendi qualche minuto prima di riprovare.');
      } else {
        setErrorMessage("Si è verificato un errore. Riprova tra qualche istante.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sidebar-bg mb-4">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-12 w-12">
              <circle cx="32" cy="32" r="31" fill="hsl(218 62% 40%)" />
              <g opacity="0.2" stroke="hsl(44 90% 78%)" strokeWidth="1">
                <line x1="32" y1="1" x2="32" y2="63" />
                <line x1="1" y1="32" x2="63" y2="32" />
              </g>
              <rect x="28" y="10" width="8" height="44" rx="3" fill="hsl(44 90% 72%)" />
              <rect x="10" y="26" width="44" height="8" rx="3" fill="hsl(44 90% 72%)" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">AC Chiari</h1>
        </div>

        {/* Card */}
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
        </div>

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
  );
}
