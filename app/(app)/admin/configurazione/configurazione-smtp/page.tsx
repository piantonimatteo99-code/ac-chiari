'use client';

import { useState, useEffect } from 'react';
import { useUserData } from '@/src/hooks/use-user-data';
import { useUser } from '@/src/firebase';
import { useFirestore } from '@/src/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Reply,
  Save,
  Send,
  ServerCog,
  ShieldAlert,
  User,
} from 'lucide-react';

export default function ConfigurazioneSMTPPage() {
  const { userData, isLoading: isUserLoading } = useUserData();
  const { user } = useUser();
  const firestore = useFirestore();
  const isAdmin = userData?.roles?.includes('admin');

  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [fromName, setFromName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [currentConfig, setCurrentConfig] = useState<Record<string, any> | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Carica la configurazione attuale dal Firestore
  useEffect(() => {
    if (!firestore || !isAdmin) return;

    const loadConfig = async () => {
      try {
        const smtpDoc = await getDoc(doc(firestore, 'config', 'smtp'));
        if (smtpDoc.exists()) {
          const data = smtpDoc.data();
          setCurrentConfig(data);
          // Pre-popola il form con i valori attuali
          setHost(data.host || '');
          setPort(String(data.port || '587'));
          setSecure(data.secure === true || data.secure === 'true');
          setSmtpUser(data.user || '');
          // NON pre-popolare la password per sicurezza (lascia vuoto)
          setFromName(data.fromName || '');
          setReplyTo(data.replyTo || '');
        }
      } catch (err) {
        console.error('Errore caricamento config SMTP:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    loadConfig();
  }, [firestore, isAdmin]);

  if (isUserLoading || isLoadingConfig) {
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
    if (!host || !smtpUser) {
      setSaveResult({ type: 'error', message: 'Host e utente SMTP sono obbligatori.' });
      return;
    }
    if (!smtpPass && !currentConfig?.pass) {
      setSaveResult({ type: 'error', message: 'La password è obbligatoria.' });
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
          // Se la password è vuota, mantieni quella esistente inviando un marker
          pass: smtpPass || currentConfig?.pass,
          fromName: fromName || null,
          replyTo: replyTo || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nel salvataggio');
      setSaveResult({ type: 'success', message: 'Configurazione SMTP salvata correttamente.' });
      // Aggiorna currentConfig locale
      setCurrentConfig(prev => ({ ...prev, host, port, secure, user: smtpUser, fromName, replyTo }));
    } catch (err: any) {
      setSaveResult({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!host || !smtpUser || !testRecipient) {
      setTestResult({ type: 'error', message: 'Compila host, utente e destinatario di test.' });
      return;
    }
    if (!smtpPass && !currentConfig?.pass) {
      setTestResult({ type: 'error', message: 'Inserisci la password per il test.' });
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
          pass: smtpPass || currentConfig?.pass,
          fromName: fromName || null,
          replyTo: replyTo || null,
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
          Configura il server di posta e il mittente per questa associazione.
        </p>
      </div>

      {/* Stato attuale */}
      {currentConfig && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-300 text-sm">
            <strong>Configurazione attiva:</strong>{' '}
            <Badge variant="outline" className="ml-1 text-green-700 border-green-400">
              {currentConfig.user}
            </Badge>
            {currentConfig.fromName && (
              <span className="ml-2">· Mittente: <strong>{currentConfig.fromName}</strong></span>
            )}
            {currentConfig.replyTo && (
              <span className="ml-2">· Reply-To: <strong>{currentConfig.replyTo}</strong></span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!currentConfig && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300 text-sm">
            <strong>Nessuna configurazione salvata.</strong> Le email useranno le credenziali globali di GemmaFlow.
          </AlertDescription>
        </Alert>
      )}

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
          {/* Host + Porta */}
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
                Abilita per porta 465 (SSL). Disabilita per porta 587 (STARTTLS).
              </p>
            </div>
            <Switch checked={secure} onCheckedChange={setSecure} />
          </div>

          {/* Credenziali */}
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
              <Label htmlFor="smtp-pass">
                Password / App Password
                {currentConfig?.pass && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">(lascia vuoto per mantenerla)</span>
                )}
              </Label>
              <Input
                id="smtp-pass"
                placeholder={currentConfig?.pass ? '••••••••••••••••' : 'Inserisci la password'}
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
              />
            </div>
          </div>

          {/* Separatore visivo */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              Personalizzazione mittente
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="from-name">Nome mittente</Label>
                <Input
                  id="from-name"
                  placeholder="AC Brescia"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nome visualizzato nelle email (es. &quot;AC Brescia&quot;). Se vuoto usa il nome dell&apos;associazione.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reply-to" className="flex items-center gap-1.5">
                  <Reply className="h-3.5 w-3.5" />
                  Indirizzo Reply-To
                </Label>
                <Input
                  id="reply-to"
                  placeholder="info@acbrescia.it"
                  type="email"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Quando gli utenti rispondono alle email, la risposta va a questo indirizzo.
                </p>
              </div>
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
            Verifica che la configurazione funzioni. Usa i parametri del form sopra (anche non ancora salvati).
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
          <p>• Richiede la <strong>verifica in 2 passaggi</strong> attiva sull&apos;account Google.</p>
        </CardContent>
      </Card>
    </div>
  );
}
