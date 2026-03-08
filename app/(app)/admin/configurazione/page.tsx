'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, FolderOpen, Mail } from 'lucide-react';
import { useUserData } from '@/src/hooks/use-user-data';

function ConfigurazioneContent() {
  const searchParams = useSearchParams();
  const driveConnected = searchParams.get('drive_connected') === 'true';
  const driveError = searchParams.get('drive_error');
  const { userData } = useUserData();

  const isAdmin = userData?.roles?.includes('admin');

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
                {driveConnected ? 'Riconnetti Google Drive' : 'Collega Google Drive'}
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
