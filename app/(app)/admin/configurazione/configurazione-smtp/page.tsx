'use client';

import { useState } from 'react';
import { useUserData } from '@/src/hooks/use-user-data';
import { useUser } from '@/src/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Send,
  ServerCog,
  ShieldAlert,
} from 'lucide-react';

export default function ConfigurazioneSMTPPage() {
  const { userData, isLoading: isUserLoading } = useUserData();
  const { user } = useUser();
  const isAdmin = userData?.roles?.includes('admin');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [testRecipient, setTestRecipient] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="max-w-2xl mx-auto mt-8 border-destructive/20 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-6 w-6" />
            Accesso Negato
          </CardTitle>
          <CardDescription>
            Questa pagina è riservata esclusivamente agli amministratori del sistema.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getAuthHeader = async () => {
    if (!user) throw new Error('Non autenticato');
    const idToken = await user.getIdToken();
    return `Bearer ${idToken}`;
  };

  const handleSave = async () => {
    if (!host || !smtpUser || !smtpPass) {
      setSaveResult({ type: 'error', message: 'Host, utente e password sono obbligatori.' });
      return;
    }

    setIsSaving(true);
    setSaveResult(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/admin/save-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          host,
          port,
          secure,
          user: smtpUser,
          pass: smtpPass,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nel salvataggio');
      setSaveResult({ type: 'success', message: 'Configurazione SMTP salvata correttamente nel database.' });
    } catch (err: any) {
      setSaveResult({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!host || !smtpUser || !smtpPass || !testRecipient) {
      setTestResult({ type: 'error', message: 'Compila tutti i campi e inserisci un\'email destinatario per il test.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/admin/test-smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          host,
          port,
          secure,
          user: smtpUser,
          pass: smtpPass,
          testRecipient,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nel test');
      setTestResult({ type: 'success', message: `Email di test inviata a ${testRecipient}! Controlla la tua casella.` });
    } catch (err: any) {
      setTestResult({ type: 'error', message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8 text-primary" />
          Configurazione Email (SMTP)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura il server di posta elettronica specifico per questa associazione. Le impostazioni salvate qui sovrascrivono le credenziali globali di sistema.
        </p>
      </div>

      {/* Info card */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-300 text-sm">
          <strong>Come funziona:</strong> Le email (registrazione, reset password, pagamenti, ecc.) vengono inviate tramite il server SMTP qui configurato. Se non configurato, il sistema utilizzerà automaticamente le credenziali globali di GemmaFlow.
        </AlertDescription>
      </Alert>

      {/* SMTP Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" />
            Parametri del Server SMTP
          </CardTitle>
          <CardDescription>
            Inserisci i dati del tuo server di posta. Puoi usare Gmail, Outlook, o qualsiasi provider SMTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Host */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="smtp-host">Host SMTP</Label>
              <Input
                id="smtp-host"
                placeholder="smtp.gmail.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-port">Porta</Label>
              <Input
                id="smtp-port"
                placeholder="587"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                type="number"
              />
            </div>
          </div>

          {/* Secure toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Connessione SSL/TLS</Label>
              <p className="text-sm text-muted-foreground">
                Abilita se il server richiede SSL (porta 465). Disabilita per STARTTLS (porta 587).
              </p>
            </div>
            <Switch checked={secure} onCheckedChange={setSecure} />
          </div>

          {/* Credentials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="smtp-user">Email / Utente SMTP</Label>
              <Input
                id="smtp-user"
                placeholder="info@tuaassociazione.it"
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtp-pass">Password / App Password</Label>
              <Input
                id="smtp-pass"
                placeholder="••••••••••••••••"
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
              />
            </div>
          </div>

          {/* Save result */}
          {saveResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
              saveResult.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}>
              {saveResult.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{saveResult.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salva configurazione
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Invia Email di Test
          </CardTitle>
          <CardDescription>
            Verifica che la configurazione inserita funzioni prima di salvare. L'email viene inviata usando i parametri inseriti nel form sopra (anche se non ancora salvati).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="test-recipient">Email destinatario test</Label>
            <Input
              id="test-recipient"
              placeholder="tuo.indirizzo@email.it"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
              testResult.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}>
              {testResult.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleTest} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Invia email di test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gmail tips */}
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            💡 Suggerimenti per Gmail
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
          <p>• <strong>Host:</strong> <code className="bg-amber-100 px-1 rounded">smtp.gmail.com</code> — <strong>Porta:</strong> <code className="bg-amber-100 px-1 rounded">587</code> — <strong>SSL:</strong> Disabilitato</p>
          <p>• Per Gmail, usa una <strong>App Password</strong> (non la password normale). Generala da: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium">myaccount.google.com/apppasswords</a></p>
          <p>• Richiede la <strong>verifica in 2 passaggi</strong> attiva sull'account Google.</p>
        </CardContent>
      </Card>
    </div>
  );
}
