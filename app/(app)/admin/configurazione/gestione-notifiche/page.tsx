'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/src/firebase';
import { collection, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, BellOff, Info } from 'lucide-react';
import { NOTIFICA_TYPE_DEFINITIONS, getNotificasByCategory, type NotificaEventType } from '@/lib/notification-types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GlobalNotifConfig {
  id: NotificaEventType;
  enabled: boolean;
}

const RECIPIENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  educatore: 'Educatori',
  genitore: 'Genitori',
  tutti: 'Tutti',
};
const RECIPIENT_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  educatore: 'bg-blue-100 text-blue-700 border-blue-200',
  genitore: 'bg-green-100 text-green-700 border-green-200',
  tutti: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function GestioneNotifichePage() {
  const firestore = useFirestore();

  const configQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'notification-config') : null),
    [firestore]
  );
  const { data: configData, isLoading } = useCollection<GlobalNotifConfig>(configQuery);

  // Initialise missing configs in Firestore with defaults
  useEffect(() => {
    if (!firestore || isLoading || !configData) return;
    const existingIds = new Set(configData.map(c => c.id));
    const batch = writeBatch(firestore);
    let writes = 0;
    NOTIFICA_TYPE_DEFINITIONS.forEach(def => {
      if (!existingIds.has(def.id)) {
        batch.set(doc(firestore, 'notification-config', def.id), {
          id: def.id,
          enabled: def.defaultEnabled,
        });
        writes++;
      }
    });
    if (writes > 0) batch.commit().catch(console.error);
  }, [firestore, isLoading, configData]);

  const configMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (configData) configData.forEach(c => map.set(c.id, c.enabled));
    return map;
  }, [configData]);

  const handleToggle = async (id: NotificaEventType, enabled: boolean) => {
    if (!firestore) return;
    await setDoc(doc(firestore, 'notification-config', id), { id, enabled }, { merge: true });
  };

  const byCategory = useMemo(() => getNotificasByCategory(), []);
  const enabledCount = useMemo(() => Array.from(configMap.values()).filter(Boolean).length, [configMap]);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Gestione Notifiche
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Attiva o disattiva globalmente le notifiche automatiche del sistema.
              Gli utenti potranno poi personalizzarle individualmente nelle proprie preferenze.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{enabledCount}</p>
              <p className="text-xs text-muted-foreground">di {NOTIFICA_TYPE_DEFINITIONS.length} attive</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Come funziona:</strong> Le notifiche attivate qui vengono generate automaticamente
            dal sistema quando si verificano gli eventi corrispondenti. Ogni utente può poi scegliere
            quali ricevere nelle proprie preferenze personali (pannello campanella nell'header).
          </div>
        </div>

        {/* Categories */}
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Caricamento configurazione...</div>
        ) : (
          Array.from(byCategory.entries()).map(([category, defs]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{category}</CardTitle>
                <CardDescription>
                  {defs.filter(d => configMap.get(d.id) ?? d.defaultEnabled).length} di {defs.length} attive
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {defs.map(def => {
                    const isEnabled = configMap.get(def.id) ?? def.defaultEnabled;
                    return (
                      <div
                        key={def.id}
                        className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                          isEnabled ? '' : 'opacity-50'
                        }`}
                      >
                        {/* Icon */}
                        <div className="text-xl w-8 text-center shrink-0">{def.icon}</div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{def.label}</p>
                            {def.recipients.map(r => (
                              <span
                                key={r}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RECIPIENT_COLORS[r]}`}
                              >
                                {RECIPIENT_LABELS[r]}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
                        </div>

                        {/* Toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isEnabled ? (
                            <Bell className="h-4 w-4 text-primary" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(v) => handleToggle(def.id, v)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </TooltipProvider>
  );
}
