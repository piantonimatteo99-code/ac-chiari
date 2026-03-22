'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, ExternalLink, FolderOpen, Loader2, Mail, RefreshCw, Send, XCircle } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';
import { useUser } from '@/src/firebase';

function IntegrazioneDriveContent() {
  const searchParams = useSearchParams();
  const driveConnected = searchParams.get('drive_connected') === 'true';
  const driveError = searchParams.get('drive_error');
  const { userData } = useUserData();
  const { user } = useUser();
  const isAdmin = userData?.roles?.includes('admin');

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'ok' | 'expired' | 'unknown'>('checking');

  // Email test state
  const [emailTestStatus, setEmailTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [emailTestMessage, setEmailTestMessage] = useState('');

  useEffect(() => {
    fetch('/api/drive/documents?folderId=root')
      .then(res => {
        if (res.ok) { setTokenStatus('ok'); }
        else {
          res.json().then(d => {
            if (d.error && (d.error.includes('expired') || d.error.includes('revoked') || d.error.includes('Token'))) {
              setTokenStatus('expired');
            } else {
              setTokenStatus('unknown');
            }
          }).catch(() => setTokenStatus('unknown'));
        }
      })
      .catch(() => setTokenStatus('unknown'));
  }, [driveConnected]);

  const handleTestEmail = async () => {
    if (!user) return;
    setEmailTestStatus('sending');
    setEmailTestMessage('');
    try {
      const res = await fetch('/api/send-payment-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyHeadId: user.uid,
          paymentMethod: 'bonifico',
          paymentId: 'TEST0001',
          receiptUrl: 'https://example.com/ricevuta-test.pdf',
          paymentItems: [
            { memberName: 'Mario Rossi', raccoltaNome: 'Campo Estivo 2025', phase: 'Caparra', amount: '50' },
            { memberName: 'Lucia Rossi', raccoltaNome: 'Campo Estivo 2025', phase: 'Caparra', amount: '50' },
          ],
        }),
      });
      const data = await res.json();
      if (data.skipped) {
        setEmailTestStatus('error');
        setEmailTestMessage(`Email non inviata: ${data.reason}. Controlla SMTP_USER e SMTP_PASSWORD nel .env.local.`);
      } else if (data.success) {
        setEmailTestStatus('ok');
        setEmailTestMessage(`✅ Email inviata con successo a: ${data.sentTo}`);
      } else {
        setEmailTestStatus('error');
        setEmailTestMessage(`Errore: ${data.error}`);
      }
    } catch (e: any) {
      setEmailTestStatus('error');
      setEmailTestMessage(`Errore di rete: ${e.message}`);
    }
  };

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
      <h1 className="text-3xl font-bold">Integrazione Google Drive</h1>

      {/* ─── Card Google Drive ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            Collegamento Google Drive
          </CardTitle>
          <CardDescription>
            Gestisci il collegamento con l'account Google dell'organizzazione per l'archiviazione di documenti e foto.
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

          {/* Token status */}
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
                  {' '}e pubblica l'app OAuth per token permanenti.
                </p>
              </div></>
            )}
            {tokenStatus === 'unknown' && (
              <><Clock className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div><p className="font-medium text-amber-700">Drive non ancora configurato</p><p className="text-sm text-muted-foreground">Clicca "Collega Google Drive" per iniziare.</p></div></>
            )}
          </div>

          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Account organizzazione consigliato</p>
                <p className="text-sm text-muted-foreground">
                  Per garantire la continuità, collegare l'account <span className="font-semibold">azionecattolicachiari@gmail.com</span>.
                  Le cartelle dei progetti verranno create nel Drive di questo account.
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

      {/* ─── Card Test Email ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Test Email Notifiche Pagamenti
          </CardTitle>
          <CardDescription>
            Invia una email di prova al tuo account per verificare che la configurazione SMTP funzioni correttamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30 text-sm text-muted-foreground space-y-1">
            <p>📤 <strong>Mittente:</strong> azionecattolicachiari@gmail.com</p>
            <p>📥 <strong>Destinatario:</strong> la tua email ({userData?.email || user?.email || '—'})</p>
            <p>📋 <strong>Contenuto:</strong> email di prova con dati fittizi (Mario Rossi + Lucia Rossi, Campo Estivo 2025, €50 ciascuno)</p>
          </div>

          {emailTestStatus === 'ok' && (
            <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{emailTestMessage}</p>
            </div>
          )}
          {emailTestStatus === 'error' && (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
              <XCircle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{emailTestMessage}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleTestEmail}
              disabled={emailTestStatus === 'sending'}
              variant={emailTestStatus === 'ok' ? 'outline' : 'default'}
            >
              {emailTestStatus === 'sending' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Invio in corso...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Invia Email di Test</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function IntegrazioneDrivePage() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <IntegrazioneDriveContent />
    </Suspense>
  );
}
