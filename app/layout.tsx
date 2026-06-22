import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { FirebaseClientProvider } from "@/src/firebase/client-provider";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";
import { headers } from "next/headers";
import { TenantProvider } from "@/src/hooks/useTenant";
import { DEFAULT_TENANT_ID } from "@/lib/tenants";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "AC Chiari — Azione Cattolica",
  description: "Gestionale interno per l'associazione Azione Cattolica di Chiari. Gestione iscrizioni, contabilità, gruppi e calendario.",
  manifest: "/manifest.json",
  verification: {
    google: "RLDx_7oK20JRYrUZcA096fJTFwuGwLKKGRD9_guHMcM",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AC Chiari",
  },
  icons: {
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

/** Maps a tenantId to its Firestore database ID. */
function getDatabaseIdForTenant(tenantId: string): string {
  if (tenantId === 'acbrescia') return 'acbrescia';
  return '(default)';
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const tenantId = headersList.get("x-tenant-id") || DEFAULT_TENANT_ID;
  const databaseId = getDatabaseIdForTenant(tenantId);

  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* PWA meta tags for iOS - apple-mobile-web-app-capable emitted by Next.js metadata API */}
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* Register unified service worker + capture beforeinstallprompt early */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                    .catch(function(err) { console.warn('[SW] Registration failed:', err); });
                });
              }
              // Capture install prompt before React hydrates to avoid race condition
              window.__pwaInstallPrompt = null;
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.__pwaInstallPrompt = e;
                window.dispatchEvent(new Event('pwa-prompt-ready'));
              });
              window.addEventListener('appinstalled', function() {
                window.__pwaInstallPrompt = null;
              });
            `,
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          nunito.variable
        )}
      >
        <FirebaseClientProvider databaseId={databaseId}>
          <TenantProvider tenantId={tenantId}>
            {children}
          </TenantProvider>
        </FirebaseClientProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
