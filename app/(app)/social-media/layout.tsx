import type { ReactNode } from 'react';

export const metadata = {
  title: 'Social Media · AC Chiari',
  description: 'Gestisci foto, messaggi e post social per tutti i progetti.',
};

export default function SocialMediaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
