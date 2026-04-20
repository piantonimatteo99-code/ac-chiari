'use client';

import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Send, AlertTriangle } from 'lucide-react';
import type { NotificaEventType } from '@/lib/notification-types';

interface TestNotification {
  eventType: NotificaEventType;
  title: string;
  body: string;
  href: string;
  userId?: string;
  category: string;
  categoryColor: string;
}

const TEST_NOTIFICATIONS: TestNotification[] = [
  // Broadcast (tutti gli utenti)
  {
    eventType: 'evento_nuovo',
    title: '📅 Nuovo impegno: Gita in montagna',
    body: 'È stato aggiunto un nuovo impegno: "Gita in montagna" il 20 aprile 2026.',
    href: '/calendario',
    category: 'Evento',
    categoryColor: 'bg-blue-100 text-blue-700',
  },
  {
    eventType: 'evento_modificato',
    title: '📅 Impegno modificato: Riunione mensile',
    body: 'L\'impegno "Riunione mensile" è stato aggiornato (15 aprile 2026).',
    href: '/calendario',
    category: 'Evento',
    categoryColor: 'bg-blue-100 text-blue-700',
  },
  {
    eventType: 'evento_rimosso',
    title: '❌ Impegno annullato: Uscita al parco',
    body: 'L\'impegno "Uscita al parco" è stato eliminato dal calendario.',
    href: '/calendario',
    category: 'Evento',
    categoryColor: 'bg-blue-100 text-blue-700',
  },
  {
    eventType: 'progetto_nuovo',
    title: '🚀 Nuovo evento: Campo estivo 2026',
    body: 'È stato creato l\'evento "Campo estivo 2026" con inizio il 1 luglio 2026.',
    href: '/progetti',
    category: 'Progetto',
    categoryColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    eventType: 'raccolta_nuova',
    title: '💰 Nuova raccolta fondi: Campo estivo',
    body: 'È aperta la raccolta fondi per "Campo estivo 2026". Verifica le quote.',
    href: '/contabilita/raccolte',
    category: 'Pagamento',
    categoryColor: 'bg-amber-100 text-amber-700',
  },
  {
    eventType: 'tesseramento_scadenza',
    title: '🏅 Scadenza tesseramento in avvicinamento',
    body: 'Il tesseramento per l\'anno corrente scade tra 30 giorni. Rinnova subito!',
    href: '/tesserati/tesserati',
    category: 'Iscrizione',
    categoryColor: 'bg-purple-100 text-purple-700',
  },
  {
    eventType: 'nuovo_iscritto',
    title: '📝 Nuovo iscritto al progetto',
    body: 'Mario Rossi si è iscritto al progetto "Campo estivo 2026".',
    href: '/progetti',
    category: 'Iscrizione',
    categoryColor: 'bg-purple-100 text-purple-700',
  },
  {
    eventType: 'comunicazione_generale',
    title: '📢 Comunicazione dalla segreteria',
    body: 'Ricorda: la riunione di aprile è confermata per sabato alle 15:00.',
    href: '/dashboard',
    category: 'Generale',
    categoryColor: 'bg-green-100 text-green-700',
  },
  // Solo Admin
  {
    eventType: 'nuovo_utente',
    title: '👤 Nuovo Utente Registrato',
    body: 'L\'utente Mario Bianchi ha creato un account sul portale.',
    href: '/admin/gestione-utenti/utenti-registrati',
    userId: '__admin_broadcast__',
    category: 'Admin',
    categoryColor: 'bg-red-100 text-red-700',
  },
  {
    eventType: 'pagamento_ricevuto',
    title: '💵 Nuovo Incasso in Contanti (Educatore Test)',
    body: 'Registrato pagamento in contanti per Campo estivo (Mario Rossi, Caparra: €50.00).',
    href: '/contabilita/pagamenti-contanti',
    userId: '__admin_broadcast__',
    category: 'Admin',
    categoryColor: 'bg-red-100 text-red-700',
  },
  {
    eventType: 'transazione_da_controllare',
    title: '🧾 Nuova Spesa Registrata (Educatore Test)',
    body: 'Registrata una spesa di €35.00 per: Acquisto materiali attività di laboratorio.',
    href: '/contabilita/conto',
    userId: '__admin_broadcast__',
    category: 'Admin',
    categoryColor: 'bg-red-100 text-red-700',
  },
  {
    eventType: 'prodotto_in_scadenza',
    title: '📦 Prodotto in scadenza: Farina 00',
    body: 'Il prodotto "Farina 00" scade tra 5 giorni. Verifica il magazzino.',
    href: '/magazzino',
    userId: '__admin_broadcast__',
    category: 'Magazzino',
    categoryColor: 'bg-orange-100 text-orange-700',
  },
  {
    eventType: 'nuovo_feedback',
    title: '💬 Nuovo feedback ricevuto',
    body: 'Un utente ha inviato un nuovo feedback: "L\'app è migliorata molto!".',
    href: '/admin/segnalazioni',
    userId: '__admin_broadcast__',
    category: 'Admin',
    categoryColor: 'bg-red-100 text-red-700',
  },
];

