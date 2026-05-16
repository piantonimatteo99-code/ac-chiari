/**
 * Layout pubblico per i moduli condivisibili (/f/[formId])
 * Non richiede autenticazione — nessuna sidebar né header.
 * Toaster e FirebaseClientProvider sono già nel root layout.
 */
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Modulo | AC Chiari',
  description: 'Compila il modulo',
};

export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
