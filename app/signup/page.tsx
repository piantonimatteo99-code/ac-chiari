'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth, useUser, useFirestore } from '@/src/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { triggerNotification } from '@/lib/trigger-notification';
import { AlertCircle, ShieldCheck, X } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google first-time: pending user waiting for privacy acceptance
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!privacyAccepted) {
      setError('Devi accettare la Privacy Policy per continuare.');
      return;
    }
    if (!auth || !firestore) return;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      try {
        const emailRes = await fetch('/api/send-registration-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userCredential.user.uid,
            email,
            nome,
            cognome,
            displayName: `${nome} ${cognome}`,
          })
        });
        if (!emailRes.ok) throw new Error('Risposta API non OK, uso fallback Firebase');
      } catch (emailErr) {
        console.warn("Invio custom email fallito, uso fallback Firebase:", emailErr);
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://olicachiari.vercel.app';
          await sendEmailVerification(userCredential.user, {
            url: `${baseUrl}/auth/action`,
            handleCodeInApp: false,
          });
        } catch (fbErr: any) {
          console.error("Il fallback Firebase con continueUrl ha fallito, provo senza settings:", fbErr);
          try {
            await sendEmailVerification(userCredential.user);
          } catch (retryErr) {
            console.error("Anche il secondo fallback client-side ha fallito:", retryErr);
          }
        }
      }

      try {
        const userDocRef = doc(firestore, "users", userCredential.user.uid);
        await setDoc(userDocRef, {
          id: userCredential.user.uid,
          nome,
          cognome,
          displayName: `${nome} ${cognome}`,
          email,
          roles: ["utente"],
          createdAt: serverTimestamp(),
          privacyAcceptedAt: serverTimestamp(),
        }, { merge: true });
      } catch (firestoreErr) {
        console.error("Errore scrittura Firestore (non bloccante):", firestoreErr);
      }

      try {
        await triggerNotification({
          eventType: 'nuovo_utente',
          title: "Nuovo Utente Registrato",
          body: `L'utente ${nome} ${cognome} ha creato un account sul portale.`,
          href: "/admin/gestione-utenti/utenti-registrati",
          userId: "__admin_broadcast__"
        });
      } catch (notifErr) {
        console.warn("Errore notifica admin (non bloccante):", notifErr);
      }

      await signOut(auth);
      router.push('/login?signup_success=true');

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Questo indirizzo email è già in uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('La password è troppo debole. Deve essere di almeno 6 caratteri.');
      } else {
        console.error("Errore registrazione:", err);
        setError('Si è verificato un errore durante la registrazione.');
      }
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    if (!privacyAccepted) {
      setError('Devi accettare la Privacy Policy per continuare.');
      return;
    }
    if (!auth || !firestore) return;
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      const userDocRef = doc(firestore, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        const displayParts = (fbUser.displayName || '').split(' ');
        const nomeG = displayParts[0] || '';
        const cognomeG = displayParts.slice(1).join(' ') || '';
        await setDoc(userDocRef, {
          id: fbUser.uid,
          nome: nomeG,
          cognome: cognomeG,
          displayName: fbUser.displayName || '',
          email: fbUser.email || '',
          roles: ['utente'],
          createdAt: serverTimestamp(),
          privacyAcceptedAt: serverTimestamp(),
        });
        try {
          await triggerNotification({
            eventType: 'nuovo_utente',
            title: 'Nuovo Utente Registrato',
            body: `L'utente ${fbUser.displayName} ha creato un account con Google.`,
            href: '/admin/gestione-utenti/utenti-registrati',
            userId: '__admin_broadcast__',
          });
        } catch { /* non bloccante */ }
      }

      router.push('/dashboard');
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError('Accesso con Google non riuscito. Riprova.');
    }
  };

  // Handle Google first-time login privacy modal confirm
  const handlePrivacyModalAccept = async () => {
    if (!pendingGoogleUser || !firestore) return;
    try {
      const userDocRef = doc(firestore, 'users', pendingGoogleUser.uid);
      const displayParts = (pendingGoogleUser.displayName || '').split(' ');
      const nomeG = displayParts[0] || '';
      const cognomeG = displayParts.slice(1).join(' ') || '';
      await setDoc(userDocRef, {
        id: pendingGoogleUser.uid,
        nome: nomeG,
        cognome: cognomeG,
        displayName: pendingGoogleUser.displayName || '',
        email: pendingGoogleUser.email || '',
        roles: ['utente'],
        createdAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
      });
      router.push('/dashboard');
    } catch (err) {
      console.error("Errore creazione doc Google:", err);
      setShowPrivacyModal(false);
    }
  };

  if (isUserLoading || (!isUserLoading && user)) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {/* ── Privacy modal per primo accesso Google ── */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-bold text-lg text-foreground">Accettazione Privacy Policy</h3>
              </div>
              <button
                onClick={async () => { if (auth) await signOut(auth); setShowPrivacyModal(false); setPendingGoogleUser(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Prima di completare la registrazione, è necessario leggere e accettare la
              nostra Informativa sulla Privacy. I tuoi dati personali e i documenti di ricevuta
              saranno consultati esclusivamente dagli educatori autorizzati e i documenti
              verranno eliminati al termine della verifica.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p>✅ I tuoi dati sono accessibili solo agli educatori autorizzati</p>
              <p>✅ Le ricevute vengono eliminate dopo la verifica</p>
              <p>✅ Nessun sistema AI analizza i tuoi documenti</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => { if (auth) await signOut(auth); setShowPrivacyModal(false); setPendingGoogleUser(null); }}
              >
                Annulla
              </Button>
              <Button
                className="flex-1"
                onClick={handlePrivacyModalAccept}
              >
                Accetto e continuo
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/privacy" target="_blank" className="underline hover:text-primary">
                Leggi la Privacy Policy completa
              </Link>
            </p>
          </div>
        </div>
      )}

      <Card className="mx-auto max-w-md w-full mx-4">
        <CardHeader>
          <CardTitle className="text-xl">Registrati</CardTitle>
          <CardDescription>
            Inserisci i tuoi dati per creare un account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first-name">Nome</Label>
                <Input
                  id="first-name"
                  placeholder="Mario"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-name">Cognome</Label>
                <Input
                  id="last-name"
                  placeholder="Rossi"
                  required
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* ── Checkbox Privacy ── */}
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <Checkbox
                  id="privacy-accept"
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(!!checked)}
                  className="mt-0.5"
                />
                <label htmlFor="privacy-accept" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  Ho letto e accetto la{' '}
                  <Link href="/privacy" target="_blank" className="font-medium text-primary underline underline-offset-2 hover:text-primary/80">
                    Privacy Policy
                  </Link>
                  . Comprendo che i miei dati personali e i documenti di ricevuta saranno
                  consultati esclusivamente dagli educatori autorizzati e che i documenti
                  verranno eliminati al termine della verifica del pagamento.
                </label>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-destructive text-sm p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!privacyAccepted}
              >
                Crea un account
              </Button>
            </div>
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
            className="w-full flex items-center gap-2.5"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading || !privacyAccepted}
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
            {isGoogleLoading ? 'Accesso in corso...' : 'Registrati con Google'}
          </Button>

          {!privacyAccepted && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Accetta la Privacy Policy per abilitare la registrazione
            </p>
          )}

          <div className="mt-4 text-center text-sm">
            Hai già un account?{' '}
            <Link href="/login" className="underline">
              Accedi
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