export default function TestNotificationsPage() {
  const [results, setResults] = useState<Record<string, 'idle' | 'loading' | 'ok' | 'error'>>({});
  const [sendAll, setSendAll] = useState<'idle' | 'loading' | 'ok'>('idle');

  const sendTest = async (n: TestNotification) => {
    const key = n.eventType;
    setResults(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const currentUser = getAuth().currentUser;
      if (!currentUser) throw new Error('Utente non autenticato');
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: n.userId ?? '__broadcast__',
          title: n.title,
          body: n.body,
          type: getType(n.eventType),
          href: n.href,
          eventType: n.eventType,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResults(prev => ({ ...prev, [key]: 'ok' }));
    } catch {
      setResults(prev => ({ ...prev, [key]: 'error' }));
    }
  };

  const sendAllTests = async () => {
    setSendAll('loading');
    for (const n of TEST_NOTIFICATIONS) {
      await sendTest(n);
      await new Promise(r => setTimeout(r, 300)); // small delay between requests
    }
    setSendAll('ok');
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div>
        <h2 className="text-2xl font-bold">Test Notifiche</h2>
        <p className="text-muted-foreground mt-1">
          Invia notifiche di prova per verificare che ogni tipologia funzioni correttamente — sia nel centro notifiche (campanella) che come push sul dispositivo.
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Le notifiche di tipo <strong>Broadcast</strong> verranno inviate a tutti gli utenti dell'app. Le notifiche di tipo <strong>Admin</strong> solo agli amministratori.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={sendAllTests}
          disabled={sendAll === 'loading'}
          size="lg"
          className="gap-2"
        >
          {sendAll === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : sendAll === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {sendAll === 'loading' ? 'Invio in corso...' : sendAll === 'ok' ? 'Tutte inviate!' : 'Invia tutte le notifiche di test'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEST_NOTIFICATIONS.map((n) => {
          const key = n.eventType;
          const status = results[key] ?? 'idle';
          return (
            <Card key={key} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-[10px] px-1.5 py-0.5 rounded-full border-0 ${n.categoryColor}`}>
                        {n.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">{n.eventType}</span>
                    </div>
                    <CardTitle className="text-sm leading-snug">{n.title}</CardTitle>
                  </div>
                  {status === 'ok' && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />}
                  {status === 'error' && <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />}
                </div>
                <CardDescription className="text-xs">{n.body}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 mt-auto">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono truncate mr-2">
                    → {n.userId === '__admin_broadcast__' ? 'solo admin' : 'tutti gli utenti'}
                  </span>
                  <Button
                    size="sm"
                    variant={status === 'ok' ? 'outline' : 'default'}
                    className="gap-1.5 shrink-0"
                    onClick={() => sendTest(n)}
                    disabled={status === 'loading'}
                  >
                    {status === 'loading' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {status === 'loading' ? 'Invio...' : status === 'ok' ? 'Invia ancora' : 'Invia test'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function getType(eventType: NotificaEventType): string {
  const map: Record<string, string> = {
    evento_nuovo: 'evento',
    evento_modificato: 'evento',
    evento_rimosso: 'evento',
    progetto_nuovo: 'generale',
    raccolta_nuova: 'pagamento',
    tesseramento_scadenza: 'iscrizione',
    nuovo_iscritto: 'iscrizione',
    comunicazione_generale: 'generale',
    nuovo_utente: 'generale',
    pagamento_ricevuto: 'pagamento',
    transazione_da_controllare: 'pagamento',
    prodotto_in_scadenza: 'magazzino',
    nuovo_feedback: 'feedback',
  };
  return map[eventType] ?? 'generale';
}
