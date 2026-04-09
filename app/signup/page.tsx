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
import { useAuth, useUser, useFirestore } from '@/src/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { triggerNotification } from '@/lib/trigger-notification';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [familyEmailHead, setFamilyEmailHead] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
    if (!auth || !firestore) return;

    try {
      // STEP 1: Crea l'account Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // STEP 2: Invia subito l'email di verifica — questo NON deve essere bloccato da nient'altro
      try {
        const emailRes = await fetch('/api/send-registration-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, displayName: `${nome} ${cognome}` })
        });
        if (!emailRes.ok) {
          throw new Error('Risposta API non OK, uso fallback Firebase');
        }
      } catch (emailErr) {
        // Fallback: usa l'email di default Firebase (non brandizzata ma con redirect corretto)
        console.warn("Invio custom email fallito, uso fallback Firebase:", emailErr);
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://olicachiari.vercel.app';
          await sendEmailVerification(userCredential.user, {
            url: `${baseUrl}/auth/action`,
            handleCodeInApp: true,
          });
        } catch (fbErr) {
          console.error("Anche il fallback Firebase ha fallito:", fbErr);
        }
      }

      // STEP 3: Crea il documento utente su Firestore (non bloccante per il flusso principale)
      try {
        const userDocRef = doc(firestore, "users", userCredential.user.uid);
        await setDoc(userDocRef, {
          id: userCredential.user.uid,
          nome: nome,
          cognome: cognome,
          displayName: `${nome} ${cognome}`,
          email: email,
          roles: ["utente"],
          createdAt: serverTimestamp(),
        });
      } catch (firestoreErr) {
        console.error("Errore scrittura Firestore (non bloccante):", firestoreErr);
      }

      // STEP 4: Se fornita l'email del capofamiglia, invia richiesta di collegamento al nucleo
      if (familyEmailHead.trim()) {
        try {
          await fetch('/api/family/request-join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requesterId: userCredential.user.uid,
              requesterEmail: email,
              requesterName: `${nome} ${cognome}`,
              targetFamilyEmail: familyEmailHead.trim(),
            }),
          });
        } catch (joinErr) {
          console.warn("Errore invio richiesta famiglia (non bloccante):", joinErr);
        }
      }

      // STEP 5: Notifica admin (non bloccante)
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

      // STEP 5: Logout e redirect
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
    if (!auth || !firestore) return;
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;

      // Crea il documento Firestore solo se è la prima volta
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
        });
        // Notifica admin per nuovo utente Google
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

      // Google verifica già l'email — vai alla dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setIsGoogleLoading(false);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      setError('Accesso con Google non riuscito. Riprova.');
    }
  };
  
  if (isUserLoading || (!isUserLoading && user)) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="mx-auto max-w-md">
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

              {/* Sezione nucleo familiare — opzionale */}
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nucleo Familiare (opzionale)</p>
                <div className="grid gap-2">
                  <Label htmlFor="family-email" className="text-sm">Email del capofamiglia</Label>
                  <Input
                    id="family-email"
                    type="email"
                    placeholder="capofamiglia@example.com"
                    value={familyEmailHead}
                    onChange={(e) => setFamilyEmailHead(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se fai parte di una famiglia già registrata, inserisci l&apos;email del capofamiglia.
                    Verrà inviata una richiesta di collegamento che dovrà essere approvata.
                  </p>
                </div>
              </div>

              {error && <p className="text-destructive text-sm p-3 bg-destructive/10 border border-destructive/20 rounded-md">{error}</p>}
              <Button type="submit" className="w-full">
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
            disabled={isGoogleLoading}
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
