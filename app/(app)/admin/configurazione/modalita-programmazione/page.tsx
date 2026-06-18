'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/src/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useUserData } from '@/src/hooks/use-user-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Calendar, Info, Loader2, ShieldAlert } from 'lucide-react';

export default function ModalitaProgrammazionePage() {
  const firestore = useFirestore();
  const { userData, isLoading: isUserLoading } = useUserData();
  const isAdmin = userData?.roles?.includes('admin');

  const systemConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'config', 'sistema');
  }, [firestore]);

  const { data: config, isLoading: isConfigLoading } = useDoc<{ modalitaProgrammazione?: boolean }>(systemConfigRef);
  const [isUpdating, setIsUpdating] = useState(false);

  const isProgrammingMode = !!config?.modalitaProgrammazione;

  const handleToggle = async (checked: boolean) => {
    if (!firestore || !systemConfigRef) return;
    setIsUpdating(true);
    try {
      await setDoc(systemConfigRef, { modalitaProgrammazione: checked }, { merge: true });
    } catch (err) {
      console.error('[modalita-programmazione] Errore salvataggio:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isUserLoading || isConfigLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Caricamento impostazioni...</span>
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

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          Modalità Programmazione
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestisci lo stato di pianificazione degli eventi del calendario all'inizio dell'anno associativo.
        </p>
      </div>

      {/* Main Switch Card */}
      <Card className="border-primary/10 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>Stato della Modalità Programmazione</CardTitle>
              <CardDescription>
                Se attiva, sospende la visibilità del calendario e le relative notifiche per gli utenti non autorizzati.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isProgrammingMode}
                onCheckedChange={handleToggle}
                disabled={isUpdating}
                className="scale-110"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isProgrammingMode ? (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <AlertTitle className="font-semibold">La modalità programmazione è ATTIVA</AlertTitle>
                <AlertDescription className="text-sm mt-1 leading-relaxed">
                  I genitori e gli utenti generici non riceveranno alcuna notifica relativa ai nuovi impegni ed eventi e vedranno il calendario vuoto. Solo gli <strong>educatori</strong> e gli <strong>amministratori</strong> potranno pianificare, modificare e vedere gli eventi in questa fase di transizione.
                </AlertDescription>
              </div>
            </Alert>
          ) : (
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <AlertTitle className="font-semibold">La modalità programmazione è DISATTIVA</AlertTitle>
                <AlertDescription className="text-sm mt-1 leading-relaxed">
                  Il calendario è in modalità di funzionamento normale. Tutti i gruppi e le famiglie possono visualizzare gli eventi di loro pertinenza in tempo reale e riceveranno notifiche regolari su canali push e in-app all'aggiunta di nuovi impegni.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Details list */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Effetti della modalità attiva</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <li className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xs">✗</span>
                <div>
                  <strong className="block text-foreground">Notifiche bloccate</strong>
                  <span className="text-muted-foreground text-xs">Vengono sospese tutte le notifiche automatiche di tipo calendario verso i non-educatori.</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xs">✗</span>
                <div>
                  <strong className="block text-foreground">Sincronizzazione Google Calendar disattivata</strong>
                  <span className="text-muted-foreground text-xs">I calendari Google personali dei genitori non verranno aggiornati con le modifiche in corso.</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xs">✗</span>
                <div>
                  <strong className="block text-foreground">Calendario nascosto</strong>
                  <span className="text-muted-foreground text-xs">I normali utenti vedranno un avviso di programmazione in corso sul calendario, senza caricare eventi.</span>
                </div>
              </li>
              <li className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/30">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 font-bold text-xs">✓</span>
                <div>
                  <strong className="block text-foreground">Educatori e Admin operativi</strong>
                  <span className="text-muted-foreground text-xs">Inserisci gli impegni liberamente: tutte le modifiche restano protette ed invisibili al pubblico.</span>
                </div>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
