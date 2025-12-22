'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useAuth, useUser } from '@/src/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'email_not_verified') {
      setError("Devi prima verificare la tua email. Controlla la tua casella di posta e il link che ti abbiamo inviato.");
    }
     const successParam = searchParams.get('signup_success');
    if (successParam === 'true') {
      setError("Registrazione completata! Ti abbiamo inviato un'email di verifica. Controlla la tua posta prima di accedere.");
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
    if (!auth) return;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        setError("Devi prima verificare la tua email. Controlla la tua casella di posta e il link che ti abbiamo inviato.");
        return;
      }
      router.push('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email o password non validi.');
      } else {
        setError(err.message);
      }
    }
  };
  
  if (isUserLoading || (!isUserLoading && user && user.emailVerified)) {
    return <div className="flex items-center justify-center min-h-screen">Caricamento...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">AC Chiari</CardTitle>
          <CardDescription>
            Benvenuto! Accedi per continuare
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="grid gap-4">
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
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/password-dimenticata"
                    className="ml-auto inline-block text-sm underline"
                  >
                    Password dimenticata?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-destructive text-sm p-2 bg-destructive/10 rounded-md">{error}</p>}
              <Button type="submit" className="w-full">
                Login
              </Button>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            Non hai un account?{' '}
            <Link href="/signup" className="underline">
              Registrati
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
