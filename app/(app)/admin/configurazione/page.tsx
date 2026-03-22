'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, FolderOpen, Loader2, Mail, RefreshCw, XCircle } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';

function ConfigurazioneContent() {
  const searchParams = useSearchParams();
  const driveConnected = searchParams.get('drive_connected') === 'true';
  const driveError = searchParams.get('drive_error');
  const { userData } = useUserData();
  const isAdmin = userData?.roles?.includes('admin');

  // Check current Drive token status
  const [tokenStatus, setTokenStatus] = useState<'checking' | 'ok' | 'expired' | 'unknown'>('checking');

  useEffect(() => {
    // Ping the Drive listing endpoint to check if token works
    fetch('/api/drive/documents?folderId=root')
      .then(res => {
        if (res.ok) { setTokenStatus('ok'); }
        else { res.json().then(d => {
          if (d.error && (d.error.includes('expired') || d.error.includes('revoked') || d.error.includes('Token'))) {
            setTokenStatus('expired');
          } else {
            setTokenStatus('unknown');
          }
        }).catch(() => setTokenStatus('unknown')); }
      })
      .catch(() => setTokenStatus('unknown'));
  }, [driveConnected]);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Accesso negato. Solo gli amministratori possono accedere a questa pagina.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Configurazione Sistema</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Integrazione Google Drive
          </CardTitle>
          <CardDescription>
            Gestisci il collegamento con l'account Google dell'organizzazione per l'archiviazione dei documenti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {driveConnected && (
            <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Google Drive collegato con successo!</p>
                <p className="text-sm">L'applicazione ora può creare cartelle e documenti automaticamente.</p>
              </div>
            </div>
          )}

          {driveError && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Errore nella connessione a Google Drive</p>
                <p className="text-sm">{driveError}</p>
              </div>
            </div>
          )}

          {/* Token status badge */}
          <div className="rounded-lg border p-4 flex items-start gap-3">
            {tokenStatus === 'checking' && (
              <><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-0.5 shrink-0" />
              <div><p className="font-medium">Verifica connessione...</p><p className="text-sm text-muted-foreground">Controllo stato del token Google Drive.</p></div></>
            )}
            {tokenStatus === 'ok' && (
              <><CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div><p className="font-medium text-green-700">Google Drive connesso ✓</p><p className="text-sm text-muted-foreground">Il token è valido e funzionante.</p></div></>
            )}
            {tokenStatus === 'expired' && (
              <><XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Token scaduto — ricollegare Drive</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Il token di accesso è scaduto o revocato. Clicca il pulsante qui sotto per riautenticarti.
                  Se questo si ripete ogni ~7 giorni, vai su{' '}
                  <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                    Google Cloud Console <ExternalLink className="h-3 w-3" />
                  </a>
                  {' '}e pubblica l'app OAuth (Pubblica app) per token permanenti.
                </p>
              </div></>
            )}
            {tokenStatus === 'unknown' && (
              <><Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div><p className="font-medium text-amber-700">Stato sconosciuto</p><p className="text-sm text-muted-foreground">Drive potrebbe non essere ancora configurato.</p></div></>
            )}
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Account organizzazione consigliato</p>
                <p className="text-sm text-muted-foreground">
                  Per garantire la continuità, ti consigliamo di collegare l'account <span className="font-semibold">azionecattolicachiari@gmail.com</span>.
                  Assicurati di aver aggiunto questo indirizzo tra gli "Utenti di test" nella Google Cloud Console.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button asChild>
              <a href="/api/drive/auth">
                <RefreshCw className="mr-2 h-4 w-4" />
                {driveConnected || tokenStatus === 'ok' ? 'Riconnetti Google Drive' : 'Collega Google Drive'}
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConfigurazionePage() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <ConfigurazioneContent />
    </Suspense>
  );
}
