'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { applyActionCode, getAuth } from 'firebase/auth';
import { useFirebaseApp } from '@/src/firebase';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

type ActionState = 'loading' | 'success' | 'error' | 'already_done';

export default function AuthActionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
}

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firebaseApp = useFirebaseApp();

  const [state, setState] = useState<ActionState>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    // ── Case 1: Arrived as continueUrl from Firebase hosted page ──────────
    // Firebase already handled the verification. No mode/oobCode present.
    // Just show success and redirect.
    if (!mode && !oobCode) {
      setState('success');
      setTimeout(() => router.replace('/login?email_verified=true'), 3000);
      return;
    }

    // ── Case 2: Direct link with oobCode (handleCodeInApp scenario) ───────
    if (!oobCode) {
      setState('error');
      setErrorMsg('Link non valido o incompleto.');
      return;
    }

    if (mode === 'resetPassword') {
      // Redirect to a dedicated password reset page (future use)
      router.replace(`/reset-password?oobCode=${oobCode}`);
      return;
    }

    if (mode !== 'verifyEmail') {
      router.replace('/login');
      return;
    }

    const auth = getAuth(firebaseApp);

    applyActionCode(auth, oobCode)
      .then(() => {
        setState('success');
        // Auto-redirect to login after 3 seconds
        setTimeout(() => router.replace('/login?email_verified=true'), 3000);
      })
      .catch((err: any) => {
        console.error('[auth/action] Error:', err.code, err.message);
        if (
          err.code === 'auth/invalid-action-code' ||
          err.code === 'auth/expired-action-code' ||
          err.code === 'auth/user-disabled'
        ) {
          setState('already_done');
        } else {
          setState('error');
          setErrorMsg(err.message || 'Si è verificato un errore imprevisto.');
        }
      });
  }, [searchParams, firebaseApp, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-8 py-6 text-white text-center">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-1">AC Chiari</p>
          <h1 className="text-xl font-bold">Verifica Email</h1>
        </div>

        {/* Body */}
        <div className="px-8 py-10 flex flex-col items-center text-center gap-6">
          {state === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              <p className="text-gray-600 font-medium">Verifica in corso...</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Email verificata!</h2>
                <p className="text-gray-500 text-sm">
                  Il tuo account è stato confermato con successo.<br />
                  Verrai reindirizzato al login tra pochi secondi...
                </p>
              </div>
              <Link
                href="/login?email_verified=true"
                className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
              >
                Vai al Login
              </Link>
            </>
          )}

          {state === 'already_done' && (
            <>
              <div className="h-20 w-20 rounded-full bg-amber-100 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Link già utilizzato</h2>
                <p className="text-gray-500 text-sm">
                  Il link di verifica è già stato usato o è scaduto.<br />
                  Se il tuo account è già verificato, puoi accedere normalmente.
                </p>
              </div>
              <Link
                href="/login"
                className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
              >
                Vai al Login
              </Link>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Errore di verifica</h2>
                <p className="text-gray-500 text-sm">{errorMsg}</p>
              </div>
              <Link
                href="/login"
                className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-colors"
              >
                Torna al Login
              </Link>
            </>
          )}
        </div>

        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} AC Chiari — Sistema Gestione</p>
        </div>
      </div>
    </div>
  );
}
