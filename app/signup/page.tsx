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
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const userDocRef = doc(firestore, "users", userCredential.user.uid);
      await setDoc(userDocRef, {
        id: userCredential.user.uid,
        displayName: `${firstName} ${lastName}`,
        email: email,
        roles: ["utente"],
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      
      router.push('/login?signup_success=true');
      
    } catch (err: any) {
       if (err.code === 'auth/email-already-in-use') {
        setError('Questo indirizzo email è già in uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('La password è troppo debole. Deve essere di almeno 6 caratteri.');
      } else {
        console.error(err);
        setError('Si è verificato un errore durante la registrazione.');
      }
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
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last-name">Cognome</Label>
                <Input
                  id="last-name"
                  placeholder="Rossi"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
              {error && <p className="text-destructive text-sm p-3 bg-destructive/10 border border-destructive/20 rounded-md">{error}</p>}
              <Button type="submit" className="w-full">
                Crea un account
              </Button>
            </div>
          </form>
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
